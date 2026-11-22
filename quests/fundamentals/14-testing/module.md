---
id: F13
title: Catch a breaking change before it ships
teaser: "Replay real histories against your new code, and find the change that would break a running workflow on your machine."
learn: "Replay testing: catching a non-deterministic change before it reaches a running workflow."
concepts: [replay-testing, determinism]
minutes: 6
xp: 10
tier: 2
requires: [F12]
check:
  kind: code
  tests:
    - tests/test_ch06_building_blocks.py::test_replay_passes_a_history_the_code_still_matches
    - tests/test_ch06_building_blocks.py::test_replay_catches_a_history_the_code_no_longer_matches
  hint: "replay() isn't written yet. Look for the TODO(ch06) in hello/replay.py: build a Replayer with the WORKFLOWS, the pydantic data converter and the RUNNER, then await replayer.replay_workflow(history)."
files:
  - path: hello/replay.py
    editable: true
  - path: hello/hold.py
    editable: true
questions:
  - How do I test a Temporal workflow?
  - What does the Replayer do?
  - How do I get histories from production to replay in CI?
  - How does the time-skipping test environment work?
langs:
  typescript:
    files:
    - path: langs/typescript/hello/src/replay.ts
      editable: true
    - path: langs/typescript/hello/src/hold.ts
      editable: true
    hint: "The replay isn't written yet. Look for the TODO(ch06) in replay() in src/replay.ts: await Worker.runReplayHistory({ workflowsPath: require.resolve('./workflows') }, history)."
  java:
    files:
      - path: langs/java/hello/src/main/java/hello/Replay.java
        editable: true
      - path: langs/java/hello/src/main/java/hello/FareHoldWorkflowImpl.java
        editable: true
      - path: langs/java/hello/src/main/java/hello/FareHoldWorkflow.java
    hint: "The replay isn't written yet. Look for the TODO(ch06) in replay() in Replay.java: WorkflowReplayer.replayWorkflowExecution(history, HelloTripWorkflowImpl.class, ...), with each of the worker's workflow classes."
  dotnet:
    files:
      - path: langs/dotnet/hello/Replay.cs
        editable: true
      - path: langs/dotnet/hello/FareHoldWorkflow.cs
        editable: true
    hint: "The replay isn't written yet. Look for the TODO(ch06) in ReplayAsync in Replay.cs: a WorkflowReplayer, with WorkflowReplayerOptions that have Config.Converter and HelloWorker.Workflows, and await its ReplayWorkflowAsync(history)."
---

## 12. Replay it first

Step 10 found its break the hard way: on a running hold. A **replayer** finds it first. It's a worker with no server: give it a history and your code, and it fails if they no longer agree. <!-- lang python -->In `hello/replay.py`, replace the `TODO(ch06)` with:<!-- /lang --><!-- lang typescript -->In `src/replay.ts`, replace the `TODO(ch06)` with:<!-- /lang -->
<!-- lang dotnet -->In `Replay.cs`, replace the `TODO(ch06)` with:<!-- /lang -->
<!-- lang java -->In `Replay.java`, replace the `TODO(ch06)` with:<!-- /lang -->

```python hello/replay.py
# A replayer is a worker with no server: it runs the workflow code over a history, and
# raises if the code doesn't make the same decisions the history recorded.
replayer = Replayer(workflows=WORKFLOWS, data_converter=pydantic_data_converter, workflow_runner=RUNNER)
await replayer.replay_workflow(history)
```

```typescript langs/typescript/hello/src/replay.ts
// A replayer is a worker with no server: it runs the workflow code over a history, and throws
// if the code doesn't make the same decisions the history recorded.
await Worker.runReplayHistory({ workflowsPath: require.resolve('./workflows') }, history);
```

```java langs/java/hello/src/main/java/hello/Replay.java
// A replayer is a worker with no server: it runs the workflow code over a history, and throws
// if the code doesn't make the same decisions the history recorded.
WorkflowReplayer.replayWorkflowExecution(history, HelloTripWorkflowImpl.class, BoardingWorkflowImpl.class,
        FareHoldWorkflowImpl.class, ItineraryWorkflowImpl.class, BookTripWorkflowImpl.class);
```

```csharp langs/dotnet/hello/Replay.cs
// A replayer is a worker with no server: it runs the workflow code over a history, and throws
// if the code doesn't make the same decisions the history recorded.
var options = new WorkflowReplayerOptions { DataConverter = Config.Converter };
foreach (var workflow in HelloWorker.Workflows) options.Workflows.Add(workflow);
await new WorkflowReplayer(options).ReplayWorkflowAsync(history);
```

