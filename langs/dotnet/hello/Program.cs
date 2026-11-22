// hello worker | start | board | hold | pay | itinerary | book | replay: what ./hello runs. The worker
// is HelloWorker; the commands that start and talk to workflows are in Starter.
using Hello;

var command = args.Length > 0 ? args[0] : "worker";
var rest = args.Skip(1).ToArray();
try
{
    switch (command)
    {
        case "worker":
            await HelloWorker.RunAsync();
            return 0;
        case "replay":
            return await Replay.RunAsync(rest);
        default:
            return await Starter.RunAsync(command, rest);
    }
}
catch (Exception err)
{
    // 1 is the replayer's "doesn't match": anything else that goes wrong is 2.
    Console.Error.WriteLine(err.Message);
    return 2;
}
