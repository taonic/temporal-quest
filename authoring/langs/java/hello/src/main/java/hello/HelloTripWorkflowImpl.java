package hello;

import hello.Shared.Airport;
import hello.Shared.TripRequest;
import io.temporal.activity.ActivityOptions;
import io.temporal.common.RetryOptions;
import io.temporal.workflow.Workflow;
import java.time.Duration;

/**
 * The trip workflow: a durable function. Workflow code must be deterministic: Temporal may replay
 * it from its history at any time, on any worker. So it never touches the outside world itself. It
 * asks for that through activities, and Temporal records each result.
 */
public class HelloTripWorkflowImpl implements HelloTripWorkflow {
    @Override
    public String run(TripRequest trip) {
        Airport origin = airport(trip.origin());
        Airport destination = airport(trip.destination());
        return "Your trip: " + origin.city() + " (" + origin.code() + ") to "
                + destination.city() + " (" + destination.code() + ").";
    }

    private Airport airport(String code) {
        // @@solution F2
        // Ask Temporal to run the activity. Its result is recorded in the workflow's history,
        // so a replay reuses the result instead of running the activity again.
        Activities activities = Workflow.newActivityStub(Activities.class, ActivityOptions.newBuilder()
                // How long one attempt may take before Temporal times it out and tries again.
                .setStartToCloseTimeout(Duration.ofSeconds(10))
                // Failed attempts are retried for you: wait 2s, then twice as long each time, up to 6s.
                .setRetryOptions(RetryOptions.newBuilder()
                        .setInitialInterval(Duration.ofSeconds(2))
                        .setBackoffCoefficient(2)
                        .setMaximumInterval(Duration.ofSeconds(6))
                        .build())
                .build());
        return activities.lookupAirport(code);
        // @@starter
        // TODO(ch01): call the lookup_airport activity (lookupAirport, on an activity stub), with a
        // 10-second start-to-close timeout and a retry policy: wait 2 seconds after a failure, twice as
        // long each time, at most 6 seconds.
        throw new UnsupportedOperationException("TODO(ch01): call the lookup_airport activity (" + code + ")");
        // @@end
    }
}
