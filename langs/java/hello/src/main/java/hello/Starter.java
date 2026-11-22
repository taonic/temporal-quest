package hello;

import hello.Shared.BoardingRequest;
import hello.Shared.Booking;
import hello.Shared.BookingStatus;
import hello.Shared.HoldRequest;
import hello.Shared.Itinerary;
import hello.Shared.Payment;
import hello.Shared.TripRequest;
import io.temporal.api.workflowservice.v1.ListWorkflowExecutionsRequest;
import io.temporal.client.WorkflowClient;
import io.temporal.client.WorkflowClientOptions;
import io.temporal.client.WorkflowExecutionMetadata;
import io.temporal.client.WorkflowFailedException;
import io.temporal.client.WorkflowOptions;
import io.temporal.client.WorkflowStub;
import io.temporal.client.WorkflowUpdateException;
import io.temporal.failure.TemporalFailure;
import io.temporal.serviceclient.WorkflowServiceStubs;
import io.temporal.serviceclient.WorkflowServiceStubsOptions;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

/**
 * The client: start a workflow, and wait for its result (or, for a hold, start it and return).
 *
 * <pre>
 *   ./hello start SFO JFK             a trip
 *   ./hello board SFO JFK [40]        a boarding
 *   ./hello hold 12A [SECONDS]        a fare hold, for 60 seconds unless you say
 *   ./hello pay 12A 4242              pay for seat 12A's hold
 *   ./hello itinerary SFO JFK LHR     a trip of several legs
 *   ./hello book SFO JFK 4242         a booking (0000 is declined, 1111 has expired)
 * </pre>
 *
 * <p>Starting a workflow only records it; a worker runs it. With no worker, it waits.
 */
public final class Starter {
    private Starter() {}

    static WorkflowClient client() {
        var service = WorkflowServiceStubs.newServiceStubs(
                WorkflowServiceStubsOptions.newBuilder().setTarget(Config.ADDRESS).build());
        return WorkflowClient.newInstance(service,
                WorkflowClientOptions.newBuilder().setNamespace(Config.NAMESPACE).build());
    }

    static int run(String command, String[] args) throws Exception {
        WorkflowClient client = client();
        String[] up = Arrays.stream(args).map(String::toUpperCase).toArray(String[]::new);
        switch (command) {
            case "start" -> {
                String origin = arg(up, 0, "SFO"), destination = arg(up, 1, "JFK");
                return waitFor(start(client, "HelloTripWorkflow", "hello-" + route(origin, destination),
                        new TripRequest(origin, destination)), null);
            }
            case "board" -> {
                String origin = arg(up, 0, "SFO"), destination = arg(up, 1, "JFK");
                int seats = Integer.parseInt(arg(up, 2, "40"));
                return waitFor(start(client, "BoardingWorkflow", "board-" + route(origin, destination),
                        new BoardingRequest(origin, destination, seats, null)), null);
            }
            case "hold" -> {
                // Starts the hold and returns: the hold waits, not this terminal, so you can pay for it here.
                String seat = arg(up, 0, "12A");
                double seconds = Double.parseDouble(arg(up, 1, "60"));
                WorkflowStub hold = start(client, "FareHoldWorkflow", "hold-" + seat.toLowerCase(),
                        new HoldRequest(seat, seconds));
                String id = hold.getExecution().getWorkflowId();
                System.out.println("Holding seat " + seat + " for " + Config.number(seconds) + "s: " + id + ": " + link(id));
                System.out.println("Pay for it with: ./hello pay " + seat + " 4242");
                return 0;
            }
            case "pay" -> {
                return pay(client, arg(up, 0, "12A"), arg(args, 1, ""));
            }
            case "itinerary" -> {
                List<String> stops = up.length >= 2 ? List.of(up) : List.of("SFO", "JFK", "LHR");
                String id = "itinerary-" + String.join("-", stops).toLowerCase();
                return waitFor(start(client, "ItineraryWorkflow", id, new Itinerary(stops)), null);
            }
            case "book" -> {
                String origin = arg(up, 0, "SFO"), destination = arg(up, 1, "JFK");
                Booking booking = new Booking(origin, destination, arg(args, 2, "4242"));
                WorkflowStub handle = start(client, "BookTripWorkflow", "book-" + route(origin, destination), booking);
                // A booking whose card has expired waits, for as long as it takes, for a new one. Say so
                // and stop, rather than wait here with it: the new card comes from the Temporal UI.
                return waitFor(handle, () -> {
                    BookingStatus status;
                    try {
                        status = handle.query("status", BookingStatus.class);
                    } catch (RuntimeException notYet) {
                        return false;
                    }
                    if (status == null || !status.waiting()) return false;
                    System.out.println("The card ending " + status.card() + " has expired. The booking is waiting for a new one, holding the");
                    System.out.println("flight and the hotel. Send it one from the Temporal UI: More Actions, Send an Update, new_card.");
                    return true;
                });
            }
            default -> {
                System.err.println("usage: ./hello start|board|hold|pay|itinerary|book ... (see Starter.java)");
                return 2;
            }
        }
    }

