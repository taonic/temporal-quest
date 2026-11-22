namespace Hello;

using Temporalio.Workflows;

// A fare hold: a seat kept for you for a while, then let go.
//
//   ./hello hold 12A [SECONDS]
//   ./hello pay 12A 4242
//
// The hold waits for whichever comes first: a payment, or the end of the hold. Its id is the seat
// (hold-12a-…), so there's one hold a seat, and `./hello pay` finds it by the seat.
[Workflow("FareHoldWorkflow")]
public class FareHoldWorkflow
{
    private static readonly ActivityOptions Step = new() { StartToCloseTimeout = TimeSpan.FromSeconds(10) };

    private HoldRequest? hold;
    private DateTime expiresAt;
    // The card it was paid with, once it is.
    private string? paidWith;

    [WorkflowRun]
    public async Task<string> RunAsync(HoldRequest hold)
    {
        this.hold = hold;
        var seconds = hold.Seconds ?? 60;
        // Workflow.UtcNow is the time in the history, not the machine's clock: the same on replay.
        expiresAt = Workflow.UtcNow.AddSeconds(seconds);

        // TODO(ch06): email the traveller that the seat is held, with the send_hold_email activity
        // (SendHoldEmailAsync), without breaking the holds that started before this step existed.

        // TODO(ch06): wait until the seat is paid for (paidWith), or the hold's seconds run out:
        //   var paid = await Workflow.WaitConditionAsync(() => ..., TimeSpan.FromSeconds(seconds));
        // WaitConditionAsync returns false when the time runs out: return that the hold expired.
        // Otherwise, return that the seat is paid for.
        throw new NotImplementedException("TODO(ch06): wait for a payment, or for the hold to run out");
    }

    // TODO(ch06): handle the pay update: record the payment's card in paidWith, and return a
    // confirmation. Its validator rejects a card that isn't four digits. (Until it's written, the
    // validator turns every payment away.)
    [WorkflowUpdate("pay")]
    public Task<string> PayAsync(Payment payment) =>
        throw new NotImplementedException("TODO(ch06): handle the pay update");

    [WorkflowUpdateValidator(nameof(PayAsync))]
    public void ValidatePay(Payment payment) =>
        throw new NotImplementedException("TODO(ch06): handle the pay update, with a validator");

    // A query: read the hold's state, without changing it.
    [WorkflowQuery("status")]
    public HoldStatus Status() =>
        new(hold?.Seat ?? "", paidWith != null, (int)Math.Max(0, (expiresAt - Workflow.UtcNow).TotalSeconds));
}
