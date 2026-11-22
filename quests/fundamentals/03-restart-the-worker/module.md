---
id: F3
title: Restart the worker, and watch it finish
teaser: Restart the worker, and watch a run that started before your fix finish after it.
learn: "Durable execution: a fix shipped mid-run lets a run that started before it finish."
concepts: [durable-execution, event-history]
minutes: 4
xp: 10
tier: 1
requires:
  - F2
check:
  kind: pending
files:
  - path: hello/workflow.py
    editable: true
  - path: hello/activities.py
  - path: hello/starter.py
  - path: hello/board.py
---

## 3. Restart the worker, and watch it finish

Restart the worker<!-- local --> (Ctrl-C, then start it again)<!-- /local -->. Within a few seconds, the starter that was waiting prints:

```
Your trip: San Francisco (SFO) to New York (JFK).
```

Same run, started before your fix, finished after it. **Temporal remembers where the program was, even when the process doesn't.**

<!-- browser
[Open its workflow's Event History](#trip/SFO-JFK/history) to see how it got there.
-->
<!-- local -->Open the workflow again from the link the starter printed, and click its **Event History** tab.<!-- /local -->

It's **Completed**, with the trip as its **Result**. The events are newest first. Near the bottom, the red **Workflow Task Failed** is your `NotImplementedError`, from before the fix. Everything above it came after the fix, in the same run: the two lookups, then **Workflow Execution Completed**.

The bug paused the workflow instead of ending it. Temporal retried the failed step until a worker had working code, and carried on from there. That's durable execution.
