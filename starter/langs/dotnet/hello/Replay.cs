namespace Hello;

using Temporalio.Common;
using Temporalio.Exceptions;
using Temporalio.Worker;
using Temporalio.Workflows;

// Replay a workflow's history against the code you have now, before you ship it.
//
//   ./hello replay hold-15a                    (the latest workflow whose id starts hold-15a-)
//   ./hello replay --history FILE              (a history kept as JSON: what the checks do)
//   ./hello replay --history FILE --provided   (with the SDK's replayer, not ReplayAsync below: F12's check)
//
// It runs today's workflow code over the history, the way a new worker would after a deploy. If the
// code would now decide something the history didn't record, the replay fails here, on your
// machine, instead of on a running workflow in production. In CI, keep a few real histories as JSON
// files and replay them in a test. Exits 0 when it replays, 1 when it doesn't match, 2 otherwise.
public static class Replay
{
    private static async Task ReplayAsync(WorkflowHistory history)
    {
        // TODO(ch06): replay `history` against this worker's workflows (HelloWorker.Workflows), and let
        // it throw if they no longer match it: a WorkflowReplayer, with WorkflowReplayerOptions that
        // have Config.Converter and those workflows, and its ReplayWorkflowAsync(history).
        await Task.CompletedTask;
        throw new NotImplementedException("TODO(ch06): replay the history");
    }

    // The replayer the checks use for F12 (--provided), so a check of the patch doesn't need ReplayAsync written.
    private static Task ProvidedAsync(WorkflowHistory history)
    {
        var options = new WorkflowReplayerOptions { DataConverter = Config.Converter };
        foreach (var workflow in HelloWorker.Workflows) options.Workflows.Add(workflow);
        return new WorkflowReplayer(options).ReplayWorkflowAsync(history);
    }

    public static async Task<int> RunAsync(string[] args)
    {
        WorkflowHistory history;
        string name;
        if (args.Length >= 2 && args[0] == "--history")
        {
            name = args[1];
            history = WorkflowHistory.FromJson(Path.GetFileNameWithoutExtension(name), await File.ReadAllTextAsync(name));
        }
        else if (args.Length == 1)
        {
            var client = await Starter.ConnectAsync();
            var found = await Starter.LatestAsync(client, args[0], null);
            if (found == null)
            {
                Console.Error.WriteLine($"No workflow called {args[0]} or {args[0]}-…: start one first.");
                return 2;
            }
            name = found;
            history = await client.GetWorkflowHandle(found).FetchHistoryAsync();
        }
        else
        {
            Console.Error.WriteLine("usage: ./hello replay WORKFLOW_ID   (e.g. hold-15a, for the latest hold-15a-…)");
            return 2;
        }
        try
        {
            if (args.Contains("--provided")) await ProvidedAsync(history);
            else await ReplayAsync(history);
        }
        catch (WorkflowNondeterminismException err)
        {
            Console.Error.WriteLine($"✗ {name} doesn't replay on this code: it would break that workflow.\n  {err.Message}");
            return 1;
        }
        Console.WriteLine($"✓ {name} replays on this code: safe to deploy, as far as it's concerned.");
        return 0;
    }
}
