// Languages on the site (ADR 0001): the course in the learner's language, a fake second language
// standing in for TypeScript until the course has one.
import assert from "node:assert/strict";
import { test } from "node:test";

import { offeredLanguages } from "../content/build.mjs";
import { Activity, catalogOf, deriveProgress } from "../runner/activity.mjs";
import { openDatabase } from "../runner/db.mjs";
import { systemPrompt } from "../runner/helper.mjs";
import { badgeContext, meets } from "../web/src/badges.js";
import { courseIn, exerciseIn, moduleLanguage, readLanguage } from "../web/src/language.js";

// An exercise in Python and TypeScript, and one only in Python.
const page = (text) => ({ intro: text, sections: [] });
const TWO = {
  id: "01-hello",
  languages: ["python", "typescript"],
  worker: "uv run hello-worker",
  starter: "uv run hello-start",
  files: [{ path: "hello/workflow.py" }],
  modes: { browser: page("execute_activity"), local: page("execute_activity") },
  byLang: {
    typescript: {
      worker: "npm run worker",
      starter: "npm run start --",
      files: [{ path: "langs/typescript/hello/src/workflows.ts" }],
      modes: { browser: page("proxyActivities"), local: page("proxyActivities") },
    },
  },
};
const ONE = { id: "02-agent", languages: ["python"], worker: "uv run travel-worker", files: [], modes: {} };
const COURSE = {
  languages: [{ id: "python", label: "Python" }, { id: "typescript", label: "TypeScript" }],
  exercises: [TWO, ONE],
  badges: [{ id: "polyglot", rule: "polyglot" }, { id: "explorer", rule: "explorer" }],
};

test("an exercise in the learner's language: its files, guide, worker and starter; in its own where it has no such version", () => {
  const ts = exerciseIn(TWO, "typescript");
  assert.equal(ts.language, "typescript");
  assert.equal(ts.worker, "npm run worker");
  assert.equal(ts.starter, "npm run start --");
  assert.deepEqual(ts.files.map((f) => f.path), ["langs/typescript/hello/src/workflows.ts"]);
  assert.equal(ts.modes.browser.intro, "proxyActivities");
  const py = exerciseIn(TWO, "python");
  assert.equal(py.language, "python");
  assert.equal(py.modes.browser.intro, "execute_activity");
  // Java isn't one of its languages: Python's, tagged as Python.
  assert.equal(exerciseIn(TWO, "java").language, "python");
  assert.equal(exerciseIn(ONE, "typescript").language, "python");
  assert.equal(exerciseIn(ONE, "typescript").worker, "uv run travel-worker");
  assert.equal(moduleLanguage({ languages: ["python", "typescript"] }, "typescript"), "typescript");
  assert.equal(moduleLanguage({ languages: ["python"] }, "typescript"), "python");
  assert.equal(moduleLanguage({}, "typescript"), "python");
});

test("Polyglot shows only once there's a second language", () => {
  assert.deepEqual(courseIn(COURSE, "typescript").badges.map((b) => b.id), ["polyglot", "explorer"]);
  const onlyPython = { ...COURSE, languages: [{ id: "python", label: "Python" }] };
  assert.deepEqual(courseIn(onlyPython, "python").badges.map((b) => b.id), ["explorer"]);
});

test("the language comes from ?lang=, when it's one on offer; otherwise Python, not chosen", () => {
  assert.deepEqual(readLanguage(COURSE, "?lang=typescript"), { id: "typescript", chosen: true, fromUrl: true });
  assert.deepEqual(readLanguage(COURSE, "?lang=cobol"), { id: "python", chosen: false, fromUrl: false });
  assert.deepEqual(readLanguage({ languages: [{ id: "python" }] }, "?lang=typescript"), { id: "python", chosen: false, fromUrl: false });
});

test("a language is offered once it has a whole tier: every ready module and challenge in one", () => {
  const branch = { id: "fundamentals", modules: ["F1", "F2", "FC1", "F8"] };
  const mod = (id, tier, languages, extra = {}) => [id, { id, tier, languages, kind: "module", status: "ready", ...extra }];
  const tierOneInTs = new Map([
    mod("F1", 1, ["python", "typescript"]),
    mod("F2", 1, ["python", "typescript"]),
    mod("FC1", 1, ["python", "typescript"], { kind: "challenge" }),
    mod("F8", 2, ["python"]),
  ]);
  assert.deepEqual(offeredLanguages([branch], tierOneInTs).map((l) => l.id), ["python", "typescript"]);
  assert.equal(offeredLanguages([branch], tierOneInTs)[1].label, "TypeScript");
  // A tier with one module still in Python only: not yet.
  const halfATier = new Map([...tierOneInTs, mod("FC1", 1, ["python"], { kind: "challenge" })]);
  assert.deepEqual(offeredLanguages([branch], halfATier).map((l) => l.id), ["python"]);
  // A module coming soon doesn't hold a tier back.
  const soon = new Map([...halfATier, mod("FC1", 1, ["python"], { kind: "challenge", status: "coming-soon" })]);
  assert.deepEqual(offeredLanguages([branch], soon).map((l) => l.id), ["python", "typescript"]);
});

const MODULES = [
  { id: "F1", kind: "module", check: "pending", status: "ready", branch: "fundamentals", tier: 1 },
  { id: "F2", kind: "module", check: "code", status: "ready", branch: "fundamentals", tier: 1 },
];

