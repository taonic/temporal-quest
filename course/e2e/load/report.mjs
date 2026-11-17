// The Derby load test's report: every racer's files (racer-NN.jsonl and .json, from each shard)
// and the host's (lobby.json, screen.jsonl, standings.json), from a folder and its subfolders,
// checked against the spec's pass table. Writes report.md (and the run's summary, under GitHub
// Actions), and exits 1 if anything failed.
//
//   node load/report.mjs reports/load [--racers 20]
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { positionals, values: opts } = parseArgs({ allowPositionals: true, options: { racers: { type: "string", default: "20" } } });
const dir = path.resolve(positionals[0] ?? "reports/load");
const want = Number(opts.racers);

function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(root, e.name)) : [path.join(root, e.name)]));
}
const all = files(dir);
const readJson = (name) => {
  const found = all.find((f) => path.basename(f) === name);
  return found ? JSON.parse(fs.readFileSync(found, "utf8")) : null;
};
const lines = (file) => fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

const racers = all.filter((f) => /racer-\d+\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(f, "utf8"))).sort((a, b) => a.n - b.n);
const rows = all.filter((f) => /(racer-\d+|screen)\.jsonl$/.test(f)).flatMap(lines);
const http = rows.filter((r) => r.kind === "http" || r.who === "screen");
const actions = rows.filter((r) => r.kind === "action");
const standings = readJson("standings.json");
const lobby = readJson("lobby.json");

const quantile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const ms = (v) => (v == null ? "–" : v >= 10_000 ? `${(v / 1000).toFixed(0)} s` : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);

// --- Requests, by what they're for -------------------------------------------------------------
const GROUPS = [
  ["Board poll", (r) => r.path === "/api/sandbox/poll"],
  ["Board action", (r) => r.path === "/api/sandbox/action"],
  ["Race state (racers)", (r) => r.path === "/api/race/state" && r.who !== "screen"],
  ["Race state (screen)", (r) => r.who === "screen"],
  ["Join", (r) => r.path.startsWith("/api/race/")  && r.path !== "/api/race/state"],
  ["Sandbox start and status", (r) => r.path === "/api/sandbox" || r.path === "/api/sandbox/start"],
  ["Temporal UI (proxied)", (r) => r.path === "temporal-ui"],
  ["Everything else", () => true],
];
const grouped = new Map(GROUPS.map(([name]) => [name, []]));
for (const r of http) grouped.get(GROUPS.find(([, match]) => match(r))[0]).push(r);
const stat = (list) => {
  const okMs = list.filter((r) => r.status > 0).map((r) => r.ms);
  return { count: list.length, p50: quantile(okMs, 0.5), p95: quantile(okMs, 0.95), max: okMs.length ? Math.max(...okMs) : null, errors: list.filter((r) => r.status >= 500 || r.status < 0).length, limited: list.filter((r) => r.status === 429).length };
};

// --- Checks against the spec ------------------------------------------------------------------
const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass, detail });

const joined = racers.filter((r) => r.marks.joined);
check(`All ${want} racers joined`, joined.length >= want, `${joined.length} joined`);
const readyIn = racers.filter((r) => r.marks["sandbox-ready"]).map((r) => r.marks["sandbox-ready"] - r.marks.joined);
check("Every sandbox ready within 3 minutes of joining", readyIn.length >= want && Math.max(...readyIn) <= 3 * 60_000, `${readyIn.length} ready; p50 ${ms(quantile(readyIn, 0.5))}, slowest ${ms(readyIn.length ? Math.max(...readyIn) : null)}`);
const failedSandboxes = racers.filter((r) => r.sandboxErrors?.length);
check("No sandbox failed to start", failedSandboxes.length === 0, `${failedSandboxes.length}${failedSandboxes.map((r) => `\n  - racer ${r.n}${r.marks["sandbox-retried"] ? " (pressed Try again)" : ""}: ${r.sandboxErrors[0].slice(0, 160)}`).join("")}`);
const finished = racers.filter((r) => r.outcome === "finished");
check("Every racer finished, E1 to the boss", finished.length >= want, `${finished.length} of ${racers.length}${racers.filter((r) => r.failure).map((r) => `\n  - racer ${r.n}: ${r.failure}`).join("")}`);
const poll = stat(grouped.get("Board poll"));
check("Board poll p95 under 2.5 s", poll.p95 != null && poll.p95 < 2500, `p95 ${ms(poll.p95)} over ${poll.count}`);
const actionP95 = quantile(actions.map((a) => a.ms), 0.95);
check("Board action, click to done, p95 under 5 s", actionP95 != null && actionP95 < 5000, `p95 ${ms(actionP95)} over ${actions.length}`);
const raceState = stat([...grouped.get("Race state (racers)"), ...grouped.get("Race state (screen)")]);
check("Race state p95 under 500 ms", raceState.p95 != null && raceState.p95 < 500, `p95 ${ms(raceState.p95)} over ${raceState.count}`);
const serverErrors = http.filter((r) => r.status >= 500 && r.path !== "temporal-ui");
check("No 5xx from the site", serverErrors.length === 0, `${serverErrors.length}${[...new Set(serverErrors.map((r) => `${r.status} ${r.path}`))].slice(0, 5).map((s) => `\n  - ${s}`).join("")}`);
const pageErrors = racers.flatMap((r) => r.errors.filter((e) => e.startsWith("page:")));
check("No errors in the page", pageErrors.length === 0, `${pageErrors.length}${[...new Set(pageErrors)].slice(0, 5).map((s) => `\n  - ${s}`).join("")}`);

