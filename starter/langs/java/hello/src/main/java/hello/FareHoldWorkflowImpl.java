package hello;

import hello.Shared.HoldRequest;
import hello.Shared.HoldStatus;
import hello.Shared.Payment;
import io.temporal.activity.ActivityOptions;
import io.temporal.workflow.Workflow;
import java.time.Duration;

/**
 * A fare hold: a seat kept for you for a while, then let go.
 *
 * <pre>
 *   ./hello hold 12A [SECONDS]
 *   ./hello pay 12A 4242
 * </pre>
 *
 * <p>The hold waits for whichever comes first: a payment, or the end of the hold. Its id is the seat
 * (hold-12a-…), so there's one hold a seat, and {@code ./hello pay} finds it by the seat.
 */
public class FareHoldWorkflowImpl implements FareHoldWorkflow {
    private final Activities activities = Workflow.newActivityStub(Activities.class,
            ActivityOptions.newBuilder().setStartToCloseTimeout(Duration.ofSeconds(10)).build());

    private HoldRequest hold;
    private long expiresAt;
    // The card it was paid with, once it is.
    private String paidWith;

    @Override
    public String run(HoldRequest hold) {
        this.hold = hold;
        double seconds = hold.seconds() == null ? 60 : hold.seconds();
        // Workflow.currentTimeMillis() is the time in the history, not the machine's clock: the same on replay.
        expiresAt = Workflow.currentTimeMillis() + (long) (seconds * 1000);

        // TODO(ch06): email the traveller that the seat is held, with the send_hold_email activity
        // (sendHoldEmail), without breaking the holds that started before this step existed.

        // TODO(ch06): wait until the seat is paid for (paidWith), or the hold's seconds run out:
        //   boolean paid = Workflow.await(Duration.ofMillis(...), () -> ...);
        // Workflow.await returns false when the time runs out: return that the hold expired. Otherwise,
        // return that the seat is paid for.
        throw new UnsupportedOperationException("TODO(ch06): wait for a payment, or for the hold to run out");
    }

    // TODO(ch06): handle the pay update: record the payment's card in paidWith, and return a
    // confirmation. Its validator rejects a card that isn't four digits. (Until it's written, the
    // validator turns every payment away.)
    @Override
    public String pay(Payment payment) {
        throw new UnsupportedOperationException("TODO(ch06): handle the pay update");
    }

    @Override
    public void validatePay(Payment payment) {
        throw new UnsupportedOperationException("TODO(ch06): handle the pay update, with a validator");
    }

    @Override
    public HoldStatus status() {
        long remaining = Math.max(0, (expiresAt - Workflow.currentTimeMillis()) / 1000);
        return new HoldStatus(hold == null ? "" : hold.seat(), paidWith != null, (int) remaining);
    }
}
