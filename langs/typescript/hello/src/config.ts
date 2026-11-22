// Where the worker and the starter find Temporal: the workshop's .env (as the Python side reads
// it), under anything already set in the environment. HELLO_TASK_QUEUE and WORKER_MODE are for the
// checks and the challenges: a queue of their own, and a worker with only workflows or activities.
import fs from 'node:fs';
import path from 'node:path';

const dotenv = path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(dotenv)) {
  for (const line of fs.readFileSync(dotenv, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*([^#]*?)\s*(?:#.*)?$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

export const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
export const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';
export const uiUrl = (process.env.TEMPORAL_UI_URL ?? 'http://localhost:8233').replace(/\/$/, '');
export const taskQueue = process.env.HELLO_TASK_QUEUE ?? 'hello';
export const mode = (process.env.WORKER_MODE ?? 'all') as 'all' | 'workflows' | 'activities';
