package hello;

import hello.Shared.BoardingRequest;
import hello.Shared.BoardingStatus;
import io.temporal.workflow.Workflow;
import java.time.Duration;
import org.slf4j.Logger;

/**
 * A durable counter: boarding a flight, one passenger at a time.   ./hello board SFO JFK
 *
 * <p>No activities, no database, no files: the count is a plain field of this workflow, and nothing
 * else keeps it. Stop the worker in the middle and start it again, and boarding carries on from the
 * next passenger, because a worker rebuilds the count by replaying the workflow's history.
 */
public class BoardingWorkflowImpl implements BoardingWorkflow {
    // The workflow's logger stays quiet while a worker replays the history, so after a restart the
    // log picks up at the next passenger instead of counting from 1 again.
    private static final Logger log = Workflow.getLogger(BoardingWorkflowImpl.class);

    private String flight = "";
    private int seats;
    // The only state there is. No one saves it: replaying the history puts it back.
    private int onBoard = 0;

    @Override
    public String run(BoardingRequest request) {
        flight = request.origin() + "→" + request.destination();
        seats = request.seats() == null ? 40 : request.seats();
        double pace = request.pace() == null ? 2 : request.pace();

        while (onBoard < seats) {
            // A durable timer: recorded in the history, so it fires even if the worker that
            // started it is gone.
            Workflow.sleep(Duration.ofMillis((long) (pace * 1000)));
            onBoard += 1;
            log.info("Boarded passenger {}/{}", onBoard, seats);
        }
        return "Flight " + flight + ": " + onBoard + " passengers boarded.";
    }

    // A query is answered by a worker, from the workflow's state; it never changes it.
    @Override
    public BoardingStatus boarded() {
        return new BoardingStatus(flight, onBoard, seats);
    }
}
