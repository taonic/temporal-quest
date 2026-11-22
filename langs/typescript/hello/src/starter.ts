// The client: start a trip workflow and wait for its result.   npm run start -- SFO JFK
import { Client, Connection } from '@temporalio/client';
import { randomUUID } from 'node:crypto';
import { address, namespace, taskQueue } from './config';
import type { TripRequest } from './shared';

async function main() {
  const [origin = 'SFO', destination = 'JFK'] = process.argv.slice(2);
  const client = new Client({ connection: await Connection.connect({ address }), namespace });
  const workflowId = `hello-${origin.toLowerCase()}-${destination.toLowerCase()}-${randomUUID().slice(0, 4)}`;
  const trip: TripRequest = { origin, destination };
  const handle = await client.workflow.start('HelloTripWorkflow', { args: [trip], taskQueue, workflowId });
  console.log(`Started ${workflowId}`);
  console.log(await handle.result());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
