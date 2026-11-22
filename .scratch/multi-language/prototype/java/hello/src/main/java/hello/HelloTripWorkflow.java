package hello;

import io.temporal.workflow.WorkflowInterface;
import io.temporal.workflow.WorkflowMethod;

/** The workflow: a durable function that describes a trip. Its type is HelloTripWorkflow. */
@WorkflowInterface
public interface HelloTripWorkflow {
    @WorkflowMethod(name = "HelloTripWorkflow")
    String run(TripRequest trip);
}
