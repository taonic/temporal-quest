namespace Hello;

using Microsoft.Extensions.Logging;

// A log you can read, for the worker and the replayer: the time, the level and one line a message,
// with an error's root cause (the exception your code threw) and not its stack trace. Yours, the
// workflows' and the activities' at Information; the SDK's own at Warning, which is where it says
// that a workflow task or an activity failed.
public sealed class ConsoleLog : ILoggerProvider, ILogger
{
    public static ILoggerFactory Factory() => LoggerFactory.Create(b => b.ClearProviders().AddProvider(new ConsoleLog()).SetMinimumLevel(LogLevel.Information));

    private string category = "";
    private static readonly string[] Last = { "" };
    private static DateTime lastAt;

    public ILogger CreateLogger(string categoryName) => new ConsoleLog { category = categoryName };

    public void Dispose() { }

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    // The SDK's own chatter at Warning and up; workflows' and activities' loggers at Information.
    public bool IsEnabled(LogLevel level) =>
        level >= (category.StartsWith("Temporalio.Workflow") || category.StartsWith("Temporalio.Activity") || category.StartsWith("Hello")
            ? LogLevel.Information
            : LogLevel.Warning);

    public void Log<TState>(LogLevel level, EventId id, TState state, Exception? error, Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(level)) return;
        var message = formatter(state, error);
        // The SDK's words for a workflow task that threw: the workflow itself is still running, and
        // Temporal retries the task.
        if (message.StartsWith("Failed handling activation") || message.StartsWith("Failed activation"))
        {
            message = "Workflow task failed (the workflow waits, and it is retried)";
        }
        else if (message.StartsWith("Completing activity as failed"))
        {
            message = "Activity failed";
        }
        if (error != null)
        {
            var root = error;
            while (root.InnerException != null) root = root.InnerException;
            message += ": " + root.Message;
        }
        var label = level switch
        {
            LogLevel.Warning => "WARN",
            LogLevel.Error or LogLevel.Critical => "ERROR",
            _ => "INFO",
        };
        // The SDK says a failed workflow task twice: once is enough.
        var line = $"{label} {message}";
        lock (Last)
        {
            if (line == Last[0] && DateTime.Now - lastAt < TimeSpan.FromSeconds(1)) return;
            Last[0] = line;
            lastAt = DateTime.Now;
        }
        Console.WriteLine($"{DateTime.Now:HH:mm:ss} {line}");
    }
}
