package hello;

import hello.Shared.BoardingRequest;
import hello.Shared.BoardingStatus;
import io.temporal.workflow.QueryMethod;
import io.temporal.workflow.WorkflowInterface;
import io.temporal.workflow.WorkflowMethod;

/** A durable counter: boarding a flight, one passenger at a time. BoardingWorkflowImpl is the code. */
@WorkflowInterface
public interface BoardingWorkflow {
    @WorkflowMethod(name = "BoardingWorkflow")
    String run(BoardingRequest request);

    // Read the count from the Temporal UI: the workflow's Queries tab, Query Type "boarded".
    @QueryMethod(name = "boarded")
    BoardingStatus boarded();
}
