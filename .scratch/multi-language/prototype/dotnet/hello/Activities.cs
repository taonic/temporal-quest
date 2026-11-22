namespace Hello;

using Microsoft.Extensions.Logging;
using Temporalio.Activities;

// The activities: the one place these workflows touch the outside world. With FLAKY=1 the lookup
// fails four attempts out of five, so you can watch Temporal retry it.
public class Activities
{
    private static readonly Dictionary<string, Airport> Airports = new()
    {
        ["SFO"] = new("SFO", "San Francisco International", "San Francisco"),
        ["JFK"] = new("JFK", "John F. Kennedy International", "New York"),
        ["LAX"] = new("LAX", "Los Angeles International", "Los Angeles"),
        ["ORD"] = new("ORD", "O'Hare International", "Chicago"),
        ["SEA"] = new("SEA", "Seattle-Tacoma International", "Seattle"),
        ["LHR"] = new("LHR", "Heathrow", "London"),
    };

    // With FLAKY=1, attempts 1 to 4 fail and attempt 5 gets through. The checks set FLAKY_FAILURES=1.
    private static readonly int FlakyFailures =
        int.Parse(Environment.GetEnvironmentVariable("FLAKY_FAILURES") ?? "4");

    // The activity's name is the wire contract's: .NET would call it LookupAirport otherwise.
    [Activity("lookup_airport")]
    public Task<Airport> LookupAirportAsync(string code)
    {
        var attempt = ActivityExecutionContext.Current.Info.Attempt;
        ActivityExecutionContext.Current.Logger.LogInformation("Looking up {Code} (attempt {Attempt})", code, attempt);
        if (Environment.GetEnvironmentVariable("FLAKY") == "1" && attempt <= FlakyFailures)
        {
            throw new InvalidOperationException(
                $"503: the airport database is overloaded ({code}, attempt {attempt}, FLAKY=1)");
        }
        return Airports.TryGetValue(code.ToUpperInvariant(), out var airport)
            ? Task.FromResult(airport)
            : throw new ArgumentException($"unknown airport {code}");
    }
}
