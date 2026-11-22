# 03 · The wire contract for hello

Status: resolved
Blocked by: 02
Spec: [../spec.md](../spec.md) (Contract, checks and challenges)

## What

- Rename the multi-word fields in Python: `BoardingRequest.seconds_per_passenger` → `pace`, `HoldStatus.seconds_left` → `remaining`, `BookingStatus.waiting_for_new_card` → `waiting`. Update the authoring masters, the snippets in the modules, the tests, the challenge scenarios and recordings, and the recorded histories.
- `hello/CONTRACT.md`: every workflow type, activity, query, update, task queue and payload field `hello` uses, with its exact wire name.
- The worker settings every language's `hello` reads: `HELLO_TASK_QUEUE` (default `hello`; `.env`'s `TASK_QUEUE` is the travel agent's) and `WORKER_MODE` (`all`, `workflows`, `activities`).
- A contract test that runs the Python starter against any language's worker, with its own activities. The checks don't exercise those activities (they run Python's), so this test is what keeps each language's activities matching the Python ones. For now it runs against Python only.

## Done when

The rename is in and `verify_modules.py` passes, and the contract is written down and its test passes against the Python worker.

## Answer

Done on 2026-11-22.

- **Renamed** in Python: `BoardingRequest.pace`, `HoldStatus.remaining`, `BookingStatus.waiting`. Only the wire fields changed. The workflow's own `self.waiting_for_new_card` stays, since it's what F14 teaches and it never goes on the wire. Changed with them: the masters (`hold.py`, `saga.py`), `hello/shared.py`, `board.py`, `starter.py`, the F2/F7/F14 tests, and FC2's choices and scenario. FC2 and FC3 were recorded again, with the same outcomes.
- **[hello/CONTRACT.md](../../../hello/CONTRACT.md)** lists:
  - the payloads, workflows, messages, child ids, the patch, the error types and the activities;
  - the worker settings: `HELLO_TASK_QUEUE`, `WORKER_MODE`, `FLAKY`/`FLAKY_FAILURES`.
- **[tests/test_contract.py](../../../tests/test_contract.py)** drives every workflow by its name with plain JSON (a client with no shared models), and checks results, query fields, update rejections, child ids, error types and activity order. 7 tests pass against Python's worker. Ticket 06 makes it run each language's worker.
- `verify_modules.py` passes ("every module behaves as expected"), and so do the course's 182 tests.
