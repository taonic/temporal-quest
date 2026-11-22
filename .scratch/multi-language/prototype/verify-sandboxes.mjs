// Ticket 08's check: the runner's SandboxManager, against Daytona, for a TypeScript learner.
//
//   node .scratch/multi-language/prototype/verify-sandboxes.mjs
//
// Creates a TypeScript sandbox and a Python one (labelled learners of its own, deleted at the end),
// timing each to ready; in the TypeScript one, checks its packages, `quest` and an F2 check in
// TypeScript, that the poll reports `npm run worker`, that the TypeScript language server answers
// a hover over its bridge, and that a learner on Python is offered a new sandbox, not this one.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(path.join(repo, "course/package.json"));
const WebSocket = require("ws");
const { config } = await import(path.join(repo, "course/runner/config.mjs"));
const { SandboxManager, LSP_PORTS } = await import(path.join(repo, "course/runner/sandboxes.mjs"));

const manager = new SandboxManager({ ...config, maxSandboxes: 999 });
const run = `verify-${Date.now().toString(36)}`;
const origins = { site: "https://example.invalid", ui: "https://example.invalid" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const say = (ok, what) => {
  results.push(ok);
  console.log(`${ok ? "✓" : "✗"} ${what}`);
};

async function ready(learner, language) {
  const started = Date.now();
  manager.ensure(learner, origins, { language });
  for (;;) {
    await sleep(2000);
    const state = await manager.describe(learner);
    if (["ready", "error", "language", "full"].includes(state.state)) return { ...state, seconds: Math.round((Date.now() - started) / 1000) };
    if (Date.now() - started > 600_000) return { state: "timeout", seconds: 600 };
  }
}

const exec = async (learner, command, timeout = 120) => (await manager.exec(await manager.sandboxFor(learner), command, timeout)).result ?? "";

const ts = `${run}-ts`;
const py = `${run}-py`;
try {
  console.log(`TypeScript snapshot: ${manager.snapshotFor("typescript")}\nPython snapshot: ${manager.snapshotFor("python")}`);
  const [tsReady, pyReady] = await Promise.all([ready(ts, "typescript"), ready(py, "python")]);
  say(tsReady.state === "ready", `the TypeScript sandbox is ready in ${tsReady.seconds}s (${tsReady.state}${tsReady.message ? `: ${tsReady.message}` : ""})`);
  say(pyReady.state === "ready", `the Python sandbox is ready in ${pyReady.seconds}s`);

  const tsSandbox = await manager.sandboxFor(ts);
  say(tsSandbox.labels?.language === "typescript", `it's labelled for TypeScript (${JSON.stringify(tsSandbox.labels)})`);
  const tools = await exec(ts, "node --version; ls langs/typescript/hello/node_modules/@temporalio; command -v quest typescript-language-server");
  say(/v24\./.test(tools) && /worker/.test(tools) && /\/usr\/local\/bin\/quest/.test(tools), `Node 24, the hello's packages and quest are there:\n${tools.trim().replace(/^/gm, "    ")}`);
  const status = await exec(ts, "cd langs/typescript/hello && quest status | head -3");
  say(/F2/.test(status), `quest works from the TypeScript project:\n${status.trim().replace(/^/gm, "    ")}`);

  const started = Date.now();
  const check = await exec(
    ts,
    "QUEST_LANG=typescript .venv/bin/python -m pytest -q -p no:cacheprovider tests/test_ch01_hello.py::test_describes_the_trip tests/test_ch01_hello.py::test_retries_a_failed_activity tests/test_ch01_hello.py::test_uses_a_retry_policy_with_a_gentle_backoff 2>&1 | tail -1",
    180,
  );
  say(/3 passed/.test(check), `F2's check passes in TypeScript in ${Math.round((Date.now() - started) / 1000)}s: ${check.trim()}`);

  await exec(ts, "cd langs/typescript/hello && FLAKY=1 setsid -f npm run worker >/tmp/worker.log 2>&1 </dev/null", 30);
  await sleep(8000);
  const polled = await manager.poll(ts, [], { trips: true });
  say(polled.worker.running && polled.worker.command === "npm run worker" && polled.worker.env.FLAKY === "1", `the poll sees the TypeScript worker: ${JSON.stringify(polled.worker)}`);

  await manager.startLsp(ts);
  await sleep(3000);
  const url = (await manager.previewFor(ts, LSP_PORTS.typescript)).replace(/^http/, "ws");
  const hover = await new Promise((resolve) => {
    const ws = new WebSocket(url, { headers: { "x-daytona-skip-preview-warning": "true" } });
    const file = "file:///workshop/langs/typescript/hello/src/workflows.ts";
    const timer = setTimeout(() => (ws.terminate(), resolve(null)), 90_000);
    ws.on("open", () => {
      ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { processId: null, rootUri: "file:///workshop", capabilities: {} } }));
    });
    ws.on("message", async (data) => {
      const msg = JSON.parse(String(data));
      if (msg.id === 1) {
        ws.send(JSON.stringify({ jsonrpc: "2.0", method: "initialized", params: {} }));
        const text = await exec(ts, "cat langs/typescript/hello/src/workflows.ts");
        ws.send(JSON.stringify({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: file, languageId: "typescript", version: 1, text } } }));
        const line = text.split("\n").findIndex((l) => l.includes("proxyActivities<typeof"));
        const ask = () => ws.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "textDocument/hover", params: { textDocument: { uri: file }, position: { line, character: 30 } } }));
        ask();
        ws.ask = ask;
      } else if (msg.id === 2) {
        if (msg.result?.contents) {
          clearTimeout(timer);
          ws.close();
          resolve(msg.result.contents);
        } else setTimeout(() => ws.ask(), 2000);
      }
    });
    ws.on("error", () => resolve(null));
  });
  say(Boolean(hover), `the TypeScript language server answers a hover over its bridge: ${JSON.stringify(hover)?.slice(0, 120)}`);
  const lspMemory = await exec(ts, "ps -eo rss=,args= | grep -E '[t]sserver|[t]ypescript-language-server' | awk '{s+=$1} END {print int(s/1024)}'");
  console.log(`    its processes hold ${lspMemory.trim()} MB`);

  // The same learner, now on Python: offered a new sandbox, not given this one.
  manager.inflight.delete(ts);
  const mismatch = await ready(ts, "python");
  say(mismatch.state === "language" && mismatch.has === "typescript", `a learner on Python is offered a new sandbox: ${mismatch.message}`);
} catch (err) {
  console.error(err);
  results.push(false);
} finally {
  for (const learner of [ts, py]) {
    const sandbox = await manager.find(learner).catch(() => null);
    if (sandbox) await sandbox.delete(120).catch((e) => console.error(`delete failed: ${e.message}`));
  }
  console.log(`\n${results.every(Boolean) ? "all passed" : "some failed"}; sandboxes deleted`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
