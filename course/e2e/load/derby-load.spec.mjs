// The Derby load test's racers: each one a browser of its own, doing what a person in the room
// does. It joins with the race's code, waits in the stalls while its sandbox warms up, and at the
// gun plays Essentials through the guide and the Trip board, from E1 to The Night Shift. Then it
// keeps its page open, as people do, until the race is over.
//
// It answers from the built course (plan.mjs), getting some questions wrong on purpose, so the
// report can check the race scored it right. Every /api request's timing, and each milestone,
// go to reports/load/racer-NN.jsonl; its plan and how it went, to racer-NN.json.
//
// Settings (load.config.mjs runs it; the workflow sets them):
//   DERBY_CODE         the race's join code (required)
//   DERBY_RACERS       how many racers in all (20)
//   DERBY_SHARD        this runner's shard, from 0, and DERBY_PER_SHARD racers on each (all of them)
//   DERBY_PACE         rush (no thinking) or paced (5–20 s a beat, like people reading)
//   DERBY_SEED         which wrong answers each racer picks (1)
//   DERBY_LATENCY_MS   added to every request, to be as far away as the room (0)
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { BASE_URL } from "../env.mjs";
import { Learner, MINUTE, SECOND } from "../tests/learner.mjs";
import { loadCourse, planFor } from "./plan.mjs";

const CODE = process.env.DERBY_CODE ?? "";
const RACERS = Number(process.env.DERBY_RACERS || 20);
const PER_SHARD = Number(process.env.DERBY_PER_SHARD || RACERS);
const SHARD = Number(process.env.DERBY_SHARD || 0);
const PACE = process.env.DERBY_PACE === "paced" ? "paced" : "rush";
const SEED = Number(process.env.DERBY_SEED || 1);
const LATENCY_MS = Number(process.env.DERBY_LATENCY_MS || 0);
const OUT = path.resolve(process.env.DERBY_OUT || "reports/load");
// Screenshots at each racer's milestones, into this folder: for a run on your own machine only.
// Never set it under Actions: the repo is public, and a shot can show a pit pass.
const SHOTS = process.env.DERBY_SHOTS ? path.resolve(process.env.DERBY_SHOTS) : null;

const course = loadCourse();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const think = () => sleep(PACE === "paced" ? 5_000 + Math.random() * 15_000 : 300);
const pad = (n) => String(n).padStart(2, "0");

