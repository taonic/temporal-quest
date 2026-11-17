// The Derby load test's host: what the race's host does from /admin, through the admin API.
//
//   node load/host.mjs setup [--name "Load test"] [--minutes 25]   a new race; prints its id
//   node load/host.mjs code --race ID                              its join code (to mask)
//   node load/host.mjs conduct --race ID --racers 20 [--join-minutes 10] [--ready-minutes 5]
//        [--out reports/load]: waits for the field and their sandboxes, starts the race, watches
//        it as the race screen does (recording each poll), and saves the final standings; all
//        along, how the machine holds up (/api/admin/machine every 5 s, into machine.jsonl)
//   node load/host.mjs cleanup --race ID                           racers, their sandboxes, the race
//
// The admin is the e2e tests' (E2E_ADMIN_EMAIL, with E2E_SIGNIN_KEY unless it's the app's secret
// admin address). Under GitHub Actions, setup writes race-id and slug to $GITHUB_OUTPUT.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { BASE_URL } from "../env.mjs";
import { adminApi } from "../tests/accounts.mjs";

const { positionals, values: opts } = parseArgs({
  allowPositionals: true,
  options: {
    race: { type: "string" },
    name: { type: "string", default: "Load test" },
    minutes: { type: "string", default: "25" },
    racers: { type: "string", default: "20" },
    "join-minutes": { type: "string", default: "10" },
    "ready-minutes": { type: "string", default: "5" },
    out: { type: "string", default: "reports/load" },
  },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);
const say = (line) => console.log(`${stamp()} ${line}`);

async function admin() {
  const { api, ok } = await adminApi();
  if (!ok) throw new Error("The e2e admin isn't one of the app's admins (E2E_ADMIN_EMAIL, E2E_SIGNIN_KEY).");
  return api;
}

async function call(api, method, url, data) {
  const res = await api.fetch(url, { method, data });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`${method} ${url}: ${res.status()} ${body.error ?? ""}`);
  return body;
}

const detail = (api, id) => call(api, "GET", `/api/admin/race?id=${encodeURIComponent(id)}`);

// The Fly machine stops when idle: wake it first, so the race starts on a running machine.
async function wake() {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (res?.ok) return;
    await sleep(3000);
  }
  throw new Error(`${BASE_URL} didn't wake within 90s`);
}

