namespace Hello;

using Temporalio.Exceptions;
using Temporalio.Workflows;

// A booking, as a saga: reserve a flight and a hotel, then charge the card.
//
//   ./hello book SFO JFK 4242
//   ./hello book SFO JFK 0000     (a card that's declined)
//   ./hello book SFO JFK 1111     (a card that's expired)
//
// There's no transaction across an airline, a hotel and a bank. So each step that succeeds adds
// the step that undoes it, and when a later step fails, the saga runs those, newest first.
[Workflow("BookTripWorkflow")]
public class BookTripWorkflow
{
    private static readonly ActivityOptions Step = new() { StartToCloseTimeout = TimeSpan.FromSeconds(10) };

    // The card it charges: the traveller's new one, once they give it.
    private string card = "";
    // True while the card has expired and the booking waits for a new one.
    private bool waitingForNewCard = false;

    [WorkflowRun]
    public async Task<string> RunAsync(Booking booking)
    {
        card = booking.Card;
        // What to run to undo each step that succeeded, newest first.
        var undo = new List<Func<Task>>();
        try
        {
            var flight = await Workflow.ExecuteActivityAsync((Activities act) => act.ReserveFlightAsync(booking), Step);
            undo.Insert(0, () => Workflow.ExecuteActivityAsync((Activities act) => act.CancelFlightAsync(flight), Step));
            var hotel = await Workflow.ExecuteActivityAsync((Activities act) => act.ReserveHotelAsync(booking), Step);
            undo.Insert(0, () => Workflow.ExecuteActivityAsync((Activities act) => act.CancelHotelAsync(hotel), Step));
            // Charge the card. An expired one isn't the end: wait for the traveller's new card, for as
            // long as it takes, then charge that. Anything else goes on to the undo below.
            while (true)
            {
                try
                {
                    await Workflow.ExecuteActivityAsync((Activities act) => act.ChargeCardAsync(booking), Step);
                    break;
                }
                catch (ActivityFailureException err) when (err.InnerException is ApplicationFailureException { ErrorType: "CardExpired" })
                {
                    waitingForNewCard = true;
                    await Workflow.WaitConditionAsync(() => !waitingForNewCard);
                    booking = booking with { Card = card };
                }
            }
            return $"Booked {flight} and {hotel}, paid with the card ending {booking.Card}.";
        }
        catch (ActivityFailureException)
        {
            // A step failed: undo the ones that succeeded, newest first, then fail the booking.
            // The undo steps are activities too, so they're retried, and survive a crash.
            foreach (var compensate in undo)
            {
                await compensate();
            }
            throw;
        }
    }

    // The new_card update: it clears the flag the charge loop waits on.
    [WorkflowUpdate("new_card")]
    public Task<string> NewCardAsync(Payment payment)
    {
        card = payment.Card;
        waitingForNewCard = false;
        return Task.FromResult($"Charging the card ending {payment.Card}.");
    }

    // Its validator runs first, and a card it turns away is never written to the history.
    [WorkflowUpdateValidator(nameof(NewCardAsync))]
    public void ValidateNewCard(Payment payment)
    {
        if (!waitingForNewCard) throw new InvalidOperationException("this booking isn't waiting for a new card");
        if (payment.Card.Length != 4 || !payment.Card.All(char.IsAsciiDigit))
        {
            throw new ArgumentException($"give the card's last four digits, not '{payment.Card}'");
        }
        if (payment.Card == card) throw new ArgumentException($"the card ending {payment.Card} is the one that expired");
    }

    // A query: which card it charges, and whether it's waiting for a new one.
    [WorkflowQuery("status")]
    public BookingStatus Status() => new(card, waitingForNewCard);
}
