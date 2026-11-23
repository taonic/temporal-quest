// After every run: the sandbox tier's sandbox deleted and its learner signed out and deleted,
// whatever happened (Daytona bills for it, and it counts against MAX_SANDBOXES for real
// learners). Here rather than in the spec's afterAll, which also runs when a failed test's
// worker is replaced.
import fs from "node:fs";

import { request } from "@playwright/test";

import { BASE_URL, LEARNER_STATE, SANDBOX_EMAIL, SIGNIN_KEY, WALK_EMAIL } from "./env.mjs";
import { deleteLearner } from "./tests/accounts.mjs";
import { LANGUAGE_WALKTHROUGHS, WALKTHROUGHS } from "./tests/walkthroughs.mjs";

// The learners a run of this part leaves behind if it dies (E2E_PART: CI runs a part a job, side by
// side, so each deletes only its own). "core", the default: the sandbox tier's and Python's
// walkthroughs'. A language: its walkthroughs' and its switch tests'. None: every one.
function leftovers(part = process.env.E2E_PART || "") {
  const languages = Object.keys(LANGUAGE_WALKTHROUGHS);
  const language = (lang) => [
    ...Object.keys(LANGUAGE_WALKTHROUGHS[lang]).map((id) => WALK_EMAIL(`${id}-${lang}`)),
    ...(lang === "java" ? ["switch-java-python", "switch-java-dotnet"].map(WALK_EMAIL) : []),
  ];
  const core = [SANDBOX_EMAIL, ...Object.keys(WALKTHROUGHS).map(WALK_EMAIL)];
  if (part === "core") return core;
  if (languages.includes(part)) return language(part);
  return [...core, ...languages.flatMap(language)];
}

export async function deleteLearnerSandbox() {
  // Deleting a learner deletes their sandbox too, wherever the run got to: the sandbox tier's, and
  // each walkthrough's (walkthroughs.spec.mjs deletes its own, unless the run died first).
  if (SIGNIN_KEY) {
    for (const email of leftovers()) {
      await deleteLearner(email).catch((err) => console.log(`deleting ${email}: ${err.message}`));
    }
  }
  // The sandbox tier's learner is core's (a language's part runs no sandbox tier).
  if (!["", "core"].includes(process.env.E2E_PART || "")) return;
  if (!fs.existsSync(LEARNER_STATE)) return;
  const api = await request.newContext({ baseURL: BASE_URL, storageState: LEARNER_STATE });
  try {
    const reset = await api.post("/api/sandbox/reset").catch((err) => err);
    console.log(`sandbox reset: ${reset.status?.() ?? reset.message}`);
    await api.delete("/api/session").catch(() => {});
  } finally {
    await api.dispose();
    fs.rmSync(LEARNER_STATE, { force: true });
  }
}

export default deleteLearnerSandbox;
