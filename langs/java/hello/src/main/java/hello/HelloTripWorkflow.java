package hello;

import hello.Shared.TripRequest;
import io.temporal.workflow.WorkflowInterface;
import io.temporal.workflow.WorkflowMethod;

/** A trip: look up two airports, and describe it. HelloTripWorkflowImpl is the code. */
@WorkflowInterface
public interface HelloTripWorkflow {
    // The workflow type is the wire contract's, the name a client in any language starts it by.
    @WorkflowMethod(name = "HelloTripWorkflow")
    String run(TripRequest trip);
}
