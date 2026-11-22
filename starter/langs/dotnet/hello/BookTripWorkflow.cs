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
            // TODO(ch06): an expired card shouldn't undo the trip. Charge the card in a loop: when
            // ChargeCardAsync fails with a CardExpired error, set waitingForNewCard, wait until the
            // new_card update clears it, and charge the new card. Let any other failure through.
            await Workflow.ExecuteActivityAsync((Activities act) => act.ChargeCardAsync(booking), Step);
            return $"Booked {flight} and {hotel}, paid with the card ending {booking.Card}.";
        }
        catch (ActivityFailureException)
        {
            // TODO(ch06): a step failed. Undo the steps that succeeded: await each one in `undo`, in
            // order (newest first), then throw the failure again.
            throw;
        }
    }

    // TODO(ch06): handle the new_card update, with a validator. NewCardAsync sets card to the
    // payment's card, clears waitingForNewCard, and returns "Charging the card ending ....".
    // ValidateNewCard turns away a card while the booking isn't waiting for one, a card that isn't
    // four digits, and the card that expired. (Until it's written, the validator turns every card away.)
    [WorkflowUpdate("new_card")]
    public Task<string> NewCardAsync(Payment payment) =>
        throw new NotImplementedException("TODO(ch06): handle the new_card update");

    [WorkflowUpdateValidator(nameof(NewCardAsync))]
    public void ValidateNewCard(Payment payment) =>
        throw new NotImplementedException("TODO(ch06): handle the new_card update, with a validator");

    // A query: which card it charges, and whether it's waiting for a new one.
    [WorkflowQuery("status")]
    public BookingStatus Status() => new(card, waitingForNewCard);
}
