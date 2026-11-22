# 07 · Challenges in any language

Status: ready-for-agent
Blocked by: 06
Spec: [../spec.md](../spec.md) (D5)

## What

- `challenge.md`: per-language `file`, `replace` and choice `code`.
- `scripts/challenges.py`: for a non-Python choice, patch the language's file in the temp copy, build it (nothing to build in TypeScript, which runs with `tsx`), and start a workflow-only worker from it. [The prototype's fc1_split.py](../prototype/fc1_split.py) does this for FC1. The scenario's activities run in Python on the same queue.
- `recordings/<lang>/`, and `record_challenges.py --lang`. `verify_modules.py` checks every language's recordings.
- The site picks the learner's language's recording and code.

## Done when

FC1–FC3 work as before in Python, with recordings moved to `recordings/python/`.
