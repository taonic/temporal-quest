package hello;

import io.temporal.common.WorkflowExecutionHistory;
import io.temporal.testing.WorkflowReplayer;

/**
 * The replayer the checks use for F12 (./hello replay --history FILE --provided), so a check of the
 * patch doesn't need F13's replay() in Replay.java written. Not yours to edit.
 */
final class ProvidedReplayer {
    private ProvidedReplayer() {}

    static void replay(WorkflowExecutionHistory history) throws Exception {
        WorkflowReplayer.replayWorkflowExecution(history, HelloTripWorkflowImpl.class, BoardingWorkflowImpl.class,
                FareHoldWorkflowImpl.class, ItineraryWorkflowImpl.class, BookTripWorkflowImpl.class);
    }
}
