// The worker: the process that runs workflow and activity code.   npm run worker
//
// It polls the "hello" task queue. Temporal hands it work; it never listens on a port.
import { DefaultLogger, LogEntry, makeTelemetryFilterString, NativeConnection, Runtime, Worker } from '@temporalio/worker';
import * as activities from './activities';
import { address, mode, namespace, taskQueue } from './config';

// A log you can read: one line a message, an error's message without its stack, and not the
// worker's start-up chatter (the workflow bundle's build report).
const CHATTER = [/webpack|workflow-bundle|Workflow bundle created/, /^Worker state changed/, /^No Nexus services/];
Runtime.install({
  logger: new DefaultLogger('INFO', (entry: LogEntry) => {
    if (CHATTER.some((re) => re.test(entry.message))) return;
    const time = new Date(Number(entry.timestampNanos / 1_000_000n)).toISOString().slice(11, 19);
    // The SDK says "Workflow failed" for a failed workflow task: the workflow itself is still
    // running, and Temporal retries the task.
    const message = entry.message === 'Workflow failed' ? 'Workflow task failed (the workflow waits, and it is retried)' : entry.message;
    const error = entry.meta?.error as Error | undefined;
    console.log(`${time} ${entry.level} ${message}${error ? `: ${error.message}` : ''}`);
  }),
  // The SDK's core says the same again: keep its errors only.
  telemetryOptions: { logging: { filter: makeTelemetryFilterString({ core: 'ERROR' }), console: {} } },
});

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
