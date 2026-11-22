// dotnet run -- worker | dotnet run -- start SFO JFK
using System.Text.Json;
using Hello;
using Microsoft.Extensions.Logging;
using Temporalio.Client;
using Temporalio.Converters;
using Temporalio.Worker;

string Env(string name, string fallback) => Environment.GetEnvironmentVariable(name) ?? fallback;

var taskQueue = Env("HELLO_TASK_QUEUE", "hello");
var client = await TemporalClient.ConnectAsync(new(Env("TEMPORAL_ADDRESS", "localhost:7233"))
{
    Namespace = Env("TEMPORAL_NAMESPACE", "default"),
    // The wire contract's field names are camelCase (origin, not Origin): the web defaults say so.
    DataConverter = DataConverter.Default with
    {
        PayloadConverter = new DefaultPayloadConverter(new JsonSerializerOptions(JsonSerializerDefaults.Web)),
    },
    LoggerFactory = LoggerFactory.Create(b => b.AddSimpleConsole().SetMinimumLevel(LogLevel.Information)),
});

var command = args.Length > 0 ? args[0] : "worker";
if (command == "worker")
{
    // WORKER_MODE: the challenges run a worker with only workflows, or only activities.
    var mode = Env("WORKER_MODE", "all");
    var options = new TemporalWorkerOptions(taskQueue);
    if (mode != "activities") options.AddWorkflow<HelloTripWorkflow>();
    if (mode != "workflows") options.AddAllActivities(new Activities());
    using var worker = new TemporalWorker(client, options);
    using var stop = new CancellationTokenSource();
    Console.CancelKeyPress += (_, e) => { e.Cancel = true; stop.Cancel(); };
    AppDomain.CurrentDomain.ProcessExit += (_, _) => stop.Cancel();
    Console.WriteLine($"Hello worker ready on task queue '{taskQueue}'");
    try { await worker.ExecuteAsync(stop.Token); } catch (OperationCanceledException) { }
}
else if (command == "start")
{
    var origin = args.Length > 1 ? args[1] : "SFO";
    var destination = args.Length > 2 ? args[2] : "JFK";
    var workflowId = $"hello-{origin.ToLowerInvariant()}-{destination.ToLowerInvariant()}-{Guid.NewGuid().ToString()[..4]}";
    var handle = await client.StartWorkflowAsync(
        (HelloTripWorkflow wf) => wf.RunAsync(new TripRequest(origin, destination)),
        new(workflowId, taskQueue));
    Console.WriteLine($"Started {workflowId}");
    Console.WriteLine(await handle.GetResultAsync());
}
