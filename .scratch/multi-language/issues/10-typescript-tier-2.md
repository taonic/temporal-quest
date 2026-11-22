# 10 · TypeScript: Fundamentals tier 2

Status: resolved
Blocked by: 09

## What

The fare hold (`condition` with a timeout, the `pay` Update and its validator, `patched`), the itinerary of child workflows, the saga, and the replayer (`Worker.runReplayHistory`). TypeScript variants of F8–F14 and FC3, plus histories recorded in TypeScript.

## Done when

All of Fundamentals passes in TypeScript, in `verify_modules.py` and in e2e.

## Answer

Done on 2026-11-22. All of Fundamentals now comes in TypeScript: F8–F14 and FC3 lost their `languages: [python]`, so exercise 06 (Building blocks) is `[python, typescript]` too.

- **`langs/typescript/hello`:**
  - `src/hold.ts`: the fare hold. F8's `condition(fn, ms)` (false on timeout), F9's `pay` update with its validator, F12's `patched('email-the-hold')`.
  - `src/itinerary.ts`: F10's `executeChild`, one child a leg (`<id>-leg-<n>`).
  - `src/saga.ts`: F11's undo loop, then F14's charge loop (on an `ActivityFailure` caused by `CardExpired`, wait for `new_card`, whose validator turns away the expired card).
  - `src/replay.ts`: F13's `Worker.runReplayHistory`.
  - The booking activities, and the starter's `hold`, `pay`, `itinerary` and `book` commands (`npm run hold -- 12A 20`…).
  - The lockfile is unchanged (`ApplicationFailure` comes from `@temporalio/activity`), so the snapshot didn't need a rebuild.
- **Histories:** `tests/histories/typescript/`. The hold from before the email was recorded from TypeScript; the trip that waited first is Python's (the same wire contract).
- **The checks:** the contract test runs tier 2 too. F12's check (the patch) used to replay through the learner's `replay.ts`, which is F13's TODO, so it failed until F13 was solved. The replay CLI now takes `--provided` (the SDK's replayer, not theirs), and F12's check uses it (CONTRACT.md, `langs.replay(…, provided=True)`). `verify_modules.py` prints the check's output when a case doesn't come out as expected.
- **The guide:** TypeScript text for F8–F14, with `langs.typescript` files, hints and F8's tour. F1's starter tour stop moved to the trip's start (the starter grew a `waitFor`).
- **FC3:** the three choices in TypeScript. "Skip it when replaying" uses `workflowInfo().unsafe.isReplaying`, so `hold.ts` imports `workflowInfo`. Recorded in both languages, and FC1's TypeScript recording again (`workflows.ts` changed).
- **The site:** `npm run <script> -- <args>` in prose gets a ▶, as `uv run …` does (a bare `npm run replay` doesn't).
- **e2e:** the building-blocks walkthrough takes a language (`buildingBlocks(BLOCKS.<lang>)`), and `LANGUAGE_WALKTHROUGHS.typescript` has it, tagged `@typescript`.
- **Verified:**
  - `verify_modules.py`: every module passes in both languages (open fails, solved passes), and FC1–FC3 are recorded, current, and right.
  - 199 course tests pass. A new one checks Building blocks in TypeScript: its commands, files, snippets and FC3, and no Python. The TODO test now covers every language.
  - 18 TypeScript checks pass (contract and building blocks).
  - The Python walkthrough of Hello Temporal still passes (the regression run).
  - **The TypeScript walkthroughs pass** on a local runner against Daytona: Building blocks (every step, ending with ✓ Check, 7.8 minutes) and Hello Temporal again.
- **Found by the walkthrough:**
  - `npm run book -- SFO JFK 1111` never exited: the booking's pending result kept Node running. The starter exits once it's done.
  - Step 8 didn't name its file, so a learner (and the walkthrough) had nothing to click. It names `saga.ts` now, in every language.
  - The Temporal UI shows a TypeScript update's rejection with a stack trace, in a second code box, which the walkthrough's dialog helper mistook for the input.
  - A language's snapshot name hashed the shared builder, so sizing Java (ticket 11) renamed TypeScript's snapshot, and TypeScript sandboxes failed to start ("snapshot doesn't exist"). The name now hashes only the language's own size (`LANGUAGE_RESOURCES` in `repo-files.mjs`), and the error names the snapshot it was looking for. ADR 0003 says so. New snapshot: `governance-course-typescript-236b872cd479`.
