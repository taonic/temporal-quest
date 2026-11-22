namespace Hello;

using Temporalio.Worker;
using Temporalio.Workflows;

// The worker: the process that runs workflow and activity code.   ./hello worker
//
// It polls the "hello" task queue. Temporal hands it work; it never listens on a port.
public static class HelloWorker
{
    // Every workflow this worker runs (and the replayer replays).
    public static readonly IReadOnlyList<WorkflowDefinition> Workflows = new[]
    {
        typeof(HelloTripWorkflow), typeof(BoardingWorkflow), typeof(FareHoldWorkflow), typeof(ItineraryWorkflow), typeof(BookTripWorkflow),
    }.Select(WorkflowDefinition.Create).ToList();

    public static async Task RunAsync()
    {
        var client = await Starter.ConnectAsync();
        var options = new TemporalWorkerOptions(Config.TaskQueue);
        // WORKER_MODE: the checks and challenges run only the workflows (their activities are Python's).
        if (Config.Mode != "activities") foreach (var workflow in Workflows) options.Workflows.Add(workflow);
        if (Config.Mode != "workflows") options.AddAllActivities(new Activities());
        using var worker = new TemporalWorker(client, options);
        using var stop = new CancellationTokenSource();
        // Ctrl-C and a stop (SIGTERM) both end the wait below, rather than the process: the worker
        // then shuts down properly, so Temporal stops sending its workflows here at once.
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; stop.Cancel(); };
        using var sigterm = System.Runtime.InteropServices.PosixSignalRegistration.Create(
            System.Runtime.InteropServices.PosixSignal.SIGTERM, context => { context.Cancel = true; stop.Cancel(); });
        Console.WriteLine($"Hello worker ready on task queue '{Config.TaskQueue}'");
        try
        {
            await worker.ExecuteAsync(stop.Token);
        }
        catch (OperationCanceledException)
        {
        }
    }
}
