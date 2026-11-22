// Where the worker and the starter find Temporal. TASK_QUEUE and WORKER_MODE are for the checks
// and the challenges: a queue of their own, and a worker that runs only workflows or activities.
export const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
export const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';
export const taskQueue = process.env.HELLO_TASK_QUEUE ?? 'hello';
export const mode = (process.env.WORKER_MODE ?? 'all') as 'all' | 'workflows' | 'activities';
