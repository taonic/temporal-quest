# 0002 · One wire contract, so checks and challenge scenarios stay Python

Status: accepted (2026-11-22)
Context: [.scratch/multi-language/spec.md](../../.scratch/multi-language/spec.md)

## Decision

Every language's `hello` keeps one **wire contract** (`hello/CONTRACT.md`): the same workflow type names, activity names, query and update names, task queue and JSON field names as the Python version. Python's multi-word fields are renamed to single words so no language needs JSON-name annotations.

On top of the contract:

- **Checks** are one Python test suite. With `QUEST_LANG`, a check starts one worker in the learner's language, with only their workflows, as a subprocess (`tests/langs.py`). The activities run in Python, in process, and the check asserts on the result and the history. F13 runs the language's `replay` command. (Amended 2026-11-22 after the prototype: a worker per test, with the language's own activities, made TypeScript and Java checks miss their time limit.)
- **Challenge scenarios** stay Python. The learner's language runs a workflow-only worker from the patched file, and the scenario's fake activities run in a Python activity-only worker on the same task queue.
- **Recordings and histories** are kept per language. Java's version marker differs from the Core-based SDKs'.

## Why

Temporal is polyglot on the wire, and the checks already assert on histories more than on Python objects. One suite and one scenario per challenge, not four of each, keep the checks and hints consistent across languages.

## Consequences

- Each SDK has to set names explicitly where it would derive them differently.
- A local learner in another language needs uv to run checks.
- Native test suites only for a check the Python suite can't express.
- The learner's activities in their language aren't exercised by the checks. The contract test covers them.