// What a beat asks of the board, by module and the beat's heading: a button to press (`act`), or
// something to wait for on the board first (`until`), as a person reads the guide and watches.
// A beat that isn't here asks nothing.
const temporal = ".tb-run.is-temporal";
const UNTIL = {
  retrying: [`${temporal} .tb-step.is-retrying`, null],
  inTheSafe: [`${temporal} .tb-status`, /safe/],
  waiting: [`${temporal} .tb-step.is-active`, /Waiting three days/],
  asking: [`${temporal} .tb-status`, /manager's answer/],
};
const SCRIPTS = {
  "E1:Run a trip": [{ act: "start-trip" }],
  "E2:Start a trip with a mistake in it": [{ act: "start-trip" }, { until: "retrying" }],
  "E2:Ship the fix": [{ act: "ship-fix" }],
  "E3:Make the airline flaky": [{ act: "flaky" }, { act: "start-trip" }],
  "E4:Ask for a trip anyway": [{ act: "start-trip" }, { until: "inTheSafe" }],
  "E4:Put a coordinator on shift": [{ act: "start-worker" }],
  "E5:Start a trip, and pull the plug": [{ act: "start-trip" }, { act: "pull-plug" }],
  "E5:Put a coordinator back on shift": [{ act: "start-worker" }],
  "E6:Start a trip that holds the seat": [{ act: "start-trip" }, { until: "waiting" }],
  "E6:Pull the plug while it waits": [{ act: "pull-plug" }],
  "E6:Put a coordinator on shift after the wait": [{ act: "start-worker" }],
  "E7:Start the trip": [{ act: "start-trip" }, { until: "asking" }],
  "E7:Pull the plug before you answer": [{ act: "pull-plug" }],
  "E7:Approve it, with nobody on shift": [{ act: "approve" }],
  "E7:Put a coordinator on shift": [{ act: "start-worker" }],
  "E8:Start a trip with a card that will be declined": [{ act: "start-trip" }],
};

test.describe.configure({ mode: "parallel" });

for (let i = 0; i < PER_SHARD; i++) {
  const n = SHARD * PER_SHARD + i + 1;
  if (n > RACERS) break;
  test(`racer ${pad(n)} @load`, async ({ page, context }) => {
    test.setTimeout(75 * MINUTE);
    expect(CODE, "DERBY_CODE: the race's join code").not.toBe("");
    fs.mkdirSync(OUT, { recursive: true });
    const plan = planFor(n, SEED, course);
    const result = { n, name: `Load ${pad(n)}`, plan, marks: {}, errors: [], outcome: "started" };
    const log = fs.createWriteStream(path.join(OUT, `racer-${pad(n)}.jsonl`));
    let module = null;
    const record = (row) => log.write(`${JSON.stringify({ at: Date.now(), racer: n, module, ...row })}\n`);
    const mark = (what, extra = {}) => {
      result.marks[what] ??= Date.now(); // the first time: a module's beats can come round again
      record({ kind: "mark", what, ...extra });
    };
    let shots = 0;
    const shot = async (what) => {
      if (!SHOTS) return;
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `racer-${pad(n)}-${pad(++shots)}-${what}.png`) }).catch(() => {});
    };

    // Every request to the site: how long it took, from the page's side.
    const host = new URL(BASE_URL).hostname;
    const sent = new Map();
    page.on("request", (req) => sent.set(req, Date.now()));
    const done = async (req, failed) => {
      const url = new URL(req.url());
      if (url.hostname !== host) return;
      const ui = url.port === "8081";
      if (!ui && !url.pathname.startsWith("/api/")) return;
      const res = failed ? null : await req.response().catch(() => null);
      const status = res?.status() ?? -1;
      record({ kind: "http", method: req.method(), path: ui ? "temporal-ui" : url.pathname, status, ms: Date.now() - (sent.get(req) ?? Date.now()), ...(failed ? { error: req.failure()?.errorText } : {}) });
      sent.delete(req);
      if (status >= 500 && !ui) result.errors.push(`${status} ${req.method()} ${url.pathname}`);
    };
    page.on("requestfinished", (req) => done(req, false));
    page.on("requestfailed", (req) => done(req, true));
    page.on("pageerror", (err) => result.errors.push(`page: ${err.message}`));
    let slug = null;
    page.on("response", async (res) => {
      if (new URL(res.url()).pathname === "/api/race/join" && res.ok()) slug = (await res.json().catch(() => ({}))).race?.slug ?? slug;
    });

    if (LATENCY_MS) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: LATENCY_MS, downloadThroughput: -1, uploadThroughput: -1 });
    }

    try {
      // A badge earned shows its card over everything: closed, as a person would, whenever it's
      // in the way.
      await page.addLocatorHandler(page.locator(".earn-backdrop"), async () => {
        record({ kind: "badge", name: await page.locator(".earn-name").textContent().catch(() => "") });
        await page.locator(".earn-close").click();
      });

      // --- Joining: a name, 🎲 for the jockey, and again if someone took the colour first ----
      await page.goto(`/join/${CODE}`);
      await page.locator("#join-name").fill(result.name);
      mark("join-start");
      await shot("join");
      for (let attempt = 1; ; attempt++) {
        await page.locator(".join-dice").click();
        await page.locator(".join-submit").click();
        const outcome = page.locator(".join-done, .join-form .join-error");
        await expect(outcome.first()).toBeVisible({ timeout: MINUTE });
        if (await page.locator(".join-done").isVisible()) break;
        const why = await page.locator(".join-form .join-error").first().textContent();
        record({ kind: "join-retry", why });
        if (attempt >= 6) throw new Error(`Couldn't join: ${why}`);
        await sleep(500 * attempt);
      }
      result.pitPass = (await page.locator(".join-pitpass code").textContent()).trim();
      mark("joined");
      await shot("joined");
      await page.locator(".join-done .join-go").click();

      // --- The stalls: the sandbox warms up; then the gun ----------------------------------
      await expect(page.locator(".race-lobby")).toBeVisible({ timeout: MINUTE });
      await shot("stalls");
      // Ready, or it failed: then the lobby says it'll be retried from the course, and a person
      // presses Try again on the board once the gates open.
      const settled = page.locator(".race-lobby-sandbox.is-ready, .race-lobby-sandbox.is-error, .race-lobby-sandbox.is-full");
      await expect(settled.first(), "the sandbox never got ready in the stalls").toBeVisible({ timeout: 12 * MINUTE });
      const sandboxFailed = !(await page.locator(".race-lobby-sandbox.is-ready").count());
      if (sandboxFailed) {
        const message = await page.evaluate(() => fetch("/api/sandbox").then((r) => r.json()).then((s) => `${s.state}: ${s.message ?? ""}`).catch(() => ""));
        result.sandboxErrors = [message];
        mark("sandbox-failed", { message });
        await shot("sandbox-failed");
      } else {
        mark("sandbox-ready");
        await shot("sandbox-ready");
      }
      await expect(page.locator(".race-lobby"), "the race never started").toHaveCount(0, { timeout: 30 * MINUTE });
      mark("started");
      if (sandboxFailed) {
        const retry = page.locator(".tb-offline button.button-primary");
        await expect(retry, "no Try again on the board").toBeVisible({ timeout: MINUTE });
        await retry.click();
        mark("sandbox-retried");
      }

      // --- Essentials, beat by beat, as the guide goes ------------------------------------
      const guide = new Learner(page);
      const scripted = new Set();
      const challengeIdOf = new Map(Object.entries(course.titles));
      await page.waitForURL(/#\/module\/E1/, { timeout: MINUTE });
      for (let beats = 0; ; beats++) {
        if (beats > 250) throw new Error("Still in the guide after 250 beats");
        const now = page.url().match(/#\/module\/([A-Za-z0-9-]+)/)?.[1] ?? module;
        if (now !== module) {
          module = now;
          mark(`enter-${module}`);
        }
        const heading = await guide.heading();
        const key = `${module}:${heading}`;
        if (SCRIPTS[key] && !scripted.has(key)) {
          scripted.add(key);
          for (const step of SCRIPTS[key]) {
            if (step.act) await act(page, guide, step.act, record);
            else {
              const [selector, text] = UNTIL[step.until];
              await expect(page.locator(selector).filter(text ? { hasText: text } : {}).first(), `${key}: the board never showed ${step.until}`).toBeVisible({ timeout: 3 * MINUTE });
            }
          }
          await shot(`${module}-${SCRIPTS[key].map((s) => s.act ?? s.until).join("-")}`);
        }
        // The module's check: what the board's waiting to see, then its one question.
        const check = page.locator(".module-check");
        if ((await check.count()) && !(await check.locator(".mc-done").count())) {
          const label = (await check.getAttribute("aria-label")).replace(/: its check$/, "");
          const id = challengeIdOf.get(label) ?? label.match(/^(E\d+)/)?.[1] ?? module;
          await expect(check.locator(".mc-part").first(), `${id}: the board never saw its check pass`).toHaveClass(/is-done/, { timeout: 5 * MINUTE });
          mark(`seen-${id}`);
          await think();
          await answer(check.locator(".question-card"), id, plan.misses[id], course);
          await expect(check.locator(".mc-done"), `${id} never passed`).toBeVisible({ timeout: MINUTE });
          mark(`passed-${id}`);
          await shot(`${id}-passed`);
        }
        // A quick question (EC1…): no board, just the answer.
        const card = guide.guide.locator(".guide-bubble > .question-card");
        if ((await card.count()) && !(await card.first().evaluate((el) => el.classList.contains("is-solved")))) {
          const title = (await card.first().getAttribute("aria-label")) ?? "";
          const id = challengeIdOf.get(title) ?? module;
          await think();
          await answer(card.first(), id, plan.misses[id], course);
          mark(`passed-${id}`);
          await shot(`${id}-answered`);
        }
        // The end of the guide: on to the boss.
        const onward = guide.guide.locator("a.guide-reply.is-primary, a.guide-next").filter({ hasText: /Night Shift/ });
        if (await onward.count()) {
          await onward.first().click();
          break;
        }
        await think();
        await guide.advance();
      }

      // --- The Night Shift: a few wrong on purpose, never all three hearts ----------------
      module = "E-boss";
      await page.waitForURL(/#\/module\/E-boss/, { timeout: MINUTE });
      mark("enter-E-boss");
      await shot("boss");
      await page.locator(".boss-go").click();
      let wrongLeft = plan.bossMisses;
      for (let stories = 0; ; stories++) {
        if (stories > 30) throw new Error("The boss fight never ended");
        if (await page.locator(".boss-end.is-won").count()) break;
        if (await page.locator(".boss-end.is-lost").count()) throw new Error("Lost the boss fight, which the plan never does");
        const text = (await page.locator(".boss-text").textContent()).trim();
        const story = course.boss.pool.find((s) => s.story === text);
        if (!story) throw new Error(`A boss story the course data doesn't have: ${text.slice(0, 60)}`);
        const rightLabel = story.choices.find((c) => c.right).label;
        const buttons = page.locator(".boss-story .challenge-choice");
        const labels = await buttons.locator(".challenge-label").allTextContents();
        const right = labels.findIndex((l) => l.trim() === rightLabel);
        const pick = wrongLeft > 0 ? labels.findIndex((_, i) => i !== right) : right;
        if (pick !== right) wrongLeft--;
        await think();
        await buttons.nth(pick).click();
        await expect(page.locator(".boss-why, .boss-end").first()).toBeVisible({ timeout: 30 * SECOND });
        if (stories === 0) await shot("boss-answered");
        if (await page.locator(".boss-end").count()) continue;
        await page.locator(".boss-why button").click();
      }
      mark("finished");
      await shot("boss-won");
      result.outcome = "finished";

      // --- Watching the race to its end, page open, as the room does ----------------------
      for (let i = 0; slug && i < 60 * 12; i++) {
        const state = await page.request.get(`/api/race/state?race=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
        if (state?.race.phase === "finished") break;
        await sleep(5_000);
      }
      mark("race-over");
      await page.reload();
      await sleep(2_000);
      await shot("race-over");
    } catch (err) {
      result.outcome = "failed";
      result.failure = `${module ?? "before the race"}: ${err.message.replace(/\x1b\[[0-9;]*m/g, "").split("\n")[0]}`;
      record({ kind: "failure", message: result.failure });
      await shot("failed");
      throw err;
    } finally {
      fs.writeFileSync(path.join(OUT, `racer-${pad(n)}.json`), JSON.stringify(result, null, 1));
      await new Promise((r) => log.end(r));
    }
  });
}

// A board button in the guide: once it lights up (the guide disables it until its moment), pressed,
// and then until the runner's done with it.
async function act(page, guide, action, record) {
  const button = guide.body.locator(`button[data-board-action="${action}"]`).first();
  await expect(button, `${action}: never enabled`).toBeEnabled({ timeout: 4 * MINUTE });
  const started = Date.now();
  await button.click();
  await expect(page.locator("button[data-board-action].is-pending"), `${action}: still pending`).toHaveCount(0, { timeout: 2 * MINUTE });
  record({ kind: "action", action, ms: Date.now() - started });
}

// A question's card: `misses` wrong picks first (each struck out), then the right one.
async function answer(card, id, misses = 0, course) {
  const q = course.questions.find((x) => x.id === id);
  if (!q) throw new Error(`No question ${id} in the course data`);
  const choices = card.locator(".challenge-choice");
  await expect(choices).toHaveCount(q.choices);
  const wrong = [...Array(q.choices).keys()].filter((i) => i !== q.right).slice(0, misses);
  for (const [k, i] of wrong.entries()) {
    await choices.nth(i).click();
    await expect(card.locator(".challenge-choice.is-struck")).toHaveCount(k + 1, { timeout: 30 * SECOND });
    await think();
  }
  await choices.nth(q.right).click();
  await expect(choices.nth(q.right)).toHaveClass(/is-right/, { timeout: 30 * SECOND });
}
