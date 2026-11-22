# 06 · Checks in any language

Status: ready-for-agent
Blocked by: 03, 04
Spec: [../spec.md](../spec.md) (D4, D6)

## What

- `tests/langs.py`: for each language, how to build, how to start a workflow-only worker on a queue, and how to replay a history. `QUEST_LANG` picks the language, and Python is the default (in process, as today). Start from [the prototype's](../prototype/langs.py), which waits for the worker's poller with `DescribeTaskQueue`.
- Move the Fundamentals tests onto it: one worker in the learner's language per check (a session fixture), with the activities in Python, in process, so the monkeypatches stay. F13 calls the language's replay command.
- TypeScript runs with `tsx` and has no build step. Java runs with the JVM settings in the spec.
- `tests/histories/<lang>/` and `record_histories.py --lang`.

## Done when

Every Fundamentals check passes through the adapter for Python, with no slower runs than today, and the prototype's F2 checks for TypeScript, Java and .NET are within the spec's time limits.
