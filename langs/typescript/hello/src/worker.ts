// The worker: the process that runs workflow and activity code. It polls the "hello" task queue.
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
import { address, mode, namespace, taskQueue } from './config';

async function main() {
  const connection = await NativeConnection.connect({ address });
  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
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
