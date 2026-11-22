# 07 · Challenges in any language

Status: resolved
Blocked by: 06
Spec: [../spec.md](../spec.md) (D5)

## What

- `challenge.md`: per-language `file`, `replace` and choice `code`.
- `scripts/challenges.py`: for a non-Python choice, patch the language's file in the temp copy, build it (nothing to build in TypeScript, which runs with `tsx`), and start a workflow-only worker from it. [The prototype's fc1_split.py](../prototype/fc1_split.py) does this for FC1. The scenario's activities run in Python on the same queue.
- `recordings/<lang>/`, and `record_challenges.py --lang`. `verify_modules.py` checks every language's recordings.
- The site picks the learner's language's recording and code.

## Done when

FC1–FC3 work as before in Python, with recordings moved to `recordings/python/`.

## Answer

Done on 2026-11-22.

- **`challenge.md`** takes `langs.<language>`: `file`, `replace` and `hint`. Each choice's `langs.<language>` takes `code` and `explanation`. Both `scripts/challenges.py` and `build.mjs` check that each other language has its `file`, `replace` and every choice's code. A challenge's text can have language blocks.
- **`scripts/challenges.py`.** In another language, `Kit` builds the choice's versions twice:
  - in Python, as before, so the scenario keeps its typed handles (`kit.load()`);
  - in the language, as a copy of `langs/<language>/hello` with the language's block swapped in, built by `build_language`.

  `kit.worker` starts that language's workflow-only worker for the version its workflows' Python module stands for (`hold__before`, or the choice), with the scenario's activities in Python beside it. Scenarios are unchanged.
- **Running it.** `./quest challenge FC1 B [--lang X]` runs in the learner's language (`.course/lang`, or Python where the branch doesn't have it). `record_challenges.py [FC1] [--lang X]` records into `recordings/<language>/`, every language of the challenge by default. `verify_modules.py` checks every language's recordings, and that every language's blocks apply.
- **Recordings** moved to `recordings/python/`. Their fingerprints didn't change, so they're still current.
- **The site's build** reads `recordings/<language>/`, keeps each language's file, replace, hint, code, explanation and recordings, and puts each language's challenges in the exercise's `byLang`. The generated content is unchanged, with the same version hash as after ticket 04.
- **Verified:**
  - Every Python choice of FC1–FC3 comes out as flagged, and `verify_modules.py` passes.
  - FC1 in TypeScript, on the prototype's code, with TypeScript choices written for the test, went through `challenges.run`: A gives up after 3 attempts, B finishes with "somewhere", C gets through on attempt 4. All three came out as flagged, with the same timelines as Python's, and the scenario wasn't changed.
