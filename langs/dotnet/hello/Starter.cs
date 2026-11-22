namespace Hello;

using System.Text.Json;
using Temporalio.Client;
using Temporalio.Exceptions;
using Temporalio.Runtime;

// The client: start a workflow, and wait for its result (or, for a hold, start it and return).
//
//   ./hello start SFO JFK             a trip
//   ./hello board SFO JFK [40]        a boarding
//   ./hello hold 12A [SECONDS]        a fare hold, for 60 seconds unless you say
//   ./hello pay 12A 4242              pay for seat 12A's hold
//   ./hello itinerary SFO JFK LHR     a trip of several legs
//   ./hello book SFO JFK 4242         a booking (0000 is declined, 1111 has expired)
//
// Starting a workflow only records it; a worker runs it. With no worker, it waits.
public static class Starter
{
    // The SDK's core says each failure again, at length: keep its errors only (ConsoleLog says the rest).
    private static readonly TemporalRuntime Runtime = new(new TemporalRuntimeOptions
    {
        Telemetry = new() { Logging = new() { Filter = new(TelemetryFilterOptions.Level.Error, TelemetryFilterOptions.Level.Warn) } },
    });

    public static Task<TemporalClient> ConnectAsync() =>
        TemporalClient.ConnectAsync(new(Config.Address)
        {
            Namespace = Config.Namespace,
            DataConverter = Config.Converter,
            LoggerFactory = ConsoleLog.Factory(),
            Runtime = Runtime,
        });

    public static async Task<int> RunAsync(string command, string[] args)
    {
        var client = await ConnectAsync();
        var up = args.Select(a => a.ToUpperInvariant()).ToArray();
        string Arg(string[] from, int i, string fallback) => from.Length > i ? from[i] : fallback;
        switch (command)
        {
            case "start":
            {
                string origin = Arg(up, 0, "SFO"), destination = Arg(up, 1, "JFK");
                return await WaitForAsync(await StartAsync(client, "HelloTripWorkflow", $"hello-{Route(origin, destination)}", new TripRequest(origin, destination)));
            }
            case "board":
            {
                string origin = Arg(up, 0, "SFO"), destination = Arg(up, 1, "JFK");
                var request = new BoardingRequest(origin, destination, int.Parse(Arg(up, 2, "40")));
                return await WaitForAsync(await StartAsync(client, "BoardingWorkflow", $"board-{Route(origin, destination)}", request));
            }
            case "hold":
            {
                // Starts the hold and returns: the hold waits, not this terminal, so you can pay for it here.
                var seat = Arg(up, 0, "12A");
                var seconds = double.Parse(Arg(up, 1, "60"), System.Globalization.CultureInfo.InvariantCulture);
                var hold = await StartAsync(client, "FareHoldWorkflow", $"hold-{seat.ToLowerInvariant()}", new HoldRequest(seat, seconds));
                Console.WriteLine($"Holding seat {seat} for {Config.Number(seconds)}s: {hold.Id}: {Link(hold.Id)}");
                Console.WriteLine($"Pay for it with: ./hello pay {seat} 4242");
                return 0;
            }
            case "pay":
                return await PayAsync(client, Arg(up, 0, "12A"), Arg(args, 1, ""));
            case "itinerary":
            {
                var stops = up.Length >= 2 ? up.ToList() : new List<string> { "SFO", "JFK", "LHR" };
                var id = $"itinerary-{string.Join("-", stops).ToLowerInvariant()}";
                return await WaitForAsync(await StartAsync(client, "ItineraryWorkflow", id, new Itinerary(stops)));
            }
            case "book":
            {
                string origin = Arg(up, 0, "SFO"), destination = Arg(up, 1, "JFK");
                var booking = new Booking(origin, destination, Arg(args, 2, "4242"));
                var handle = await StartAsync(client, "BookTripWorkflow", $"book-{Route(origin, destination)}", booking);
                // A booking whose card has expired waits, for as long as it takes, for a new one. Say so
                // and stop, rather than wait here with it: the new card comes from the Temporal UI.
                return await WaitForAsync(handle, async () =>
                {
                    BookingStatus status;
                    try
                    {
                        status = await handle.QueryAsync<BookingStatus>("status", Array.Empty<object?>());
                    }
                    catch (Exception)
                    {
                        return false;
                    }
                    if (!status.Waiting) return false;
                    Console.WriteLine($"The card ending {status.Card} has expired. The booking is waiting for a new one, holding the");
                    Console.WriteLine("flight and the hotel. Send it one from the Temporal UI: More Actions, Send an Update, new_card.");
                    return true;
                });
            }
            default:
                Console.Error.WriteLine("usage: ./hello start|board|hold|pay|itinerary|book ... (see Starter.cs)");
                return 2;
        }
    }

