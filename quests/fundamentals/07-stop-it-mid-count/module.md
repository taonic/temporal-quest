---
id: F7
title: Stop it mid-count
teaser: Stop a worker mid-count, and watch a new one rebuild, from the history, a count nobody saved.
learn: "Replay: a new worker rebuilds a workflow's state from its history."
concepts: [query, timer, replay]
minutes: 6
xp: 10
tier: 1
requires:
  - F6
check:
  kind: code
  tests:
    - tests/test_ch01_hello.py::test_boarding_counts_every_passenger_across_a_worker_restart
  hint: The boarding count didn't survive a worker restart. Is TODO(ch01) in hello/workflow.py done, and hello/board.py as it came?
files:
  - path: hello/workflow.py
    editable: true
  - path: hello/activities.py
  - path: hello/starter.py
  - path: hello/board.py
    # Editable for FC2, the challenge after this module: its choices go into the boarding loop.
    editable: true
    scratch: true
langs:
  typescript:
    files:
      - path: langs/typescript/hello/src/workflows.ts
        editable: true
      - path: langs/typescript/hello/src/activities.ts
      - path: langs/typescript/hello/src/starter.ts
      - path: langs/typescript/hello/src/board.ts
        # Editable for FC2, the challenge after this module: its choices go into the boarding loop.
        editable: true
        scratch: true
    hint: The boarding count didn't survive a worker restart. Is TODO(ch01) in src/workflows.ts done, and src/board.ts as it came?
  java:
    files:
      - path: langs/java/hello/src/main/java/hello/HelloTripWorkflowImpl.java
        editable: true
      - path: langs/java/hello/src/main/java/hello/HelloTripWorkflow.java
      - path: langs/java/hello/src/main/java/hello/ActivitiesImpl.java
      - path: langs/java/hello/src/main/java/hello/Starter.java
      - path: langs/java/hello/src/main/java/hello/BoardingWorkflowImpl.java
        # Editable for FC2, the challenge after this module: its choices go into the boarding loop.
        editable: true
        scratch: true
    hint: "The boarding count didn't survive a worker restart. Is TODO(ch01) in HelloTripWorkflowImpl.java done, and BoardingWorkflowImpl.java as it came?"
  dotnet:
    files:
      - path: langs/dotnet/hello/HelloTripWorkflow.cs
        editable: true
      - path: langs/dotnet/hello/Activities.cs
      - path: langs/dotnet/hello/Starter.cs
      - path: langs/dotnet/hello/BoardingWorkflow.cs
        editable: true
        scratch: true
    hint: "The boarding count didn't survive a worker restart. Is TODO(ch01) in HelloTripWorkflow.cs done, and BoardingWorkflow.cs as it came?"
---

## 7. Count with nothing saved

The trip's results came from an activity, so you might think Temporal just stores what activities return. This workflow has no activities at all. It boards a flight, one passenger every 2 seconds, and the count is a plain <!-- lang python -->`int` in the workflow, `self.on_board` in `hello/board.py`<!-- /lang --><!-- lang typescript -->number in the workflow, `onBoard` in `src/board.ts`<!-- /lang --><!-- lang dotnet -->field of the workflow, `onBoard` in `BoardingWorkflow.cs`<!-- /lang --><!-- lang java -->field of the workflow, `onBoard` in `BoardingWorkflowImpl.java`<!-- /lang -->. No database, no file. Your worker already runs it.

<!-- lang python -->
```bash
uv run hello-board SFO JFK
```
<!-- /lang -->
<!-- lang typescript -->
```bash
npm run board -- SFO JFK
```
<!-- /lang -->
<!-- lang dotnet -->
```bash
./hello board SFO JFK
```
<!-- /lang -->
<!-- lang java -->
```bash
./hello board SFO JFK
```
<!-- /lang -->

<!-- browser
[Open the boarding workflow's **Queries** tab](#workflow/board-sfo-jfk/query), pick **boarded** from the **Query Type** dropdown, and click **Run Query**.
-->
<!-- local -->
In the Temporal UI, open the `board-sfo-jfk-…` workflow and read its count:

1. Click the **Queries** tab.
2. Pick **boarded** from the **Query Type** dropdown, and click **Run Query**.
<!-- /local -->

You get something like `{"flight": "SFO→JFK", "boarded": 7, "seats": 40}`. Click **Refresh Query** to watch it climb. The worker's log counts too: `Boarded passenger 7/40`.

## 8. Stop it mid-count

- Stop the worker (Ctrl-C), and click **Refresh Query**. It spins for about 30 seconds, then fails: `query timed out before a worker could process it`. A worker answers queries, and there isn't one. Nothing else has the count: it was never saved.
- Start the worker again, and click **Refresh Query**. The count is where you left it, and climbing.

The new worker never saw this workflow: it replayed the history (the start, and every 2-second timer that fired) and ran the loop again to rebuild <!-- lang python -->`self.on_board`<!-- /lang --><!-- lang typescript -->`onBoard`<!-- /lang --><!-- lang dotnet -->`onBoard`<!-- /lang --><!-- lang java -->`onBoard`<!-- /lang -->. Its log picks up at the next passenger instead of counting from 1, because <!-- lang python -->`workflow.logger`<!-- /lang --><!-- lang typescript -->the workflow's `log`<!-- /lang --><!-- lang dotnet -->the workflow's logger (`Workflow.Logger`)<!-- /lang --><!-- lang java -->the workflow's logger (`Workflow.getLogger`)<!-- /lang --> stays quiet during a replay.

[![While the first worker runs it, each 2-second timer that fires is recorded in the history, and the worker keeps on_board, 7 by now, in memory: a query from the Temporal UI's Queries tab is answered by that worker, boarded: 7. With the worker stopped, nothing holds the count, and the same query times out: no worker. A new worker polls for work, gets the history (the start and the 7 timers that fired), replays it to rebuild on_board = 7, and starts the next timer; the query is answered again: 7, then 8 and on.](../../../docs/architecture/ex1-boarding.png)](../../../docs/architecture/ex1-boarding.html)

After 40 passengers, the starter prints `Flight SFO→JFK: 40 passengers boarded.` The state of a workflow is its history: anything the code computes from it, a worker can compute again.

## Check

<!-- lang python -->
```bash
./quest check 01-hello-temporal
```
<!-- /lang -->
<!-- lang typescript -->
```bash
quest check 01-hello-temporal
```
<!-- /lang -->
<!-- lang dotnet -->
```bash
quest check 01-hello-temporal
```
<!-- /lang -->
<!-- lang java -->
```bash
quest check 01-hello-temporal
```
<!-- /lang -->

It runs your workflow against a fresh Temporal server, checks the trip description, makes a lookup attempt fail to see it retried, and checks your timeout and retry policy. It also checks that the boarding counter, which you didn't write, still survives a worker restart.

**It takes about 10 seconds**, most of it waiting on real retries and timers. Wait for `✓ Check passed`.