    private static String arg(String[] args, int i, String fallback) {
        return args.length > i ? args[i] : fallback;
    }

    private static String route(String origin, String destination) {
        return origin.toLowerCase() + "-" + destination.toLowerCase();
    }

    private static String link(String workflowId) {
        return Config.UI_URL + "/namespaces/" + Config.NAMESPACE + "/workflows/" + workflowId;
    }

    // Starts the workflow `type` under the id `prefix-` and four characters of its own.
    private static WorkflowStub start(WorkflowClient client, String type, String prefix, Object input) {
        String id = prefix + "-" + UUID.randomUUID().toString().substring(0, 4);
        WorkflowStub stub = client.newUntypedWorkflowStub(type,
                WorkflowOptions.newBuilder().setTaskQueue(Config.TASK_QUEUE).setWorkflowId(id).build());
        stub.start(input);
        return stub;
    }

    // Prints where the workflow is, waits for its result, and prints that. `stop`, if given, is asked
    // every second whether to stop waiting (and says why if so).
    private static int waitFor(WorkflowStub handle, Supplier<Boolean> stop) throws Exception {
        String id = handle.getExecution().getWorkflowId();
        System.out.println("Started " + id + ": " + link(id));
        System.out.println("Waiting for the result...");
        CompletableFuture<Object> result = handle.getResultAsync(Object.class);
        while (stop != null) {
            try {
                result.get(1, TimeUnit.SECONDS);
                break;
            } catch (TimeoutException stillRunning) {
                if (stop.get()) return 0;
            } catch (Exception done) {
                break;
            }
        }
        try {
            Object value = result.get();
            System.out.println(value instanceof List<?> lines
                    ? String.join("\n", lines.stream().map(String::valueOf).toList())
                    : value);
            return 0;
        } catch (java.util.concurrent.ExecutionException err) {
            if (!(err.getCause() instanceof WorkflowFailedException failed)) throw err;
            Throwable cause = failed.getCause();
            System.err.println("The workflow failed: " + reason(cause.getCause() != null ? cause.getCause() : cause));
            return 1;
        }
    }

    // What went wrong, in the words of the code that threw: a Temporal failure's own message, not
    // its message='…', type='…' summary.
    private static String reason(Throwable err) {
        return err instanceof TemporalFailure failure ? failure.getOriginalMessage() : err.getMessage();
    }

    // Pays for the seat's hold that's still running: its id starts hold-<seat>-.
    private static int pay(WorkflowClient client, String seat, String card) throws Exception {
        String found = latest(client, "hold-" + seat.toLowerCase(),
                "WorkflowType = 'FareHoldWorkflow' AND ExecutionStatus = 'Running'");
        if (found == null) {
            System.err.println("No hold is running for seat " + seat + ": start one with ./hello hold " + seat);
            return 1;
        }
        WorkflowStub hold = client.newUntypedWorkflowStub(found);
        try {
            // An update waits for a worker to run it: give up after a while, rather than hang.
            String answer = CompletableFuture
                    .supplyAsync(() -> hold.update("pay", String.class, new Payment(card)))
                    .get(15, TimeUnit.SECONDS);
            System.out.println(answer);
            return 0;
        } catch (java.util.concurrent.ExecutionException err) {
            if (err.getCause() instanceof WorkflowUpdateException refused) {
                System.err.println("Payment refused: " + reason(refused.getCause() != null ? refused.getCause() : refused));
                return 1;
            }
            throw err;
        } catch (TimeoutException err) {
            System.err.println("No answer from " + found + " in 15 seconds: is a worker running? Open it in the Temporal UI to see.");
            return 1;
        }
    }

    // The workflow called `name`, or the latest whose id starts with it and a dash (and matches `query`).
    static String latest(WorkflowClient client, String name, String query) {
        return client.listExecutions(query)
                .map(WorkflowExecutionMetadata::getExecution)
                .map(execution -> execution.getWorkflowId())
                .filter(id -> id.equals(name) || id.startsWith(name + "-"))
                .findFirst()
                .orElse(null);
    }
}
