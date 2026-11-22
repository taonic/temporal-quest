package hello;

import java.util.List;

/**
 * What the workflows, activities, worker and starter share. The field names are the wire
 * contract's (hello/CONTRACT.md): a Python client starts these workflows, and the checks read them.
 * A field that may be left out is boxed (Integer, Double), so it can be null.
 */
public final class Shared {
    private Shared() {}

    public record TripRequest(String origin, String destination) {}

    public record Airport(String code, String name, String city) {}

    /** {@code seats} defaults to 40, and {@code pace} (seconds between passengers) to 2. */
    public record BoardingRequest(String origin, String destination, Integer seats, Double pace) {}

    public record BoardingStatus(String flight, int boarded, int seats) {}

    /** {@code seconds}: how long the hold lasts, 60 by default. */
    public record HoldRequest(String seat, Double seconds) {}

    /** {@code remaining}: seconds until the hold runs out. */
    public record HoldStatus(String seat, boolean paid, int remaining) {}

    /** The card's last four digits: all a hold needs to show it's paid. */
    public record Payment(String card) {}

    /** Airport codes, in order: SFO JFK LHR is two legs, SFO→JFK and JFK→LHR. */
    public record Itinerary(List<String> stops) {}

    public record Booking(String origin, String destination, String card) {}

    /** The card it charges, and whether it's waiting for a new one because that card has expired. */
    public record BookingStatus(String card, boolean waiting) {}
}
