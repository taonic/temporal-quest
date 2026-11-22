package hello;

import io.temporal.activity.Activity;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** A real lookup would call an airport database. With FLAKY=1 it fails four attempts in five. */
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
    private static final int FLAKY_FAILURES =
            Integer.parseInt(System.getenv().getOrDefault("FLAKY_FAILURES", "4"));

    @Override
    public Airport lookupAirport(String code) {
        int attempt = Activity.getExecutionContext().getInfo().getAttempt();
        log.info("Looking up {} (attempt {})", code, attempt);
        if ("1".equals(System.getenv("FLAKY")) && attempt <= FLAKY_FAILURES) {
            throw new RuntimeException(
                    "503: the airport database is overloaded (" + code + ", attempt " + attempt + ", FLAKY=1)");
        }
        Airport airport = AIRPORTS.get(code.toUpperCase());
        if (airport == null) {
            throw new IllegalArgumentException("unknown airport " + code);
        }
        return airport;
    }
}
