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

        // @@solution F12
        // A step added while holds were already running. getVersion records a marker when a run first
        // reaches this line on the new code, and returns 1; replaying a run that got past it without
        // the step, it returns DEFAULT_VERSION: so an old hold carries on as it was, and every new one
        // sends the email.
        int version = Workflow.getVersion("email-the-hold", Workflow.DEFAULT_VERSION, 1);
        if (version == 1) {
            activities.sendHoldEmail(hold);
        }
        // @@starter
        // TODO(ch06): email the traveller that the seat is held, with the send_hold_email activity
        // (sendHoldEmail), without breaking the holds that started before this step existed.
        // @@end

        // @@solution F8
        // Wait until the seat is paid for, or until the hold runs out, whichever comes first.
        // The timeout is a durable timer: Temporal keeps it, so it fires even with no worker running.
        boolean paid = Workflow.await(Duration.ofMillis((long) (seconds * 1000)), () -> paidWith != null);
        if (!paid) return "Seat " + hold.seat() + ": the hold expired, and the seat is back on sale.";
        return "Seat " + hold.seat() + ": paid with the card ending " + paidWith + ". It's yours.";
        // @@starter
        // TODO(ch06): wait until the seat is paid for (paidWith), or the hold's seconds run out:
        //   boolean paid = Workflow.await(Duration.ofMillis(...), () -> ...);
        // Workflow.await returns false when the time runs out: return that the hold expired. Otherwise,
        // return that the seat is paid for.
        throw new UnsupportedOperationException("TODO(ch06): wait for a payment, or for the hold to run out");
        // @@end
    }

    // @@solution F9
    // An update: a message that changes the workflow, and gets an answer back.
    @Override
    public String pay(Payment payment) {
        paidWith = payment.card();
        return "Paid for seat " + hold.seat() + ".";
    }

    // Its validator runs first, and a payment it rejects is never written to the history.
    @Override
    public void validatePay(Payment payment) {
        if (!payment.card().matches("\\d{4}")) {
            throw new IllegalArgumentException("give the card's last four digits, not '" + payment.card() + "'");
        }
        if (paidWith != null) throw new IllegalStateException("seat " + hold.seat() + " is already paid for");
    }
    // @@starter
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
    // @@end

    @Override
    public HoldStatus status() {
        long remaining = Math.max(0, (expiresAt - Workflow.currentTimeMillis()) / 1000);
        return new HoldStatus(hold == null ? "" : hold.seat(), paidWith != null, (int) remaining);
    }
}
