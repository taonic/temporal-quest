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
        // TODO(ch06): run this leg as a child HelloTripWorkflow, and return its answer:
        //   return await Workflow.ExecuteChildWorkflowAsync((HelloTripWorkflow wf) => wf.RunAsync(...), new() { Id = ... });
        // Give it an id made of this workflow's id (Workflow.Info.WorkflowId) and the leg's number.
        await Task.CompletedTask;
        throw new NotImplementedException($"TODO(ch06): run the leg as a child workflow ({n}: {origin} to {destination})");
    }
}
