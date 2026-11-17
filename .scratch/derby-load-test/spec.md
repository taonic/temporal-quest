# Load-testing the Derby with 20 racers

Status: needs-triage

Before the Derby, find out whether the live site holds up with a full field: **20 racers** at once, each in a real browser with a real sandbox, plus the race screen on a projector and the host's admin page. 20 was the cap then (`MAX_RACERS`, one per silks colour); it's 40 now (a colour and pattern each), so 20 leaves headroom, and the test goes on to 30 and 40.

We drive real browsers with Playwright, as the e2e suite already does, so the test covers what a racer's laptop actually does: the join page, the lobby's sandbox warm-up, the Trip board's polls and actions, the Temporal UI iframe, the race pill and the race screen.

## What 20 racers cost the system

What the code does per racer, and where it lands:

| Load | Rate at 20 racers | Lands on |
|---|---|---|
| Sandbox create, at join (the lobby warms it up) | 20 at once | Daytona (each create also lists every sandbox, in `#countRunning`). 20 × 1 vCPU / 2 GiB |
| `GET /api/sandbox/poll?board=1`, every 2.5 s (`ExercisePage.vue`) | ~8 a second | The Fly machine, then **one Daytona `executeCommand` each**, running `board.py state` (Python, `timeout 10`) in the sandbox |
| `POST /api/sandbox/action` (a board button) | Bursts, as a room moves through a module together | Daytona exec, starting trips and workers in the sandbox |
| `GET /api/race/state`, every 2 s (pill, screen, host) | ~11 a second | The Fly machine. Cached for `STATE_CACHE_MS`, so cheap |
| Temporal UI iframe (E4, E7 point at it) | 20 UIs, proxied | The Fly machine's port 8081 proxy |
| Ask Temporal (optional) | Spiky | Gemini, and Kapa: **50 searches a minute across everyone** |
| Join and pit-pass resume | 20, plus retries | **60 per IP per 15 minutes.** A venue's Wi-Fi is one IP, and so is the laptop running this test |

The Fly app is **one machine** (2 shared vCPUs, 1 GB), on purpose: it keeps terminals and rate limits in memory. It scales to zero when idle (`min_machines_running = 0`).

## What we expect to break, most likely first

1. **Daytona, in the lobby.** 20 creates at once: the org's quota (concurrent sandboxes, vCPU, memory), API rate limits, and create time growing past "about a minute".
2. **Board polls.** ~8 Daytona execs a second, each starting Python in a 1-vCPU sandbox. If an exec takes longer than 2.5 s, or Daytona throttles, boards lag and checks pass late.
3. **The Fly machine.** 1 GB and shared CPUs, proxying 20 Temporal UIs while it serves the polls. Look for memory pressure, CPU steal, an OOM restart.
4. **The join limit**, on re-runs from one laptop (see Running it).

## The racer bot

A Playwright test at `course/e2e/tests/derby-load.spec.mjs`, in its own tier (`@load`), never run by the daily e2e. Each racer is one test, in its own browser context, with its own session cookie.

What each racer does:

1. Opens `/join/<CODE>`, types a name (`Load 07`), hits 🎲, joins, and keeps its pit-pass.
2. Waits in the lobby until its sandbox is ready, then for the gun.
3. Plays Essentials from E1 to the boss, by following the guide rather than a hard-coded script:
   - clicks the current beat's board-action button if it has one, and waits for the board to settle;
   - answers the module's check question once the board has seen it pass;
   - answers question challenges (EC1–EC3) and the boss's stories;
   - otherwise presses the guide's primary reply.

   This reuses `Learner` (`e2e/tests/learner.mjs`) and the Essentials E2 steps already in `sandbox.spec.mjs`.
4. Answers from the built course data (`web/src/generated/course-data.json`), **getting some wrong on purpose**: a seeded pattern per racer. So every racer has a known expected race XP (`web/src/race/rules.js`), and the final standings can be checked.
5. Records every response's timing (`requestfinished` plus `request.timing()`) to one JSONL file per racer: endpoint, status, duration, and the module it was on.

Pacing, a setting:

- **Rush**: no think time. The worst burst: the whole room on the same board action at once.
- **Paced**: 5–20 s of random think time per beat, so the run fills a 25-minute race like people reading would.

The host's part (creating, starting and ending the race) and a race-screen watcher are separate jobs in the workflow (see Running it). To watch the animations keep up, open `/race/<slug>` yourself during a run.

## Measuring

From the bots (a summary script over the JSONL, like `e2e/scripts/summary.mjs`):

