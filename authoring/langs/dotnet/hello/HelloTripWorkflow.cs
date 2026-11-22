namespace Hello;

using Temporalio.Workflows;

// The workflow: a durable function that describes a trip. Workflow code must be deterministic:
// Temporal may replay it from its history at any time, on any worker. So it never touches the
// outside world itself. It asks for that through activities, and Temporal records each result.
[Workflow("HelloTripWorkflow")]
public class HelloTripWorkflow
{
    [WorkflowRun]
    public async Task<string> RunAsync(TripRequest trip)
    {
        var origin = await AirportAsync(trip.Origin);
        var destination = await AirportAsync(trip.Destination);
        return $"Your trip: {origin.City} ({origin.Code}) to {destination.City} ({destination.Code}).";
    }

    private static async Task<Airport> AirportAsync(string code)
    {
        // @@solution F2
        // Ask Temporal to run the activity. Its result is recorded in the workflow's history,
        // so a replay reuses the result instead of running the activity again.
        return await Workflow.ExecuteActivityAsync(
            (Activities act) => act.LookupAirportAsync(code),
            new()
            {
                // How long one attempt may take before Temporal times it out and tries again.
                StartToCloseTimeout = TimeSpan.FromSeconds(10),
                // Failed attempts are retried for you: wait 2s, then twice as long each time, up to 6s.
                RetryPolicy = new()
                {
                    InitialInterval = TimeSpan.FromSeconds(2),
                    BackoffCoefficient = 2,
                    MaximumInterval = TimeSpan.FromSeconds(6),
                },
            });
        // @@starter
        // TODO(ch01): call the lookup_airport activity (Workflow.ExecuteActivityAsync, with
        // LookupAirportAsync), with a 10-second StartToCloseTimeout and a RetryPolicy: wait 2 seconds
        // after a failure, twice as long each time, at most 6 seconds.
        await Task.CompletedTask;
        throw new NotImplementedException($"TODO(ch01): call the lookup_airport activity ({code})");
        // @@end
    }
}
