// The client: start a workflow, and wait for its result.
//
//   npm run start -- SFO JFK        a trip
//   npm run board -- SFO JFK [40]   a boarding
//
// Starting a workflow only records it; a worker runs it. With no worker, it waits.
import { Client, Connection, WorkflowFailedError } from '@temporalio/client';
import { randomUUID } from 'node:crypto';
import { address, namespace, taskQueue, uiUrl } from './config';
import type { BoardingRequest, TripRequest } from './shared';

const short = () => randomUUID().slice(0, 4);

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const [origin = 'SFO', destination = 'JFK', seats] = args.map((a) => a.toUpperCase());
  const client = new Client({ connection: await Connection.connect({ address }), namespace });
  const route = `${origin.toLowerCase()}-${destination.toLowerCase()}`;

  let handle;
  if (command === 'board') {
    const request: BoardingRequest = { origin, destination, seats: seats ? Number(seats) : 40 };
    handle = await client.workflow.start('BoardingWorkflow', { args: [request], taskQueue, workflowId: `board-${route}-${short()}` });
  } else {
    const trip: TripRequest = { origin, destination };
    handle = await client.workflow.start('HelloTripWorkflow', { args: [trip], taskQueue, workflowId: `hello-${route}-${short()}` });
  }
  console.log(`Started ${handle.workflowId}: ${uiUrl}/namespaces/${namespace}/workflows/${handle.workflowId}`);
  console.log('Waiting for the result...');
  try {
    console.log(await handle.result());
  } catch (err) {
    if (!(err instanceof WorkflowFailedError)) throw err;
    console.error(`The workflow failed: ${err.cause?.message ?? err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
