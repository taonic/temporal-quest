namespace Hello;

using Microsoft.Extensions.Logging;
using Temporalio.Workflows;

// A durable counter: boarding a flight, one passenger at a time.   ./hello board SFO JFK
//
// No activities, no database, no files: the count is a plain field of this workflow, and nothing
// else keeps it. Stop the worker in the middle and start it again, and boarding carries on from
// the next passenger, because a worker rebuilds the count by replaying the workflow's history.
[Workflow("BoardingWorkflow")]
public class BoardingWorkflow
{
    private string flight = "";
    private int seats;
    // The only state there is. No one saves it: replaying the history puts it back.
    private int onBoard = 0;

    [WorkflowRun]
    public async Task<string> RunAsync(BoardingRequest request)
    {
        flight = $"{request.Origin}→{request.Destination}";
        seats = request.Seats ?? 40;
        var pace = request.Pace ?? 2;

        while (onBoard < seats)
        {
            // A durable timer: recorded in the history, so it fires even if the worker that
            // started it is gone.
            await Workflow.DelayAsync(TimeSpan.FromSeconds(pace));
            onBoard += 1;
            // The workflow's logger stays quiet while a worker replays the history, so after a
            // restart the log picks up at the next passenger instead of counting from 1 again.
            Workflow.Logger.LogInformation("Boarded passenger {OnBoard}/{Seats}", onBoard, seats);
        }
        return $"Flight {flight}: {onBoard} passengers boarded.";
    }

    // Read the count from the Temporal UI: the workflow's Queries tab, Query Type "boarded". A
    // worker answers it from the workflow's state; it never changes it.
    [WorkflowQuery("boarded")]
    public BoardingStatus Boarded() => new(flight, onBoard, seats);
}
