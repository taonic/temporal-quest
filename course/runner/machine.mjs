// How the machine is holding up, for /api/admin/machine: what a load test (the Derby's) records
// every few seconds to judge whether the VM is big enough. Each reading covers the time since the
// one before: the process's CPU (100 is one core: the runner's JavaScript runs on one, so it's the
// ceiling that matters, whatever the VM has), how late the event loop ran (every request waits on
// it), the load average against the cores, and memory.
import os from "node:os";
import { monitorEventLoopDelay } from "node:perf_hooks";

export function createMachineStats({ now = () => Date.now(), cpuUsage = (prev) => process.cpuUsage(prev), memoryUsage = () => process.memoryUsage() } = {}) {
  // The monitor's readings include its own timer's interval: taken off, so 0 is on time.
  const RESOLUTION_MS = 10;
  const delay = monitorEventLoopDelay({ resolution: RESOLUTION_MS });
  delay.enable();
  let since = now();
  let cpu = cpuUsage();
  const ms = (ns) => Math.max(0, Math.round((ns / 1e6 - RESOLUTION_MS) * 10) / 10);

  return function read() {
    const at = now();
    const used = cpuUsage(cpu);
    const wallMs = Math.max(1, at - since);
    const reading = {
      at,
      overMs: wallMs,
      cores: os.availableParallelism?.() ?? os.cpus().length,
      cpuPercent: Math.round(((used.user + used.system) / 1000 / wallMs) * 1000) / 10,
      loadAverage: os.loadavg().map((l) => Math.round(l * 100) / 100),
      eventLoopMs: { p50: ms(delay.percentile(50)), p99: ms(delay.percentile(99)), max: ms(delay.max) },
      memoryMb: { rss: Math.round(memoryUsage().rss / 2 ** 20), total: Math.round(os.totalmem() / 2 ** 20), free: Math.round(os.freemem() / 2 ** 20) },
    };
    since = at;
    cpu = cpuUsage();
    delay.reset();
    return reading;
  };
}
