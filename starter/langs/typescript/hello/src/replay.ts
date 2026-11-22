// Replay a workflow's history against the code you have now, before you ship it.
//
//   npm run replay -- hold-15a            (the latest workflow whose id starts hold-15a-)
//   npm run replay -- --history FILE      (a history kept as JSON: what the checks do)
//   ... --history FILE --provided         (with the SDK's replayer, not replay() below: F12's check)
//
// It runs today's workflow code over the history, the way a new worker would after a deploy. If the
// code would now decide something the history didn't record, the replay fails here, on your
// machine, instead of on a running workflow in production. In CI, keep a few real histories as JSON
// files and replay them in a test. Exits 0 when it replays, 1 when it doesn't match, 2 otherwise.
import { Client, Connection } from '@temporalio/client';
import { Worker } from '@temporalio/worker';
import { DeterminismViolationError } from '@temporalio/workflow';
import fs from 'node:fs';
import { address, namespace } from './config';
import { quietLogs } from './logging';

// The replayer the checks use for F12 (--provided), so a check of the patch doesn't need replay() written.
const provided = (history: unknown) => Worker.runReplayHistory({ workflowsPath: require.resolve('./workflows') }, history);

async function replay(history: unknown): Promise<void> {
  // TODO(ch06): replay `history` against the workflows in ./workflows, and let it throw if they no
  // longer match it:
  //   await Worker.runReplayHistory({ workflowsPath: require.resolve('./workflows') }, history);
  throw new Error(`TODO(ch06): replay the history (${typeof history})`);
}

// The workflow called `name`, or the latest whose id starts with it and a dash.
async function latest(client: Client, name: string): Promise<string | undefined> {
  for await (const found of client.workflow.list()) {
    if (found.workflowId === name || found.workflowId.startsWith(`${name}-`)) return found.workflowId;
  }
  return undefined;
}

async function main() {
  quietLogs();
  const args = process.argv.slice(2);
  let history: unknown;
  let name: string;
  const replayer = args.includes('--provided') ? provided : replay;
  if (args[0] === '--history' && args[1]) {
    name = args[1];
    history = JSON.parse(fs.readFileSync(name, 'utf8'));
  } else if (args.length === 1) {
    const client = new Client({ connection: await Connection.connect({ address }), namespace });
    const found = await latest(client, args[0]);
    if (!found) {
      console.error(`No workflow called ${args[0]} or ${args[0]}-…: start one first.`);
      process.exit(2);
    }
    name = found;
    history = await client.workflow.getHandle(found).fetchHistory();
  } else {
    console.error('usage: npm run replay -- WORKFLOW_ID   (e.g. hold-15a, for the latest hold-15a-…)');
    process.exit(2);
  }
  try {
    await replayer(history);
  } catch (err) {
    if (!(err instanceof DeterminismViolationError)) throw err;
    console.error(`✗ ${name} doesn't replay on this code: it would break that workflow.\n  ${err.message}`);
    process.exit(1);
  }
  console.log(`✓ ${name} replays on this code: safe to deploy, as far as it's concerned.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
