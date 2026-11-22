---
id: F5
title: Break it on purpose
teaser: Make the activity flaky, and watch the retry policy get it through, with no retry loop of yours.
learn: "Retry policies: Temporal retries a failing activity for you, so you write no retry loop."
concepts: [retry-policy]
minutes: 5
xp: 10
tier: 1
requires:
  - F4
check:
  kind: pending
files:
  - path: hello/workflow.py
    editable: true
  - path: hello/activities.py
  - path: hello/starter.py
  - path: hello/board.py
langs:
  typescript:
    files:
      - path: langs/typescript/hello/src/workflows.ts
        editable: true
      - path: langs/typescript/hello/src/activities.ts
      - path: langs/typescript/hello/src/starter.ts
      - path: langs/typescript/hello/src/board.ts
  java:
    files:
      - path: langs/java/hello/src/main/java/hello/HelloTripWorkflowImpl.java
        editable: true
      - path: langs/java/hello/src/main/java/hello/HelloTripWorkflow.java
      - path: langs/java/hello/src/main/java/hello/ActivitiesImpl.java
      - path: langs/java/hello/src/main/java/hello/Starter.java
      - path: langs/java/hello/src/main/java/hello/BoardingWorkflowImpl.java
  dotnet:
    files:
      - path: langs/dotnet/hello/HelloTripWorkflow.cs
        editable: true
      - path: langs/dotnet/hello/Activities.cs
      - path: langs/dotnet/hello/Starter.cs
      - path: langs/dotnet/hello/BoardingWorkflow.cs
---

## 5. Break it on purpose

Make the airport database flaky. Restart the worker with `FLAKY=1`, so four of every five attempts fail: each lookup fails on attempts 1 to 4 and gets through on attempt 5.

<!-- lang python -->
```bash
FLAKY=1 uv run hello-worker
```

Start another trip:

```bash
uv run hello-start LAX ORD
```
<!-- /lang -->
<!-- lang typescript -->
```bash
FLAKY=1 npm run worker
```

Start another trip:

```bash
npm run start -- LAX ORD
```
<!-- /lang -->
<!-- lang dotnet -->
```bash
FLAKY=1 ./hello worker
```

Start another trip:

```bash
./hello start LAX ORD
```
<!-- /lang -->
<!-- lang java -->
```bash
FLAKY=1 ./hello worker
```

Start another trip:

```bash
./hello start LAX ORD
```
<!-- /lang -->

It takes about 40 seconds, and it still finishes. While you wait,<!-- local --> open the workflow in the Temporal UI:<!-- /local --> its<!-- browser
 [**Pending Activities** tab](#trip/LAX-ORD/pending-activities)
--><!-- local --> **Pending Activities** tab<!-- /local --> shows the lookup's attempt count climbing and its last error, and the worker's log shows each `503`. When it's done, each **Activity Task Started** in its<!-- browser
 [**Event History**](#trip/LAX-ORD/history)
--><!-- local --> **Event History**<!-- /local --> shows **Attempt** 5: only the attempt that got through is recorded. You wrote no retry loop: the <!-- lang python -->`RetryPolicy`<!-- /lang --><!-- lang typescript -->retry policy<!-- /lang --><!-- lang dotnet -->retry policy<!-- /lang --><!-- lang java -->retry policy<!-- /lang --> did it, waiting a little longer after each failure.

So far a worker was always running. What if none is?
