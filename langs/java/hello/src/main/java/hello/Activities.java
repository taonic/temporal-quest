package hello;

import hello.Shared.Airport;
import hello.Shared.Booking;
import hello.Shared.HoldRequest;
import io.temporal.activity.ActivityInterface;
import io.temporal.activity.ActivityMethod;

/**
 * The activities: the one place these workflows touch the outside world. Each one's name is the
 * wire contract's (lookup_airport…): Java would call it LookupAirport otherwise.
 */
@ActivityInterface
public interface Activities {
    @ActivityMethod(name = "lookup_airport")
    Airport lookupAirport(String code);

    @ActivityMethod(name = "send_hold_email")
    void sendHoldEmail(HoldRequest hold);

    // The booking saga's: reserve a flight and a hotel, charge the card, and undo the reservations.
    @ActivityMethod(name = "reserve_flight")
    String reserveFlight(Booking booking);

    @ActivityMethod(name = "reserve_hotel")
    String reserveHotel(Booking booking);

    @ActivityMethod(name = "charge_card")
    String chargeCard(Booking booking);

    @ActivityMethod(name = "cancel_flight")
    void cancelFlight(String reservation);

    @ActivityMethod(name = "cancel_hotel")
    void cancelHotel(String reservation);
}