function output(key, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

async function setup() {
  await wake();
  const api = await admin();
  const name = `${opts.name} ${new Date().toISOString().slice(5, 16).replace("T", " ")}`;
  const race = await call(api, "POST", "/api/admin/races", { name, durationMinutes: Number(opts.minutes), sound: false });
  say(`race ${race.id} made: ${race.name}, ${race.durationMinutes} minutes`);
  output("race-id", race.id);
  console.log(race.id);
}

async function code() {
  const api = await admin();
  console.log((await detail(api, opts.race)).race.joinCode);
}

// Every 5 s until the field is in and its sandboxes are ready, the lobby as the host sees it,
// kept for the report. The racers get --join-minutes to come in (a runner installs its browser
// first), and their sandboxes --ready-minutes after the last one joins; then it starts with
// whoever's there, as a host would. Then the race screen's poll every 2 s until it's over.
async function conduct() {
  const api = await admin();
  const want = Number(opts.racers);
  const out = path.resolve(opts.out);
  fs.mkdirSync(out, { recursive: true });
  const lobby = [];
  // The machine's own view, every 5 s from the lobby to the end (an older runner without the
  // route: nothing recorded).
  const machine = fs.createWriteStream(path.join(out, "machine.jsonl"));
  const sampler = setInterval(async () => {
    const res = await api.fetch("/api/admin/machine").catch(() => null);
    if (res?.ok()) machine.write(`${JSON.stringify(await res.json())}\n`);
  }, 5000);
  const joinBy = Date.now() + Number(opts["join-minutes"]) * 60_000;
  let joinedBy = null;
  let readyBy = null;
  for (;;) {
    const state = await detail(api, opts.race);
    const racers = state.racers.filter((r) => !r.ghost);
    const sandboxes = racers.reduce((count, r) => ({ ...count, [r.sandbox ?? "none"]: (count[r.sandbox ?? "none"] ?? 0) + 1 }), {});
    const ready = sandboxes.ready ?? 0;
    lobby.push({ at: Date.now(), racers: racers.length, sandboxes });
    say(`lobby: ${racers.length}/${want} in, sandboxes ${JSON.stringify(sandboxes)}`);
    if (racers.length >= want && !joinedBy) {
      joinedBy = Date.now();
      readyBy = joinedBy + Number(opts["ready-minutes"]) * 60_000;
    }
    if (racers.length >= want && ready >= want) break;
    if (!joinedBy && Date.now() > joinBy) {
      if (!racers.length) throw new Error("Nobody joined.");
      say(`starting anyway: only ${racers.length} of ${want} joined in ${opts["join-minutes"]} minutes`);
      break;
    }
    if (readyBy && Date.now() > readyBy) {
      say(`starting anyway: ${ready} of ${racers.length} sandboxes ready ${opts["ready-minutes"]} minutes after the last join`);
      break;
    }
    await sleep(5000);
  }
  fs.writeFileSync(path.join(out, "lobby.json"), JSON.stringify(lobby, null, 1));
  await call(api, "POST", "/api/admin/races/action", { id: Number(opts.race), action: "start" });
  const startedAt = Date.now();
  say("started");

  // The race screen's view: public, every 2 s, as RaceScreen.vue polls it.
  const slug = (await detail(api, opts.race)).race.slug;
  const polls = fs.createWriteStream(path.join(out, "screen.jsonl"));
  let last = null;
  let lastSay = 0;
  for (;;) {
    const sent = Date.now();
    let status = 0;
    try {
      const res = await fetch(`${BASE_URL}/api/race/state?race=${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(20_000) });
      status = res.status;
      if (res.ok) last = await res.json();
    } catch {
      status = -1;
    }
    polls.write(`${JSON.stringify({ at: sent, path: "/api/race/state", method: "GET", status, ms: Date.now() - sent, who: "screen" })}\n`);
    if (last && Date.now() - lastSay > 30_000) {
      lastSay = Date.now();
      const done = last.racers.filter((r) => r.finishedAt).length;
      say(`racing: ${last.race.phase}, ${done}/${last.racers.length} done, leader ${last.racers.find((r) => r.rank === 1)?.xp ?? 0} XP`);
    }
    if (last?.race.phase === "finished") break;
    await sleep(2000);
  }
  polls.end();
  clearInterval(sampler);
  machine.end();
  const standings = (await detail(api, opts.race)).racers.map(({ name, horse, xp, stumbles, completed, rank, finishedAt, sandbox }) => ({ name, horse, xp, stumbles, completed, rank, finishedAt, sandbox }));
  fs.writeFileSync(path.join(out, "standings.json"), JSON.stringify({ startedAt, endedAt: Date.now(), joinedBy, racers: standings }, null, 1));
  say(`finished: ${standings.length} racers, standings saved`);
}

// The racers first, as /admin deletes a learner (their sandbox, then them), then the race. Each
// sandbox's deletion is waited on, so nothing is left running for Daytona to bill.
async function cleanup() {
  const api = await admin();
  let state;
  try {
    state = await detail(api, opts.race);
  } catch (err) {
    return say(`no race to clean up: ${err.message}`);
  }
  const racers = state.racers.filter((r) => r.userId);
  for (const r of racers) {
    await call(api, "DELETE", `/api/admin/learner?id=${encodeURIComponent(r.userId)}`).catch((err) => say(`deleting ${r.name}: ${err.message}`));
  }
  await call(api, "POST", "/api/admin/races/action", { id: Number(opts.race), action: "delete" });
  say(`deleted race ${opts.race} and ${racers.length} racers, with their sandboxes`);
}

const commands = { setup, code, conduct, cleanup };
const command = commands[positionals[0]];
if (!command) {
  console.error(`One of: ${Object.keys(commands).join(", ")}`);
  process.exit(2);
}
if (positionals[0] !== "setup" && !opts.race) {
  console.error("--race ID");
  process.exit(2);
}
await command();
process.exit(0);
