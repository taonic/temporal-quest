# 06 · Checks in any language

Status: resolved
Blocked by: 03, 04
Spec: [../spec.md](../spec.md) (D4, D6)

## What

- `tests/langs.py`: for each language, how to build, how to start a workflow-only worker on a queue, and how to replay a history. `QUEST_LANG` picks the language, and Python is the default (in process, as today). Start from [the prototype's](../prototype/langs.py), which waits for the worker's poller with `DescribeTaskQueue`.
- Move the Fundamentals tests onto it: one worker in the learner's language per check (a session fixture), with the activities in Python, in process, so the monkeypatches stay. F13 calls the language's replay command.
- TypeScript runs with `tsx` and has no build step. Java runs with the JVM settings in the spec.
- `tests/histories/<lang>/` and `record_histories.py --lang`.

## Done when

Every Fundamentals check passes through the adapter for Python, with no slower runs than today, and the prototype's F2 checks for TypeScript, Java and .NET are within the spec's time limits.

## Answer

Done on 2026-11-22.

- **[tests/langs.py](../../../tests/langs.py)** reads `QUEST_LANG`, which is Python unless set.
  - **Python's checks** run in process, as they always have, and are no slower: 15 Fundamentals checks in 10.8 s, against 10.4 s before.
  - **Another language's checks** start its workflow-only worker from `langs/<lang>/hello`: TypeScript with `tsx`, Java with the small JVM, .NET from its build. It runs beside Python's activities, once per task queue for the whole check. A check that restarts the worker (F7) asks for `fresh=True`.
  - **Failures.** A compile error fails the check with its output, and so does a worker that stops before it polls.
  - **Replays.** `replay(path)` runs the language's `replay --history FILE`, which is now in the contract: 0 when it replays, 1 on nondeterminism.
  - **`own_activities=True`** runs the language's own activities instead. The contract test uses it.
- **The tests.** `test_ch01_hello.py` and `test_ch06_building_blocks.py` use `langs.queue()` and `langs.hello_worker()`. F12/F13's replays go through the language's command, with histories from `tests/histories/<lang>/`. `conftest.py` stops the language workers at the end of a check.
- **[tests/test_contract.py](../../../tests/test_contract.py)** runs on the language's worker, with its own activities.
- **`scripts/record_histories.py --lang X`** records the hold with that language's code (its masters rendered with every TODO solved but F12's) and copies Python's trip-that-waited-first history. It first runs for real in ticket 10.
- **Verified:**
  - Python: `verify_modules.py` ("every module behaves as expected") and the 22 contract and Fundamentals tests pass.
  - The other languages, against the prototype (`QUEST_LANGS_ROOT=.scratch/multi-language/prototype`): F2's three checks pass in TypeScript (6.9 s), Java (10.0 s, with its Gradle build) and .NET (6.7 s). The contract test's trip passes with each one's own activities.
  - In TypeScript, an open TODO fails with the hint after the 15 s timeout, and a syntax error fails at once with the compiler's output.
