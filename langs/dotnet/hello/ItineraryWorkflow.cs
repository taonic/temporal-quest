namespace Hello;

using Temporalio.Workflows;

// An itinerary: a trip of several legs, each its own workflow.   ./hello itinerary SFO JFK LHR
//
// SFO JFK LHR is two legs, SFO→JFK and JFK→LHR. The itinerary starts a child workflow for each,
// all at once, and puts their answers together. Each child is a HelloTripWorkflow, with a history
// of its own.
[Workflow("ItineraryWorkflow")]
public class ItineraryWorkflow
{
    [WorkflowRun]
    public async Task<List<string>> RunAsync(Itinerary itinerary)
    {
        var stops = itinerary.Stops;
        // Every leg at once: Workflow.WhenAllAsync waits for them all, and keeps their order.
        var legs = Enumerable.Range(1, stops.Count - 1).Select(n => LegAsync(n, stops[n - 1], stops[n]));
        return (await Workflow.WhenAllAsync(legs)).ToList();
    }

    private static async Task<string> LegAsync(int n, string origin, string destination)
    {
        // A child workflow: started, and waited for, by this one. Its id is this workflow's, plus
        // the leg, so each leg is easy to find, and starting the same leg twice is refused.
        return await Workflow.ExecuteChildWorkflowAsync(
            (HelloTripWorkflow wf) => wf.RunAsync(new TripRequest(origin, destination)),
            new() { Id = $"{Workflow.Info.WorkflowId}-leg-{n}" });
    }
}
