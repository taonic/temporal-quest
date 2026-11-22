// A durable counter: boarding a flight, one passenger at a time.   npm run board -- SFO JFK
//
// No activities, no database, no files: the count is a plain number in this workflow, and nothing
// else keeps it. Stop the worker in the middle and start it again, and boarding carries on from
// the next passenger, because a worker rebuilds the count by replaying the workflow's history.
import { defineQuery, log, setHandler, sleep } from '@temporalio/workflow';
import type { BoardingRequest, BoardingStatus } from './shared';

// Read the count from the Temporal UI: the workflow's Queries tab, Query Type "boarded".
export const boarded = defineQuery<BoardingStatus>('boarded');

export async function BoardingWorkflow(request: BoardingRequest): Promise<string> {
  const flight = `${request.origin}→${request.destination}`;
  const seats = request.seats ?? 40;
  const pace = request.pace ?? 2;
  // The only state there is. No one saves it: replaying the history puts it back.
  let onBoard = 0;
  // A query is answered by a worker, from the workflow's state; it never changes it.
  setHandler(boarded, () => ({ flight, boarded: onBoard, seats }));

  while (onBoard < seats) {
    // A durable timer: recorded in the history, so it fires even if the worker that
    // started it is gone.
    await sleep(pace * 1000);
    onBoard += 1;
    // The workflow's log stays quiet while a worker replays the history, so after a restart
    // the log picks up at the next passenger instead of counting from 1 again.
    log.info(`Boarded passenger ${onBoard}/${seats}`);
  }
  return `Flight ${flight}: ${onBoard} passengers boarded.`;
}
