package hello;

import hello.Shared.Booking;
import hello.Shared.BookingStatus;
import hello.Shared.Payment;
import io.temporal.activity.ActivityOptions;
import io.temporal.failure.ActivityFailure;
import io.temporal.failure.ApplicationFailure;
import io.temporal.workflow.Workflow;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;

/**
 * A booking, as a saga: reserve a flight and a hotel, then charge the card.
 *
 * <pre>
 *   ./hello book SFO JFK 4242
 *   ./hello book SFO JFK 0000     (a card that's declined)
 *   ./hello book SFO JFK 1111     (a card that's expired)
 * </pre>
 *
 * <p>There's no transaction across an airline, a hotel and a bank. So each step that succeeds adds
 * the step that undoes it, and when a later step fails, the saga runs those, newest first.
 */
public class BookTripWorkflowImpl implements BookTripWorkflow {
    private final Activities activities = Workflow.newActivityStub(Activities.class,
            ActivityOptions.newBuilder().setStartToCloseTimeout(Duration.ofSeconds(10)).build());

    // The card it charges: the traveller's new one, once they give it.
    private String card;
    // True while the card has expired and the booking waits for a new one.
    private boolean waitingForNewCard = false;

    @Override
    public String run(Booking booking) {
        card = booking.card();
        // What to run to undo each step that succeeded, newest first.
        Deque<Runnable> undo = new ArrayDeque<>();
        try {
            String flight = activities.reserveFlight(booking);
            undo.push(() -> activities.cancelFlight(flight));
            String hotel = activities.reserveHotel(booking);
            undo.push(() -> activities.cancelHotel(hotel));
            // @@solution F14
            // Charge the card. An expired one isn't the end: wait for the traveller's new card, for as
            // long as it takes, then charge that. Anything else goes on to the undo below.
            while (true) {
                try {
                    activities.chargeCard(booking);
                    break;
                } catch (ActivityFailure err) {
                    if (!(err.getCause() instanceof ApplicationFailure failure && failure.getType().equals("CardExpired"))) {
                        throw err;
                    }
                    waitingForNewCard = true;
                    Workflow.await(() -> !waitingForNewCard);
                    booking = new Booking(booking.origin(), booking.destination(), card);
                }
            }
            // @@starter
            // TODO(ch06): an expired card shouldn't undo the trip. Charge the card in a loop: when
            // chargeCard fails with a CardExpired error, set waitingForNewCard, wait until the new_card
            // update clears it, and charge the new card. Throw any other failure again.
            activities.chargeCard(booking);
            // @@end
            return "Booked " + flight + " and " + hotel + ", paid with the card ending " + booking.card() + ".";
        } catch (ActivityFailure err) {
            // @@solution F11
            // A step failed: undo the ones that succeeded, newest first, then fail the booking.
            // The undo steps are activities too, so they're retried, and survive a crash.
            for (Runnable compensate : undo) {
                compensate.run();
            }
            throw err;
            // @@starter
            // TODO(ch06): a step failed. Undo the steps that succeeded: run each one in `undo`, in
            // order (newest first), then throw the failure again.
            throw err;
            // @@end
        }
    }

    // @@solution F14
    // The new_card update: it clears the flag the charge loop waits on.
    @Override
    public String newCard(Payment payment) {
        card = payment.card();
        waitingForNewCard = false;
        return "Charging the card ending " + payment.card() + ".";
    }

    // Its validator runs first, and a card it turns away is never written to the history.
    @Override
    public void validateNewCard(Payment payment) {
        if (!waitingForNewCard) throw new IllegalStateException("this booking isn't waiting for a new card");
        if (!payment.card().matches("\\d{4}")) {
            throw new IllegalArgumentException("give the card's last four digits, not '" + payment.card() + "'");
        }
        if (payment.card().equals(card)) {
            throw new IllegalArgumentException("the card ending " + payment.card() + " is the one that expired");
        }
    }
    // @@starter
    // TODO(ch06): handle the new_card update, with a validator. newCard sets card to the payment's
    // card, clears waitingForNewCard, and returns "Charging the card ending ....". validateNewCard
    // turns away a card while the booking isn't waiting for one, a card that isn't four digits, and
    // the card that expired. (Until it's written, the validator turns every card away.)
    @Override
    public String newCard(Payment payment) {
        throw new UnsupportedOperationException("TODO(ch06): handle the new_card update");
    }

    @Override
    public void validateNewCard(Payment payment) {
        throw new UnsupportedOperationException("TODO(ch06): handle the new_card update, with a validator");
    }
    // @@end

    @Override
    public BookingStatus status() {
        return new BookingStatus(card, waitingForNewCard);
    }
}