| Measure | Pass |
|---|---|
| Join to "Sandbox ready", per racer | All 20 ready within **3 minutes** of joining, before the gun |
| `/api/sandbox/poll` duration | p95 under **2.5 s** (the poll interval) |
| Board action, click to the board showing it | p95 under **5 s** |
| `/api/race/state` duration | p95 under **500 ms** |
| HTTP errors | No 5xx. No 429 except where we test the limits |
| Page errors | None (the fixtures' `page-problems`) |
| Final standings | Every racer's XP and rank match what its seeded answers should give |

From the server, during the run:

- Fly: the machine's CPU, memory and restarts (`fly dashboard`, Grafana at fly-metrics.net), and `fly logs` for errors and Daytona failures.
- Daytona: the dashboard's sandbox count, and any rate-limit or quota errors.
- Optional, if the logs don't show enough: have the runner log its slow Daytona calls (over 2 s) and its event-loop lag, behind a flag.

The runners themselves: each shard records its CPU load (`uptime` every 10 s). If a shard's runner is saturated, its latencies aren't the server's fault, and the report says so.

## Phases

| # | Run | Why |
|---|---|---|
| 0 | Pre-flight (below) | Don't spend a run finding a quota we could have read |
| 1 | **1 racer**, rush, against prod | The bot works end to end, from join to the boss |
| 2 | **5 racers**, rush | The bot is stable when racers share the machine; a first look at the numbers |
| 3 | **20 racers**, paced, a full 25-minute race, screen and host open | The event as it'll be. The main result |
| 4 | **20 racers**, rush | The worst burst |
| 5 | Edge cases, during a 20-racer run | See below |

Edge cases, in phase 5:

- A **21st** join is refused cleanly ("The field is full").
- A racer **reloads mid-module**, and another resumes **with its pit-pass** in a fresh context.
- One racer's **sandbox restarts** mid-race (the existing restart).
- **Venue Wi-Fi drops**: every racer offline for 30 s (`context.setOffline`), then back. Then the host adds +5 min.
- The machine starts **cold**: begin the run with the app scaled to zero, as it will be if nobody opened the site that morning.

## Pre-flight

- **Daytona quota**: the org's limits on concurrent sandboxes, vCPU, memory and API calls, against 20 × 1 vCPU / 2 GiB plus the daily e2e's ~7. If it's tight, raise it before phase 3.
- **A quiet window on prod**: not near 14:00 UTC (the daily e2e). The workflow holds deploys and refuses to start during an E2E run, but tell anyone who deploys by hand with `npm run deploy`: that bypasses the queue.
- **Cleanup works**: after each run, delete the race, its racers and their sandboxes. Deleting a racer removes the user from the database. Check that it also deletes their Daytona sandbox; if not, the cleanup script deletes sandboxes by their `learner` label. After each run, the Daytona dashboard shows none left over.
- **Cost**: 20 sandboxes for about 45 minutes per full run, 4 or 5 runs. Ask Temporal is off unless we run its phase.

## Running it, on GitHub Actions

Against production (`temporalquest.dev`): it's the only environment, and the Derby runs on it.

A workflow of its own, `.github/workflows/derby-load.yml`, run by hand only (`workflow_dispatch`). Its inputs: `racers` (default 20), `pace` (`rush` or `paced`), `seed`, `latency_ms` (default 0).

```
setup ──┬── racers (matrix: 4 shards × 5 racers) ──┬── report
        └── conductor ─────────────────────────────┘     cleanup (always)
```

| Job | What it does |
|---|---|
| `setup` | Fails if an E2E run is in progress (`gh run list --workflow e2e.yml`). Creates the race through the admin API, and outputs only its id |
| `racers` | A matrix of 4 shards, 5 racers each (`fail-fast: false`). Each shard fetches the join code with the admin session and masks it, then runs `npx playwright test --grep @load --workers 5`. Racer numbers and seeds come from the shard, so every racer is the same from run to run |
| `conductor` | Waits until every racer is in the stalls with a sandbox ready (or 6 minutes have passed), then starts the race. Watches `/race/<slug>` and records its polls. Ends the race once every racer is done or the clock runs out, and saves the final standings |
| `report` | Gathers every shard's JSONL and the standings, checks them against the pass table, checks each racer's XP against its seeded answers, and writes the result to the run's summary. Red if anything fails |
| `cleanup` | Always runs. Deletes the race, its racers and their sandboxes, then checks that Daytona has none left with those `learner` labels |

Why it's shaped this way:

- **5 racers a runner**, not 20 on one. A runner has 4 vCPUs. With 20 Chromiums on it, the runner's own slowness would show up as server latency. The jobs run in parallel, and a public repo gets 20 concurrent jobs, so the 6 jobs here fit.
- **Deploys wait.** The workflow joins the deploy's concurrency group (`fly-deploy`, `cancel-in-progress: false`), so a merge to main during a run queues behind it instead of restarting the machine halfway.
- **Secrets**: the e2e tests' own. The admin is `E2E_ADMIN_EMAIL` (or `E2E_SIGNIN_KEY`); racers need nothing, since joining needs no email.
- **The repo is public, and so are its logs and artifacts.** Upload only the timings JSONL, the standings and the summary: **no traces, videos or screenshots** (`trace: "off"` for this tier). A trace carries the session cookies, the admin's included. The join code is masked, so a stranger can't take a stall. Don't save `fly logs` either, since they name real learners. Look at server metrics in Fly's dashboard during the run, and save only `fly machine status` before and after (restarts and OOMs), using the deploy's `FLY_API_TOKEN`.
- **Not the venue's network.** Runners are in US data centres, close to the machine in `sjc`, while a room in Phuket is ~200 ms away. Use `latency_ms` (Chromium's `Network.emulateNetworkConditions`) to make it closer to the room for phase 3. Each shard has its own IP, so the per-IP join limit (60 per 15 minutes) isn't tested here. 20 joins from one IP is well under it, so a small unit test is enough.

Phase 1 can run on a laptop first, headed, to debug the bot: `cd course/e2e && E2E_ADMIN_EMAIL=… DERBY_RACERS=1 npx playwright test --grep @load --headed`.

## Afterwards

A short results note under `## Comments`: the numbers against the table above, what broke, and what to change before the event. The likely candidates, to decide on the evidence, not before:

- Keep a machine running on the day (`min_machines_running = 1`), and maybe more memory.
- A slower board poll, or a lighter `board.py state`, if execs are the bottleneck.
- A higher Daytona quota.
- A higher per-IP join limit, if a rehearsal plus the real joins could reach 60.

## Open questions

- **When is the event?** It sets how much time there is for fixes after phase 3.
- **Is prod OK to load?** The plan assumes yes, in a quiet window, since there's no staging.
- **Does Ask Temporal go in?** A room asking at once could reach Kapa's 50 searches a minute. Worth one run if we expect people to use it during the race.

## Comments
