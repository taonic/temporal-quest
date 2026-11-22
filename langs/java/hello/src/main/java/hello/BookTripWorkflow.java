package hello;

import hello.Shared.Booking;
import hello.Shared.BookingStatus;
import hello.Shared.Payment;
import io.temporal.workflow.QueryMethod;
import io.temporal.workflow.UpdateMethod;
import io.temporal.workflow.UpdateValidatorMethod;
import io.temporal.workflow.WorkflowInterface;
import io.temporal.workflow.WorkflowMethod;

/** A booking, as a saga: reserve a flight and a hotel, then charge the card. BookTripWorkflowImpl is the code. */
@WorkflowInterface
public interface BookTripWorkflow {
    @WorkflowMethod(name = "BookTripWorkflow")
    String run(Booking booking);

    // An update: the traveller's new card.
    @UpdateMethod(name = "new_card")
    String newCard(Payment payment);

    @UpdateValidatorMethod(updateName = "new_card")
    void validateNewCard(Payment payment);

    // A query: which card it charges, and whether it's waiting for a new one.
    @QueryMethod(name = "status")
    BookingStatus status();
}