test("Polyglot: the same module with a code check, passed in two languages", () => {
  const ctx = badgeContext(MODULES, () => null);
  const badge = { kind: "skill", rule: "polyglot" };
  assert.equal(meets(badge, ctx, { completed: ["F2"], passedIn: { F2: ["python"] } }), false);
  assert.equal(meets(badge, ctx, { completed: ["F2"], passedIn: { F2: ["python", "typescript"] } }), true);
  // F1 has no code to write: passing it twice isn't two languages' code.
  assert.equal(meets(badge, ctx, { completed: ["F1"], passedIn: { F1: ["python", "typescript"] } }), false);
});

const CATALOG = catalogOf({
  modules: MODULES,
  exercises: [],
  paths: [],
  personas: [{ id: "developer" }],
  languages: [{ id: "python" }, { id: "typescript" }],
  badges: [{ id: "polyglot", kind: "skill", rule: "polyglot" }],
});

test("the server keeps the learner's language, each module's languages, and earns Polyglot from them", () => {
  const events = [
    { type: "module_passed", module_id: "F2", data: null, at: 1 },
    { type: "language_set", data: { language: "typescript" }, at: 2 },
    { type: "module_passed", module_id: "F2", data: { lang: "typescript" }, at: 3 },
  ];
  const progress = deriveProgress(events, CATALOG);
  assert.equal(progress.language, "typescript");
  assert.deepEqual(progress.completed, ["F2"]);
  assert.deepEqual(progress.passedIn, { F2: ["python", "typescript"] });
  assert.deepEqual(progress.badges, [{ id: "polyglot", at: 3 }]);
});

test("a language the course doesn't offer isn't recorded; the cohort's language is the default", () => {
  const db = openDatabase(":memory:");
  const activity = new Activity(db, { catalog: CATALOG, now: () => 1 });
  assert.equal(activity.recordFromBrowser("u1", [{ type: "language_set", data: { language: "cobol" } }]), 0);
  assert.equal(activity.progress("u1", null, "typescript").language, "typescript");
  assert.equal(activity.progress("u1", null, "cobol").language, null);
  assert.equal(activity.recordFromBrowser("u1", [{ type: "language_set", data: { language: "python" } }]), 1);
  assert.equal(activity.progress("u1", null, "typescript").language, "python", "their own choice beats the cohort's");
});

test("Ask Temporal writes examples in the learner's language", () => {
  assert.match(systemPrompt({ assignment: null, mode: "browser" }), /doing the workshop in Python \(the temporalio SDK\)/);
  assert.match(systemPrompt({ assignment: null, mode: "browser", language: "typescript" }), /doing the workshop in TypeScript/);
  assert.match(systemPrompt({ assignment: null, mode: "browser", language: "cobol" }), /doing the workshop in Python/);
});

test("a persona or language left on a shared browser never becomes the next learner's", async () => {
  const { settleChoice } = await import("../web/src/choices.js");
  const chose = { id: "typescript", chosen: true, fromUrl: false };
  const defaulted = { id: "python", chosen: false, fromUrl: false };
  // The server's is the learner's own, and wins.
  assert.equal(settleChoice({ local: chose, server: "python", owner: "a@x.com", email: "a@x.com" }), "adopt");
  assert.equal(settleChoice({ local: chose, server: "typescript", owner: "b@x.com", email: "a@x.com" }), "keep");
  // Chosen here before anyone signed in, or by them: it goes up.
  assert.equal(settleChoice({ local: chose, server: null, owner: null, email: "a@x.com" }), "upload");
  assert.equal(settleChoice({ local: chose, server: null, owner: "a@x.com", email: "a@x.com" }), "upload");
  // Chosen by someone else who signed in here: forgotten, not recorded as theirs.
  assert.equal(settleChoice({ local: chose, server: null, owner: "b@x.com", email: "a@x.com" }), "reset");
  // Nothing chosen: nothing to do. A link's ?lang= is this learner asking, now.
  assert.equal(settleChoice({ local: defaulted, server: null, owner: "b@x.com", email: "a@x.com" }), "keep");
  assert.equal(settleChoice({ local: { ...chose, fromUrl: true }, server: "python", owner: "b@x.com", email: "a@x.com" }), "upload");
});

test("the runner keeps each learner's sandbox start, state and language to that learner", async () => {
  const { SandboxManager } = await import("../runner/sandboxes.mjs");
  const manager = new SandboxManager({ maxSandboxes: 5, snapshot: "py", languageSnapshots: { typescript: "ts" } });
  const sandboxes = { alice: { id: "sa", state: "started", labels: { language: "typescript" } }, bob: null };
  manager.refreshed = async (learner) => sandboxes[learner];
  manager.ensure("alice", {}, { language: "python" }); // Alice's is TypeScript's: she's asked
  manager.ensure("bob", {}, { language: "typescript" }); // Bob has none (and no Daytona here: his start fails)
  await manager.inflight.get("alice").promise;
  await manager.inflight.get("bob")?.promise.catch(() => {});
  assert.equal((await manager.describe("alice")).state, "language");
  const bob = manager.progress.get("bob");
  assert.notEqual(bob?.state, "language", "Alice's answer isn't Bob's");
  assert.ok(!bob?.message?.includes("made for"), "nor is her message");
});
