package hello;

import hello.Shared.Itinerary;
import hello.Shared.TripRequest;
import io.temporal.workflow.Async;
import io.temporal.workflow.ChildWorkflowOptions;
import io.temporal.workflow.Promise;
import io.temporal.workflow.Workflow;
import java.util.ArrayList;
import java.util.List;

/**
 * An itinerary: a trip of several legs, each its own workflow.   ./hello itinerary SFO JFK LHR
 *
 * <p>SFO JFK LHR is two legs, SFO→JFK and JFK→LHR. The itinerary starts a child workflow for each,
 * all at once, and puts their answers together. Each child is a HelloTripWorkflow, with a history of
 * its own.
 */
public class ItineraryWorkflowImpl implements ItineraryWorkflow {
    @Override
    public List<String> run(Itinerary itinerary) {
        List<String> stops = itinerary.stops();
        // Every leg at once: each is a Promise, started now; get() waits for its answer, in order.
        List<Promise<String>> legs = new ArrayList<>();
        for (int n = 1; n < stops.size(); n++) {
            legs.add(leg(n, stops.get(n - 1), stops.get(n)));
        }
        return legs.stream().map(Promise::get).toList();
    }

    private Promise<String> leg(int n, String origin, String destination) {
        // @@solution F10
        // A child workflow: started, and waited for, by this one. Its id is this workflow's, plus
        // the leg, so each leg is easy to find, and starting the same leg twice is refused.
        HelloTripWorkflow child = Workflow.newChildWorkflowStub(HelloTripWorkflow.class,
                ChildWorkflowOptions.newBuilder()
                        .setWorkflowId(Workflow.getInfo().getWorkflowId() + "-leg-" + n)
                        .build());
        return Async.function(child::run, new TripRequest(origin, destination));
        // @@starter
        // TODO(ch06): run this leg as a child HelloTripWorkflow, started now (Async.function), and
        // return its Promise. Make its stub with Workflow.newChildWorkflowStub, and give it an id made
        // of this workflow's id (Workflow.getInfo().getWorkflowId()) and the leg's number.
        throw new UnsupportedOperationException(
                "TODO(ch06): run the leg as a child workflow (" + n + ": " + origin + " to " + destination + ")");
        // @@end
    }
}
