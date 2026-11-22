package hello;

import hello.Shared.Itinerary;
import io.temporal.workflow.WorkflowInterface;
import io.temporal.workflow.WorkflowMethod;
import java.util.List;

/** An itinerary: a trip of several legs, each its own workflow. ItineraryWorkflowImpl is the code. */
@WorkflowInterface
public interface ItineraryWorkflow {
    @WorkflowMethod(name = "ItineraryWorkflow")
    List<String> run(Itinerary itinerary);
}
