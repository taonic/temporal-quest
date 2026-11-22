# 01 · F14: an expired card waits for a new one

Status: done (2026-11-22), awaiting review
Spec: [../spec.md](../spec.md)

## What

- `hello/activities.py`: `EXPIRED_CARD = "1111"`, and `charge_card` raises `ApplicationError(type="CardExpired", non_retryable=True)` for it.
- `authoring/hello/saga.py` (rendered to `hello/saga.py` and `starter/hello/saga.py`): `@workflow.init` state, a `status` Query (`BookingStatus`), a `new_card` Update and its validator, and one `@@solution F14` block: the wait-and-retry loop around `charge_card`.
- `hello/starter.py` + `pyproject.toml`: `hello-book` stops waiting and says so when the booking waits for a new card; `hello-new-card ORIGIN DESTINATION CARD` sends the Update and prints the booking's result.
- `quests/fundamentals/12-wait-for-a-new-card/module.md`: id F14, tier 2, `requires: [F11]`, a code check, questions. Its step is `## 6.`; F12's steps become 7 and 8, F13's 9.
- Folders `12-versioning` → `13-`, `12x-versioning-challenge` → `13x-`, `13-testing` → `14-`. F12 `requires: [F14]`.
- `quests/paths/fundamentals.yaml`: F14 after F11, in the path and in exercise `06-building-blocks`.
- `tests/test_ch06_building_blocks.py`: an expired card waits and is charged again with the new one; the validator turns away the expired card.
- `course/e2e/tests/walkthroughs.mjs`: the step in exercise 6's walkthrough.

## Done when

`scripts/render.py --check` and `scripts/verify_modules.py` pass: F14's check fails with only F11 and before solved, and passes with F14 solved; F11's, F12's and F13's checks are unchanged. The course content builds.

## Comments

**2026-11-22, built.** As above, with three changes from the plan:

- **No code tour.** The build allows one tour per exercise, and exercise 6's is F8's. The step's text names the given code instead.
- **`hello-book` stops when the booking waits.** It queries `status` while it waits for the result, and when the booking is waiting for a new card, it says so and exits 0. The new card then comes from the same terminal.
- **The client commands print the innermost failure** (`why()` in `hello/starter.py`). Before, a failed booking printed `The workflow failed: Activity task failed`, so F11's text (`card ending 0000 was declined`) didn't match what learners saw. It does now, and F9's refusal drops its `ValueError:` prefix.

Verified: `render.py --check`; `verify_modules.py` (F14 fails open and passes solved; F11, F12 and F13 unchanged; FC3's recordings current after the folder move); `pytest tests/test_ch06_building_blocks.py tests/test_base.py`; `npm run content` and `npm test` in `course/` (178 pass; Blocksmith's criteria now read "Pass F8–F14 and FC3"); every command in the module run against a dev server, with the TODO open and solved. Not run: the e2e walkthrough (`course/e2e`), which needs a sandbox.

Not done: a challenge after F14 (FCn: a retry policy with more attempts, a loop with no wait, catch and return, wait for the Update); a boss story, since the F-boss has no pool yet.
