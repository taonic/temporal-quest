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
        // TODO(ch01): call the lookup_airport activity (Workflow.ExecuteActivityAsync, with
        // LookupAirportAsync), with a 10-second StartToCloseTimeout and a RetryPolicy: wait 2 seconds
        // after a failure, twice as long each time, at most 6 seconds.
        await Task.CompletedTask;
        throw new NotImplementedException($"TODO(ch01): call the lookup_airport activity ({code})");
    }
}
