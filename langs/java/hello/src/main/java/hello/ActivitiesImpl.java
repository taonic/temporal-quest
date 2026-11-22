package hello;

import hello.Shared.Airport;
import hello.Shared.Booking;
import hello.Shared.HoldRequest;
import io.temporal.activity.Activity;
import io.temporal.failure.ApplicationFailure;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A real lookup would call an airport database over the network, which can be slow or fail: with
 * FLAKY=1 this one fails four attempts out of five, so you can watch Temporal retry it. The booking
 * activities stand in for an airline, a hotel and a card network: they only log what they'd do.
 */
public class ActivitiesImpl implements Activities {
    private static final Logger log = LoggerFactory.getLogger(ActivitiesImpl.class);

    private static final Map<String, Airport> AIRPORTS = Map.of(
            "SFO", new Airport("SFO", "San Francisco International", "San Francisco"),
            "JFK", new Airport("JFK", "John F. Kennedy International", "New York"),
            "LAX", new Airport("LAX", "Los Angeles International", "Los Angeles"),
            "ORD", new Airport("ORD", "O'Hare International", "Chicago"),
            "SEA", new Airport("SEA", "Seattle-Tacoma International", "Seattle"),
            "LHR", new Airport("LHR", "Heathrow", "London"));

    // With FLAKY=1, attempts 1 to 4 fail and attempt 5 gets through. The checks set FLAKY_FAILURES=1.
    private static final int FLAKY_FAILURES = Integer.parseInt(Config.env("FLAKY_FAILURES", "4"));

    /** A card that always declines, so you can watch the saga undo what it already did. */
    public static final String DECLINED_CARD = "0000";
    /** A card that has expired, so you can watch the booking wait for the traveller's new one. */
    public static final String EXPIRED_CARD = "1111";

    @Override
    public Airport lookupAirport(String code) {
        int attempt = Activity.getExecutionContext().getInfo().getAttempt();
        log.info("Looking up {} (attempt {})", code, attempt);
        if ("1".equals(Config.env("FLAKY", "")) && attempt <= FLAKY_FAILURES) {
            throw new RuntimeException(
                    "503: the airport database is overloaded (" + code + ", attempt " + attempt + ", FLAKY=1)");
        }
        Airport airport = AIRPORTS.get(code.toUpperCase());
        if (airport == null) {
            throw new IllegalArgumentException("unknown airport " + code);
        }
        return airport;
    }

    @Override
    public void sendHoldEmail(HoldRequest hold) {
        double seconds = hold.seconds() == null ? 60 : hold.seconds();
        log.info("Emailed the traveller: seat {} is held for {}s", hold.seat(), Config.number(seconds));
    }

    @Override
    public String reserveFlight(Booking booking) {
        String reservation = "FL-" + booking.origin() + booking.destination();
        log.info("Reserved flight {}", reservation);
        return reservation;
    }

    @Override
    public String reserveHotel(Booking booking) {
        String reservation = "HT-" + booking.destination();
        log.info("Reserved hotel {}", reservation);
        return reservation;
    }

    @Override
    public String chargeCard(Booking booking) {
        if (DECLINED_CARD.equals(booking.card())) {
            // Retrying won't change the bank's mind: a non-retryable failure fails the activity at
            // once, instead of the retry policy trying it again.
            throw ApplicationFailure.newNonRetryableFailure(
                    "card ending " + booking.card() + " was declined", "CardDeclined");
        }
        if (EXPIRED_CARD.equals(booking.card())) {
            // Final too: no retry brings an expired card back. But the traveller can give another one.
            throw ApplicationFailure.newNonRetryableFailure(
                    "card ending " + booking.card() + " has expired", "CardExpired");
        }
        log.info("Charged the card ending {}", booking.card());
        return "PAY-" + booking.card();
    }

    @Override
    public void cancelFlight(String reservation) {
        log.info("Cancelled flight {}", reservation);
    }

    @Override
    public void cancelHotel(String reservation) {
        log.info("Cancelled hotel {}", reservation);
    }
}