<!-- lang python -->`hello-replay`<!-- /lang --><!-- lang typescript -->`npm run replay`<!-- /lang --><!-- lang dotnet -->`./hello replay`<!-- /lang --><!-- lang java -->`./hello replay`<!-- /lang --> fetches a workflow's history from Temporal and replays it on the code in your editor, with no worker restart. Replay the two holds from the last module: 14C, from before the email, and 15A, which sent one. (No 15A? <!-- lang python -->`uv run hello-hold 15A 5`<!-- /lang --><!-- lang typescript -->`npm run hold -- 15A 5`<!-- /lang --><!-- lang dotnet -->`./hello hold 15A 5`<!-- /lang --><!-- lang java -->`./hello hold 15A 5`<!-- /lang --> makes one.)

<!-- lang python -->
```bash
uv run hello-replay hold-14c
uv run hello-replay hold-15a
```
<!-- /lang -->
<!-- lang typescript -->
```bash
npm run replay -- hold-14c
npm run replay -- hold-15a
```
<!-- /lang -->
<!-- lang dotnet -->
```bash
./hello replay hold-14c
./hello replay hold-15a
```
<!-- /lang -->
<!-- lang java -->
```bash
./hello replay hold-14c
./hello replay hold-15a
```
<!-- /lang -->

Both: `✓ … replays on this code`.

## 13. Catch a teammate's change

A teammate is moving emails to another service, so they delete the email step from <!-- lang python -->`hello/hold.py`<!-- /lang --><!-- lang typescript -->`src/hold.ts`<!-- /lang --><!-- lang dotnet -->`FareHoldWorkflow.cs`<!-- /lang --><!-- lang java -->`FareHoldWorkflowImpl.java`<!-- /lang -->, `if` and all.

- Delete it, save, and don't restart the worker.
- Replay both again: <!-- lang python -->`uv run hello-replay hold-14c`<!-- /lang --><!-- lang typescript -->`npm run replay -- hold-14c`<!-- /lang --><!-- lang dotnet -->`./hello replay hold-14c`<!-- /lang --><!-- lang java -->`./hello replay hold-14c`<!-- /lang -->, then <!-- lang python -->`uv run hello-replay hold-15a`<!-- /lang --><!-- lang typescript -->`npm run replay -- hold-15a`<!-- /lang --><!-- lang dotnet -->`./hello replay hold-15a`<!-- /lang --><!-- lang java -->`./hello replay hold-15a`<!-- /lang -->. 14C still replays: it never sent an email. 15A doesn't: `✗ hold-15a-… doesn't replay on this code`.
- Put the step back (undo, or **Revert** on step 11's snippet).

Every hold that sent the email would get stuck the moment it was replayed, and you found out on your machine, before shipping.

<!-- lang python -->In CI, it's the same with saved histories: `tests/histories/` keeps two as JSON, and `tests/test_ch06_building_blocks.py` replays them, one that must pass and one that must fail. For workflows that wait days, `WorkflowEnvironment.start_time_skipping()` runs their tests with the timers skipped.<!-- /lang --><!-- lang typescript -->In CI, it's the same with saved histories: `tests/histories/typescript/` keeps two as JSON, and the checks replay them, one that must pass and one that must fail. For workflows that wait days, `TestWorkflowEnvironment.createTimeSkipping()` runs their tests with the timers skipped.<!-- /lang -->
<!-- lang dotnet -->In CI, it's the same with saved histories: `tests/histories/dotnet/` keeps two as JSON, and the checks replay them, one that must pass and one that must fail. For workflows that wait days, `WorkflowEnvironment.StartTimeSkippingAsync()` runs their tests with the timers skipped.<!-- /lang -->
<!-- lang java -->In CI, it's the same with saved histories: `tests/histories/java/` keeps two as JSON, and the checks replay them, one that must pass and one that must fail. For workflows that wait days, the SDK's `TestWorkflowEnvironment` runs their tests with the timers skipped.<!-- /lang -->

## Check

<!-- lang python -->
```bash
./quest check 06-building-blocks
```
<!-- /lang -->
<!-- lang typescript -->
```bash
quest check 06-building-blocks
```
<!-- /lang -->
<!-- lang dotnet -->
```bash
quest check 06-building-blocks
```
<!-- /lang -->
<!-- lang java -->
```bash
quest check 06-building-blocks
```
<!-- /lang -->

It runs each module's check against a fresh Temporal server: a hold that runs out, one that's paid for and one a bad card can't pay, an itinerary of child workflows, a declined booking that's undone, an old hold that still replays beside a new one that emails, and your replayer telling a matching history from one that isn't. **It takes about 15 seconds.** Wait for `✓ Check passed`.
