# 03 · The wire contract for hello

Status: ready-for-agent
Blocked by: 02
Spec: [../spec.md](../spec.md) (Contract, checks and challenges)

## What

- Rename the multi-word fields in Python: `BoardingRequest.seconds_per_passenger` → `pace`, `HoldStatus.seconds_left` → `remaining`, `BookingStatus.waiting_for_new_card` → `waiting`. Update the authoring masters, the snippets in the modules, the tests, the challenge scenarios and recordings, and the recorded histories.
- `hello/CONTRACT.md`: every workflow type, activity, query, update, task queue and payload field `hello` uses, with its exact wire name.
- The worker settings every language's `hello` reads: `HELLO_TASK_QUEUE` (default `hello`; `.env`'s `TASK_QUEUE` is the travel agent's) and `WORKER_MODE` (`all`, `workflows`, `activities`).
- A contract test that runs the Python starter against any language's worker, with its own activities. The checks don't exercise those activities (they run Python's), so this test is what keeps each language's activities matching the Python ones. For now it runs against Python only.

## Done when

The rename is in and `verify_modules.py` passes, and the contract is written down and its test passes against the Python worker.
