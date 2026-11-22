package hello;

import hello.Shared.HoldRequest;
import hello.Shared.HoldStatus;
import hello.Shared.Payment;
import io.temporal.workflow.QueryMethod;
import io.temporal.workflow.UpdateMethod;
import io.temporal.workflow.UpdateValidatorMethod;
import io.temporal.workflow.WorkflowInterface;
import io.temporal.workflow.WorkflowMethod;

/** A fare hold: a seat kept for you for a while, then let go. FareHoldWorkflowImpl is the code. */
@WorkflowInterface
public interface FareHoldWorkflow {
    @WorkflowMethod(name = "FareHoldWorkflow")
    String run(HoldRequest hold);

    // An update: pay for the seat, and get an answer back.
    @UpdateMethod(name = "pay")
    String pay(Payment payment);

    // The update's validator: it runs first, and an update it rejects is never written to the history.
    @UpdateValidatorMethod(updateName = "pay")
    void validatePay(Payment payment);

    // A query: read the hold's state, without changing it.
    @QueryMethod(name = "status")
    HoldStatus status();
}
