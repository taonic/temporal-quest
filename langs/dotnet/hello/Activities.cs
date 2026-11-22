namespace Hello;

using Microsoft.Extensions.Logging;
using Temporalio.Activities;
using Temporalio.Exceptions;

// The activities: the one place these workflows touch the outside world. A real lookup would call
// an airport database over the network, which can be slow or fail: with FLAKY=1 this one fails
// four attempts out of five, so you can watch Temporal retry it. The booking activities stand in
// for an airline, a hotel and a card network: they only log what they'd do. Each activity's name is
// the wire contract's (lookup_airport…): .NET would call it LookupAirport otherwise.
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
    private static readonly int FlakyFailures = int.Parse(Config.Env("FLAKY_FAILURES", "4"));

    // A card that always declines, so you can watch the saga undo what it already did.
    public const string DeclinedCard = "0000";
    // A card that has expired, so you can watch the booking wait for the traveller's new one.
    public const string ExpiredCard = "1111";

    private static ILogger Log => ActivityExecutionContext.Current.Logger;

    [Activity("lookup_airport")]
    public Task<Airport> LookupAirportAsync(string code)
    {
        var attempt = ActivityExecutionContext.Current.Info.Attempt;
        Log.LogInformation("Looking up {Code} (attempt {Attempt})", code, attempt);
        if (Config.Env("FLAKY", "") == "1" && attempt <= FlakyFailures)
        {
            throw new InvalidOperationException(
                $"503: the airport database is overloaded ({code}, attempt {attempt}, FLAKY=1)");
        }
        return Airports.TryGetValue(code.ToUpperInvariant(), out var airport)
            ? Task.FromResult(airport)
            : throw new ArgumentException($"unknown airport {code}");
    }

    [Activity("send_hold_email")]
    public Task SendHoldEmailAsync(HoldRequest hold)
    {
        Log.LogInformation("Emailed the traveller: seat {Seat} is held for {Seconds}s", hold.Seat, Config.Number(hold.Seconds ?? 60));
        return Task.CompletedTask;
    }

    // --- The booking saga: reserve a flight and a hotel, then charge the card ---------------------

    [Activity("reserve_flight")]
    public Task<string> ReserveFlightAsync(Booking booking)
    {
        var reservation = $"FL-{booking.Origin}{booking.Destination}";
        Log.LogInformation("Reserved flight {Reservation}", reservation);
        return Task.FromResult(reservation);
    }

    [Activity("reserve_hotel")]
    public Task<string> ReserveHotelAsync(Booking booking)
    {
        var reservation = $"HT-{booking.Destination}";
        Log.LogInformation("Reserved hotel {Reservation}", reservation);
        return Task.FromResult(reservation);
    }

    [Activity("charge_card")]
    public Task<string> ChargeCardAsync(Booking booking)
    {
        if (booking.Card == DeclinedCard)
        {
            // Retrying won't change the bank's mind: a non-retryable failure fails the activity at
            // once, instead of the retry policy trying it again.
            throw new ApplicationFailureException($"card ending {booking.Card} was declined", errorType: "CardDeclined", nonRetryable: true);
        }
        if (booking.Card == ExpiredCard)
        {
            // Final too: no retry brings an expired card back. But the traveller can give another one.
            throw new ApplicationFailureException($"card ending {booking.Card} has expired", errorType: "CardExpired", nonRetryable: true);
        }
        Log.LogInformation("Charged the card ending {Card}", booking.Card);
        return Task.FromResult($"PAY-{booking.Card}");
    }

    [Activity("cancel_flight")]
    public Task CancelFlightAsync(string reservation)
    {
        Log.LogInformation("Cancelled flight {Reservation}", reservation);
        return Task.CompletedTask;
    }

    [Activity("cancel_hotel")]
    public Task CancelHotelAsync(string reservation)
    {
        Log.LogInformation("Cancelled hotel {Reservation}", reservation);
        return Task.CompletedTask;
    }
}
