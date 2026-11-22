// The client: start a workflow, and wait for its result (or, for a hold, start it and return).
//
//   npm run start -- SFO JFK             a trip
//   npm run board -- SFO JFK [40]        a boarding
//   npm run hold -- 12A [SECONDS]        a fare hold, for 60 seconds unless you say
//   npm run pay -- 12A 4242              pay for seat 12A's hold
//   npm run itinerary -- SFO JFK LHR     a trip of several legs
//   npm run book -- SFO JFK 4242         a booking (0000 is declined, 1111 has expired)
//
// Starting a workflow only records it; a worker runs it. With no worker, it waits.
import { Client, Connection, WorkflowFailedError, WorkflowHandle, WorkflowUpdateFailedError } from '@temporalio/client';
import { randomUUID } from 'node:crypto';
import { address, namespace, taskQueue, uiUrl } from './config';
import type { BoardingRequest, Booking, BookingStatus, HoldRequest, TripRequest } from './shared';

const short = () => randomUUID().slice(0, 4);

const link = (workflowId: string) => `${uiUrl}/namespaces/${namespace}/workflows/${workflowId}`;

// Prints where the workflow is, waits for its result, and prints that. `stop`, if given, is asked
// every second whether to stop waiting (and says why if so).
async function waitFor(handle: WorkflowHandle, stop?: () => Promise<boolean>): Promise<void> {
  console.log(`Started ${handle.workflowId}: ${link(handle.workflowId)}`);
  console.log('Waiting for the result...');
  const result = handle.result();
  while (stop) {
    const done = await Promise.race([result.then(() => true, () => true), new Promise<false>((r) => setTimeout(() => r(false), 1000))]);
    if (done) break;
    if (await stop()) return;
  }
  try {
    const value = await result;
    console.log(Array.isArray(value) ? value.join('\n') : value);
  } catch (err) {
    if (!(err instanceof WorkflowFailedError)) throw err;
    console.error(`The workflow failed: ${(err.cause?.cause as Error | undefined)?.message ?? err.cause?.message ?? err.message}`);
    process.exit(1);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const client = new Client({ connection: await Connection.connect({ address }), namespace });
  const up = args.map((a) => a.toUpperCase());

  if (command === 'hold') {
    // Starts the hold and returns: the hold waits, not this terminal, so you can pay for it here.
    const [seat = '12A', seconds = '60'] = up;
    const request: HoldRequest = { seat, seconds: Number(seconds) };
    const workflowId = `hold-${seat.toLowerCase()}-${short()}`;
    await client.workflow.start('FareHoldWorkflow', { args: [request], taskQueue, workflowId });
    console.log(`Holding seat ${seat} for ${Number(seconds)}s: ${workflowId}: ${link(workflowId)}`);
    console.log(`Pay for it with: npm run pay -- ${seat} 4242`);
    return;
  }
  if (command === 'pay') {
    const [seat, card] = [up[0], args[1]];
    // The seat's hold that's still running: its id starts hold-<seat>-.
    const prefix = `hold-${seat.toLowerCase()}-`;
    let found: string | undefined;
    for await (const w of client.workflow.list({ query: "WorkflowType = 'FareHoldWorkflow' AND ExecutionStatus = 'Running'" })) {
      if (w.workflowId.startsWith(prefix)) {
        found = w.workflowId;
        break;
      }
    }
    if (!found) {
      console.error(`No hold is running for seat ${seat}: start one with npm run hold -- ${seat}`);
      process.exit(1);
    }
    try {
      // An update waits for a worker to run it: give up after a while, rather than hang.
      const answer = await Promise.race([
        client.workflow.getHandle(found).executeUpdate('pay', { args: [{ card }] }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15_000)),
      ]);
      console.log(answer);
    } catch (err) {
      if (err instanceof WorkflowUpdateFailedError) {
        console.error(`Payment refused: ${err.cause?.message ?? err.message}`);
        process.exit(1);
      }
      console.error(`No answer from ${found} in 15 seconds: is a worker running? Open it in the Temporal UI to see.`);
      process.exit(1);
    }
    return;
  }
  if (command === 'itinerary') {
    const stops = up.length >= 2 ? up : ['SFO', 'JFK', 'LHR'];
    const workflowId = `itinerary-${stops.map((s) => s.toLowerCase()).join('-')}-${short()}`;
    await waitFor(await client.workflow.start('ItineraryWorkflow', { args: [{ stops }], taskQueue, workflowId }));
    return;
  }
  if (command === 'book') {
    const [origin = 'SFO', destination = 'JFK'] = up;
    const booking: Booking = { origin, destination, card: args[2] ?? '4242' };
    const workflowId = `book-${origin.toLowerCase()}-${destination.toLowerCase()}-${short()}`;
    const handle = await client.workflow.start('BookTripWorkflow', { args: [booking], taskQueue, workflowId });
    // A booking whose card has expired waits, for as long as it takes, for a new one. Say so and
    // stop, rather than wait here with it: the new card comes from the Temporal UI.
    await waitFor(handle, async () => {
      const status = await Promise.race([
        handle.query<BookingStatus>('status').catch(() => null),
        new Promise<null>((r) => setTimeout(() => r(null), 2000)),
      ]);
      if (!status?.waiting) return false;
      console.log(`The card ending ${status.card} has expired. The booking is waiting for a new one, holding the`);
      console.log('flight and the hotel. Send it one from the Temporal UI: More Actions, Send an Update, new_card.');
      return true;
    });
    return;
  }

  const [origin = 'SFO', destination = 'JFK', seats] = up;
  const route = `${origin.toLowerCase()}-${destination.toLowerCase()}`;
  if (command === 'board') {
    const request: BoardingRequest = { origin, destination, seats: seats ? Number(seats) : 40 };
    await waitFor(await client.workflow.start('BoardingWorkflow', { args: [request], taskQueue, workflowId: `board-${route}-${short()}` }));
  } else {
    const trip: TripRequest = { origin, destination };
    await waitFor(await client.workflow.start('HelloTripWorkflow', { args: [trip], taskQueue, workflowId: `hello-${route}-${short()}` }));
  }
}

// Exit when done: a booking left waiting still has its result pending, which would keep Node running.
main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
