// Prototype (ticket 02): run measure.sh in a learner-sized sandbox from today's snapshot, fetch
// what it measured, and delete the sandbox.
//
//   DAYTONA_API_KEY=… node .scratch/multi-language/prototype/sandbox.mjs OUT_DIR [--keep]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const require = createRequire(path.join(repo, "course/package.json"));
const { Daytona } = require("@daytonaio/sdk");

const out = path.resolve(process.argv[2] ?? "measure");
const keep = process.argv.includes("--keep");
const SNAPSHOT = process.env.SNAPSHOT ?? "governance-course-537e9f66d918";
const SKIP = /(^|\/)(node_modules|lib|build|bin|obj|\.gradle|__pycache__)(\/|$)|\.tsbuildinfo$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function files(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    if (SKIP.test(rel)) return [];
    return e.isDirectory() ? files(full, base) : [full];
  });
}

const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY });
console.log(`creating a sandbox from ${SNAPSHOT}…`);
const sandbox = await daytona.create(
  { snapshot: SNAPSHOT, labels: { app: "multilang-prototype" }, autoStopInterval: 90 },
  { timeout: 300 },
);
console.log(`sandbox ${sandbox.id}`);
try {
  const uploads = [
    ...files(here).map((f) => ({ source: fs.readFileSync(f), destination: `/workshop/.scratch/multi-language/prototype/${path.relative(here, f)}` })),
    ...files(path.join(repo, "hello")).map((f) => ({ source: fs.readFileSync(f), destination: `/workshop/hello/${path.relative(path.join(repo, "hello"), f)}` })),
    { source: Buffer.from(fs.readFileSync(path.join(repo, ".env.example"), "utf8") + "\nLLM_MODE=scripted\n"), destination: "/workshop/.env" },
  ];
  await sandbox.fs.uploadFiles(uploads, 300);
  console.log(`uploaded ${uploads.length} files; measuring (about 30-45 minutes)…`);
  await sandbox.process.executeCommand(
    `nohup bash .scratch/multi-language/prototype/${process.env.MEASURE ?? "measure.sh"} > /tmp/measure.out 2>&1 &`, "/workshop", undefined, 30);

  const started = Date.now();
  let shown = 0;
  while (Date.now() - started < 90 * 60_000) {
    await sleep(30_000);
    const log = (await sandbox.process.executeCommand("cat /tmp/measure.out", "/workshop", undefined, 30)).result ?? "";
    const lines = log.split("\n");
    if (lines.length - 1 > shown) { process.stdout.write(lines.slice(shown, -1).join("\n") + "\n"); shown = lines.length - 1; }
    const done = await sandbox.process.executeCommand("test -f /tmp/measure/done && echo yes", "/workshop", undefined, 30);
    if ((done.result ?? "").includes("yes")) break;
  }
  fs.mkdirSync(out, { recursive: true });
  const listing = (await sandbox.process.executeCommand("ls /tmp/measure", "/workshop", undefined, 30)).result ?? "";
  for (const name of listing.split("\n").map((s) => s.trim()).filter(Boolean)) {
    fs.writeFileSync(path.join(out, name), await sandbox.fs.downloadFile(`/tmp/measure/${name}`));
  }
  fs.writeFileSync(path.join(out, "measure.out"), await sandbox.fs.downloadFile("/tmp/measure.out"));
  console.log(`results in ${out}`);
} finally {
  if (keep) console.log(`kept sandbox ${sandbox.id}`);
  else { await sandbox.delete(120).catch((e) => console.error(`delete failed: ${e.message}`)); console.log("sandbox deleted"); }
}
