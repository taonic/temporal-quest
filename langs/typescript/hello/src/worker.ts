// The worker: the process that runs workflow and activity code.   npm run worker
//
// It polls the "hello" task queue. Temporal hands it work; it never listens on a port.
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
import { address, mode, namespace, taskQueue } from './config';
import { quietLogs } from './logging';

quietLogs();

async function main() {
  const connection = await NativeConnection.connect({ address });
  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    // WORKER_MODE: the checks and challenges run only the workflows (their activities are Python's).
    workflowsPath: mode === 'activities' ? undefined : require.resolve('./workflows'),
    activities: mode === 'workflows' ? undefined : activities,
  });
  console.log(`Hello worker ready on task queue '${taskQueue}'`);
  await worker.run();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