// The standings, against what each racer's planned answers should score.
const wrong = [];
if (standings) {
  for (const r of racers.filter((x) => x.outcome === "finished")) {
    const row = standings.racers.find((s) => s.name === r.name);
    const e = r.plan.expected;
    if (!row) wrong.push(`${r.name}: not in the standings`);
    else if (row.xp !== e.xp || row.stumbles !== e.stumbles || row.completed !== e.completed) {
      wrong.push(`${r.name}: ${row.xp} XP, ${row.stumbles} slips, ${row.completed} stops; expected ${e.xp}, ${e.stumbles}, ${e.completed}`);
    }
  }
}
check("Standings match every finisher's answers", Boolean(standings) && wrong.length === 0, standings ? `${finished.length - wrong.length} of ${finished.length} right${wrong.map((w) => `\n  - ${w}`).join("")}` : "no standings.json");

// --- The report -------------------------------------------------------------------------------
const passed = checks.every((c) => c.pass);
const out = [];
out.push(`# Derby load test: ${passed ? "✅ passed" : "❌ failed"}`, "");
const first = Math.min(...racers.map((r) => r.marks["join-start"] ?? Infinity));
out.push(`${racers.length} racers${standings ? `, race ${ms(standings.endedAt - standings.startedAt)} from the gun to the end` : ""}.`, "");
out.push("| Check | | Result |", "|---|---|---|");
for (const c of checks) out.push(`| ${c.name} | ${c.pass ? "✅" : "❌"} | ${c.detail.split("\n")[0]} |`);
const details = checks.filter((c) => c.detail.includes("\n"));
if (details.length) out.push("", ...details.flatMap((c) => [`**${c.name}**`, ...c.detail.split("\n").slice(1), ""]));
out.push("", "## Requests", "", "| | Count | p50 | p95 | Max | 5xx or failed | 429 |", "|---|---|---|---|---|---|---|");
for (const [name, list] of grouped) {
  if (!list.length) continue;
  const s = stat(list);
  out.push(`| ${name} | ${s.count} | ${ms(s.p50)} | ${ms(s.p95)} | ${ms(s.max)} | ${s.errors} | ${s.limited} |`);
}
out.push("", "## Board actions, click to done", "", "| Action | Count | p50 | p95 | Max |", "|---|---|---|---|---|");
for (const action of [...new Set(actions.map((a) => a.action))]) {
  const list = actions.filter((a) => a.action === action).map((a) => a.ms);
  out.push(`| ${action} | ${list.length} | ${ms(quantile(list, 0.5))} | ${ms(quantile(list, 0.95))} | ${ms(Math.max(...list))} |`);
}
// How long the board took to see each module's check pass, from entering the module.
const seen = {};
for (const r of racers) for (const [what, at] of Object.entries(r.marks)) {
  const id = what.match(/^seen-(E\d+)$/)?.[1];
  if (id && r.marks[`enter-${id}`]) (seen[id] ??= []).push(at - r.marks[`enter-${id}`]);
}
if (Object.keys(seen).length) {
  out.push("", "## Each module, entering it to its check passing", "", "| Module | Racers | p50 | Max |", "|---|---|---|---|");
  for (const id of Object.keys(seen).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) out.push(`| ${id} | ${seen[id].length} | ${ms(quantile(seen[id], 0.5))} | ${ms(Math.max(...seen[id]))} |`);
}
if (lobby?.length) {
  const allReady = lobby.find((l) => (l.sandboxes.ready ?? 0) >= want);
  out.push("", "## The stalls", "", `First join to every sandbox ready: ${allReady ? ms(allReady.at - first) : "never"}. The lobby as the host saw it, from when it opened:`, "");
  const step = Math.max(1, Math.floor(lobby.length / 12));
  for (const l of lobby.filter((_, i) => i % step === 0 || i === lobby.length - 1)) out.push(`- +${ms(l.at - lobby[0].at)}: ${l.racers} in${Object.keys(l.sandboxes).length ? `, sandboxes ${Object.entries(l.sandboxes).map(([k, v]) => `${v} ${k}`).join(", ")}` : ""}`);
}
if (standings) {
  out.push("", "## Final standings", "", "| Rank | Racer | XP | Slips | Stops | Expected |", "|---|---|---|---|---|---|");
  for (const s of [...standings.racers].sort((a, b) => a.rank - b.rank)) {
    const e = racers.find((r) => r.name === s.name)?.plan.expected;
    out.push(`| ${s.rank} | ${s.name} | ${s.xp} | ${s.stumbles} | ${s.completed} | ${e ? `${e.xp} XP, ${e.stumbles} slips` : "–"} |`);
  }
}
const text = `${out.join("\n")}\n`;
fs.writeFileSync(path.join(dir, "report.md"), text);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
console.log(text);
process.exit(passed ? 0 : 1);
