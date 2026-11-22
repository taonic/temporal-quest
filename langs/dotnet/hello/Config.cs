namespace Hello;

using System.Text.Json;
using System.Text.RegularExpressions;
using Temporalio.Converters;

// Where the worker and the starter find Temporal: the workshop's .env (as the Python side reads
// it), under anything already set in the environment. HELLO_TASK_QUEUE and WORKER_MODE are for the
// checks and the challenges: a queue of their own, and a worker with only workflows or activities.
public static class Config
{
    private static readonly Dictionary<string, string> DotEnv = ReadDotEnv();

    public static readonly string Address = Env("TEMPORAL_ADDRESS", "localhost:7233");
    public static readonly string Namespace = Env("TEMPORAL_NAMESPACE", "default");
    public static readonly string UiUrl = Env("TEMPORAL_UI_URL", "http://localhost:8233").TrimEnd('/');
    public static readonly string TaskQueue = Env("HELLO_TASK_QUEUE", "hello");
    public static readonly string Mode = Env("WORKER_MODE", "all");

    // The wire contract's field names are lowercase (origin, not Origin): the web defaults say so.
    public static readonly DataConverter Converter = DataConverter.Default with
    {
        PayloadConverter = new DefaultPayloadConverter(new JsonSerializerOptions(JsonSerializerDefaults.Web)),
    };

    // A setting: from the environment, else the workshop's .env, else `fallback`.
    public static string Env(string name, string fallback) =>
        Environment.GetEnvironmentVariable(name) ?? DotEnv.GetValueOrDefault(name) ?? fallback;

    // 20 for 20.0, 2.5 for 2.5: a number as a person would write it.
    public static string Number(double value) => value.ToString(System.Globalization.CultureInfo.InvariantCulture);

    // The repo's .env: this project is langs/dotnet/hello, three folders down.
    private static Dictionary<string, string> ReadDotEnv()
    {
        var values = new Dictionary<string, string>();
        var path = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", ".env"));
        if (!File.Exists(path)) return values;
        var line = new Regex(@"^\s*([A-Z_][A-Z0-9_]*)\s*=\s*([^#]*?)\s*(?:#.*)?$");
        foreach (var text in File.ReadAllLines(path))
        {
            var match = line.Match(text);
            if (match.Success) values[match.Groups[1].Value] = match.Groups[2].Value;
        }
        return values;
    }
}
