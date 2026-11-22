// A log you can read, for the worker and the replayer: one line a message, an error's message
// without its stack, and not the start-up chatter (the workflow bundle's build report).
import { DefaultLogger, LogEntry, makeTelemetryFilterString, Runtime } from '@temporalio/worker';

const CHATTER = [/webpack|workflow-bundle|Workflow bundle created/, /^Worker state changed/, /^No Nexus services/];

export function quietLogs(): void {
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
    // The SDK's core says the same again: keep its errors only. (To the console, not forwarded to
    // this logger: forwarding keeps the worker from shutting down on Ctrl-C.)
    telemetryOptions: { logging: { filter: makeTelemetryFilterString({ core: 'ERROR' }), console: {} } },
  });
}