    private static string Route(string origin, string destination) => $"{origin.ToLowerInvariant()}-{destination.ToLowerInvariant()}";

    private static string Link(string workflowId) => $"{Config.UiUrl}/namespaces/{Config.Namespace}/workflows/{workflowId}";

    // Starts the workflow `type` under the id `prefix-` and four characters of its own.
    private static Task<WorkflowHandle> StartAsync(TemporalClient client, string type, string prefix, object input) =>
        client.StartWorkflowAsync(type, new object?[] { input }, new($"{prefix}-{Guid.NewGuid().ToString()[..4]}", Config.TaskQueue));

    // Prints where the workflow is, waits for its result, and prints that. `stop`, if given, is asked
    // every second whether to stop waiting (and says why if so).
    private static async Task<int> WaitForAsync(WorkflowHandle handle, Func<Task<bool>>? stop = null)
    {
        Console.WriteLine($"Started {handle.Id}: {Link(handle.Id)}");
        Console.WriteLine("Waiting for the result...");
        var result = handle.GetResultAsync<JsonElement>();
        while (stop != null && await Task.WhenAny(result, Task.Delay(1000)) != result)
        {
            if (await stop()) return 0;
        }
        try
        {
            var value = await result;
            Console.WriteLine(value.ValueKind == JsonValueKind.Array
                ? string.Join("\n", value.EnumerateArray().Select(v => v.ToString()))
                : value.ToString());
            return 0;
        }
        catch (WorkflowFailedException failed)
        {
            var cause = failed.InnerException?.InnerException ?? failed.InnerException ?? failed;
            Console.Error.WriteLine($"The workflow failed: {cause.Message}");
            return 1;
        }
    }

    // Pays for the seat's hold that's still running: its id starts hold-<seat>-.
    private static async Task<int> PayAsync(TemporalClient client, string seat, string card)
    {
        var found = await LatestAsync(client, $"hold-{seat.ToLowerInvariant()}",
            "WorkflowType = 'FareHoldWorkflow' AND ExecutionStatus = 'Running'");
        if (found == null)
        {
            Console.Error.WriteLine($"No hold is running for seat {seat}: start one with ./hello hold {seat}");
            return 1;
        }
        // An update waits for a worker to run it: give up after a while, rather than hang.
        var update = client.GetWorkflowHandle(found).ExecuteUpdateAsync<string>("pay", new object?[] { new Payment(card) });
        if (await Task.WhenAny(update, Task.Delay(TimeSpan.FromSeconds(15))) != update)
        {
            Console.Error.WriteLine($"No answer from {found} in 15 seconds: is a worker running? Open it in the Temporal UI to see.");
            return 1;
        }
        try
        {
            Console.WriteLine(await update);
            return 0;
        }
        catch (WorkflowUpdateFailedException refused)
        {
            Console.Error.WriteLine($"Payment refused: {(refused.InnerException ?? refused).Message}");
            return 1;
        }
    }

    // The workflow called `name`, or the latest whose id starts with it and a dash (and matches `query`).
    public static async Task<string?> LatestAsync(TemporalClient client, string name, string? query)
    {
        await foreach (var workflow in client.ListWorkflowsAsync(query ?? ""))
        {
            if (workflow.Id == name || workflow.Id.StartsWith($"{name}-")) return workflow.Id;
        }
        return null;
    }
}
