package hello;

import io.temporal.client.WorkflowClient;
import io.temporal.common.WorkflowExecutionHistory;
import io.temporal.testing.WorkflowReplayer;
import io.temporal.worker.NonDeterministicException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Replay a workflow's history against the code you have now, before you ship it.
 *
 * <pre>
 *   ./hello replay hold-15a                    (the latest workflow whose id starts hold-15a-)
 *   ./hello replay --history FILE              (a history kept as JSON: what the checks do)
 *   ./hello replay --history FILE --provided   (with the SDK's replayer, not replay() below: F12's check)
 * </pre>
 *
 * <p>It runs today's workflow code over the history, the way a new worker would after a deploy. If
 * the code would now decide something the history didn't record, the replay fails here, on your
 * machine, instead of on a running workflow in production. In CI, keep a few real histories as JSON
 * files and replay them in a test. Exits 0 when it replays, 1 when it doesn't match, 2 otherwise.
 */
public final class Replay {
    private Replay() {}

    static void replay(WorkflowExecutionHistory history) throws Exception {
        // A replayer is a worker with no server: it runs the workflow code over a history, and throws
        // if the code doesn't make the same decisions the history recorded.
        WorkflowReplayer.replayWorkflowExecution(history, HelloTripWorkflowImpl.class, BoardingWorkflowImpl.class,
                FareHoldWorkflowImpl.class, ItineraryWorkflowImpl.class, BookTripWorkflowImpl.class);
    }

    // The replayer the checks use for F12 (--provided), so a check of the patch doesn't need replay() written.
    private static void provided(WorkflowExecutionHistory history) throws Exception {
        WorkflowReplayer.replayWorkflowExecution(history, HelloTripWorkflowImpl.class, BoardingWorkflowImpl.class,
                FareHoldWorkflowImpl.class, ItineraryWorkflowImpl.class, BookTripWorkflowImpl.class);
    }

    static int run(String[] args) throws Exception {
        WorkflowExecutionHistory history;
        String name;
        if (args.length >= 2 && args[0].equals("--history")) {
            name = args[1];
            history = WorkflowExecutionHistory.fromJson(Files.readString(Path.of(name)));
        } else if (args.length == 1) {
            WorkflowClient client = Starter.client();
            String found = Starter.latest(client, args[0], null);
            if (found == null) {
                System.err.println("No workflow called " + args[0] + " or " + args[0] + "-…: start one first.");
                return 2;
            }
            name = found;
            history = client.fetchHistory(found);
        } else {
            System.err.println("usage: ./hello replay WORKFLOW_ID   (e.g. hold-15a, for the latest hold-15a-…)");
            return 2;
        }
        try {
            if (java.util.Arrays.asList(args).contains("--provided")) {
                provided(history);
            } else {
                replay(history);
            }
        } catch (Exception err) {
            String nondeterminism = nondeterminism(err);
            if (nondeterminism == null) throw err;
            System.err.println("✗ " + name + " doesn't replay on this code: it would break that workflow.\n  " + nondeterminism);
            return 1;
        }
        System.out.println("✓ " + name + " replays on this code: safe to deploy, as far as it's concerned.");
        return 0;
    }

    // What the replayer found that doesn't match, or null for any other error. It reports it inside
    // another error's message ("[TMPRL1100] ... does not match ..."), not always as its cause.
    private static String nondeterminism(Throwable err) {
        for (Throwable e = err; e != null; e = e.getCause()) {
            String message = String.valueOf(e.getMessage());
            if (e instanceof NonDeterministicException || message.contains("TMPRL1100")) {
                int start = Math.max(0, message.lastIndexOf("[TMPRL1100]"));
                return message.substring(start).split("[\\n{]")[0].trim();
            }
        }
        return null;
    }
}
