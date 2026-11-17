import assert from "node:assert/strict";
import test from "node:test";

import { createMachineStats } from "../runner/machine.mjs";

test("a machine reading covers the time since the last: CPU as a share of one core, memory in MB", () => {
  let clock = 1_000;
  let used = 0;
  const read = createMachineStats({
    now: () => clock,
    // process.cpuUsage(prev): microseconds, since prev when it's given
    cpuUsage: (prev) => (prev ? { user: used - prev.user, system: 0 } : { user: used, system: 0 }),
    memoryUsage: () => ({ rss: 300 * 2 ** 20 }),
  });
  clock += 2_000;
  used += 1_500_000; // 1.5 s of CPU in 2 s
  const first = read();
  assert.equal(first.overMs, 2_000);
  assert.equal(first.cpuPercent, 75);
  assert.equal(first.memoryMb.rss, 300);
  assert.ok(first.cores >= 1 && first.memoryMb.total > 0 && first.loadAverage.length === 3);
  assert.ok(first.eventLoopMs.p99 >= 0 && first.eventLoopMs.max >= first.eventLoopMs.p50);

  clock += 1_000;
  used += 1_000_000; // a whole core for the next second
  assert.equal(read().cpuPercent, 100);
});
