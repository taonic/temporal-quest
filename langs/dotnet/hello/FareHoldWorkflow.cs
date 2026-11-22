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

        // A step added while holds were already running. Patched() is true for a run that reaches
        // this line on the new code, and false when replaying a run that got past it without the
        // step: so an old hold carries on as it was, and every new one sends the email.
        if (Workflow.Patched("email-the-hold"))
        {
            await Workflow.ExecuteActivityAsync((Activities act) => act.SendHoldEmailAsync(hold), Step);
        }

        // Wait until the seat is paid for, or until the hold runs out, whichever comes first.
        // The timeout is a durable timer: Temporal keeps it, so it fires even with no worker running.
        var paid = await Workflow.WaitConditionAsync(() => paidWith != null, TimeSpan.FromSeconds(seconds));
        if (!paid) return $"Seat {hold.Seat}: the hold expired, and the seat is back on sale.";
        return $"Seat {hold.Seat}: paid with the card ending {paidWith}. It's yours.";
    }

    // An update: a message that changes the workflow, and gets an answer back.
    [WorkflowUpdate("pay")]
    public Task<string> PayAsync(Payment payment)
    {
        paidWith = payment.Card;
        return Task.FromResult($"Paid for seat {hold!.Seat}.");
    }

    // Its validator runs first, and a payment it rejects is never written to the history.
    [WorkflowUpdateValidator(nameof(PayAsync))]
    public void ValidatePay(Payment payment)
    {
        if (payment.Card.Length != 4 || !payment.Card.All(char.IsAsciiDigit))
        {
            throw new ArgumentException($"give the card's last four digits, not '{payment.Card}'");
        }
        if (paidWith != null) throw new InvalidOperationException($"seat {hold!.Seat} is already paid for");
    }

    // A query: read the hold's state, without changing it.
    [WorkflowQuery("status")]
    public HoldStatus Status() =>
        new(hold?.Seat ?? "", paidWith != null, (int)Math.Max(0, (expiresAt - Workflow.UtcNow).TotalSeconds));
}
