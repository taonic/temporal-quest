---
id: F1
title: Run it, and see it stop
teaser: Meet the pieces of a Temporal program, start a workflow, and watch a bug pause it instead of failing it.
learn: "The pieces of a Temporal program, and why a bug pauses a workflow instead of failing it."
concepts: [workflow, worker, durable-execution]
minutes: 7
xp: 10
tier: 1
requires: []
check:
  kind: pending
files:
  - path: hello/workflow.py
    editable: true
  - path: hello/activities.py
  - path: hello/starter.py
  - path: hello/board.py
questions:
  - What's the difference between a workflow and an activity?
  - Why does my workflow pick up where it left off after I fix the bug?
  - How do activity retry policies and timeouts work together?
  - What does start_to_close_timeout actually limit?
  - Where is a workflow's state while no worker is running?
tour:
  - file: hello/workflow.py
    from: '"""The workflow:'
    to: Temporal records each result
    title: A workflow is deterministic
    body: "This file is the workflow: plain async Python that Temporal can **replay** from its history, on any worker, at any time. So it never touches the outside world itself. Anything that does goes through an activity."
  - file: hello/workflow.py
    from: "with workflow.unsafe.imports_passed_through():"
    title: Imports from outside the sandbox
    body: "The SDK runs workflow code in a sandbox that guards determinism. These come from outside it: the activity (the workflow only needs its name and types, it never runs it) and the shared data models."
  - file: hello/workflow.py
    from: "@workflow.defn"
    to: 'return f"Your trip:'
    title: The workflow and its entry point
    body: "`@workflow.defn` marks the class, `@workflow.run` is the method Temporal starts. Each `await` is a step Temporal records, so a worker that restarts carries on after the last one that finished."
  - file: hello/workflow.py
    from: "async def airport(self, code: str)"
    title: Your TODO
    body: This should ask Temporal to run `lookup_airport`, with a timeout for each attempt and a retry policy. Until it does, it raises, and Temporal **pauses** the workflow and retries this step rather than failing it.
  - file: hello/activities.py
    from: "@activity.defn"
    title: "The activity: where the world gets in"
    body: The one place that does I/O (here a dict stands in for an airport database). Activities can fail and be retried; `activity.info().attempt` says which try this is, and `FLAKY=1` fails the first four of each lookup so you can watch.
  - file: hello/starter.py
    from: "async def main(origin: str, destination: str)"
    title: The starter is just a client
    body: "It records a workflow on the task queue the worker polls, under an id of its own, prints a link to it, and waits for the result. The workflow doesn't need it waiting: stop the starter and the workflow carries on."
  - file: hello/board.py
    from: "async def run(self, flight: BoardingRequest)"
    title: A count nobody saves
    body: "Section 7's workflow: no activities, just a durable timer and `self.on_board += 1`. Stop the worker and start it again, and the new worker replays the history (every timer that fired) and runs this loop again to rebuild the count."
  - file: hello/board.py
    from: "@workflow.query"
    to: return BoardingStatus(
    title: "Reading it: a query"
    body: The Temporal UI's **Queries** tab calls this. A worker answers from the workflow's state, so with no worker running the query has no one to answer it.
langs:
  typescript:
    files:
      - path: langs/typescript/hello/src/workflows.ts
        editable: true
      - path: langs/typescript/hello/src/activities.ts
      - path: langs/typescript/hello/src/starter.ts
      - path: langs/typescript/hello/src/board.ts
    questions:
      - What's the difference between a workflow and an activity?
      - Why does my workflow pick up where it left off after I fix the bug?
      - How do activity retry policies and timeouts work together?
      - What does startToCloseTimeout actually limit?
      - Where is a workflow's state while no worker is running?
    tour:
      - file: langs/typescript/hello/src/workflows.ts
        from: "// The workflows: durable functions."
        to: asks for that through activities
        title: A workflow is deterministic
        body: "This file holds the workflows: plain async TypeScript that Temporal can **replay** from its history, on any worker, at any time. So it never touches the outside world itself. Anything that does goes through an activity."
      - file: langs/typescript/hello/src/workflows.ts
        from: "import { proxyActivities }"
        to: "import type { Airport, TripRequest }"
        title: Only the activities' types
        body: "The worker bundles workflow code on its own and runs it in a sandbox that guards determinism. It imports the activities' *types* only: a workflow never runs an activity, it asks Temporal to."
      - file: langs/typescript/hello/src/workflows.ts
        from: export async function HelloTripWorkflow
        to: "return `Your trip:"
        title: The workflow
        body: "An exported async function is a workflow, named after it. Each `await` is a step Temporal records, so a worker that restarts carries on after the last one that finished."
      - file: langs/typescript/hello/src/workflows.ts
        from: "async function airport(code: string)"
        to: "throw new Error"
        title: Your TODO
        body: This should ask Temporal to run `lookup_airport`, with a timeout for each attempt and a retry policy. Until it does, it throws, and Temporal **pauses** the workflow and retries this step rather than failing it.
      - file: langs/typescript/hello/src/activities.ts
        from: export async function lookup_airport
        to: return airport;
        title: "The activity: where the world gets in"
        body: The one place that does I/O (here a table stands in for an airport database). Activities can fail and be retried; `activityInfo().attempt` says which try this is, and `FLAKY=1` fails the first four of each lookup so you can watch.
      - file: langs/typescript/hello/src/starter.ts
        from: "    const trip: TripRequest"
        to: "hello-${route}-${short()}` }));"
        title: The starter is just a client
        body: "It records a workflow on the task queue the worker polls, under an id of its own; `waitFor`, above, prints a link to it and waits for the result. The workflow doesn't need it waiting: stop the starter and the workflow carries on."
      - file: langs/typescript/hello/src/board.ts
        from: export async function BoardingWorkflow
        to: "return `Flight"
        title: A count nobody saves
        body: "Section 7's workflow: no activities, just a durable timer and `onBoard += 1`. Stop the worker and start it again, and the new worker replays the history (every timer that fired) and runs this loop again to rebuild the count."
      - file: langs/typescript/hello/src/board.ts
        from: "setHandler(boarded"
        title: "Reading it: a query"
        body: The Temporal UI's **Queries** tab calls this. A worker answers from the workflow's state, so with no worker running the query has no one to answer it.
  java:
    files:
      - path: langs/java/hello/src/main/java/hello/HelloTripWorkflowImpl.java
        editable: true
      - path: langs/java/hello/src/main/java/hello/HelloTripWorkflow.java
      - path: langs/java/hello/src/main/java/hello/ActivitiesImpl.java
      - path: langs/java/hello/src/main/java/hello/Starter.java
      - path: langs/java/hello/src/main/java/hello/BoardingWorkflowImpl.java
    questions:
      - What's the difference between a workflow and an activity?
      - Why does my workflow pick up where it left off after I fix the bug?
      - How do activity retry policies and timeouts work together?
      - What does the start-to-close timeout actually limit?
      - Where is a workflow's state while no worker is running?
    tour:
      - file: langs/java/hello/src/main/java/hello/HelloTripWorkflowImpl.java
        from: " * The trip workflow: a durable function."
        to: asks for that through activities
        title: A workflow is deterministic
        body: "This class is the workflow's code: plain Java that Temporal can **replay** from its history, on any worker, at any time. So it never touches the outside world itself. Anything that does goes through an activity."
      - file: langs/java/hello/src/main/java/hello/HelloTripWorkflow.java
        from: "@WorkflowInterface"
        to: "String run(TripRequest trip);"
        title: The workflow's interface
        body: "Java describes a workflow with an interface. `@WorkflowMethod` is the method a run starts with, and its `name` is the workflow type a client in any language starts it by. The worker registers the class that implements it."
      - file: langs/java/hello/src/main/java/hello/HelloTripWorkflowImpl.java
        from: "    public String run(TripRequest trip)"
        to: "return \"Your trip: \""
        title: The workflow
        body: "`run()` is the workflow. Each activity it calls is a step Temporal records, so a worker that restarts carries on after the last one that finished."
      - file: langs/java/hello/src/main/java/hello/HelloTripWorkflowImpl.java
        from: "private Airport airport(String code)"
        to: "throw new UnsupportedOperationException"
        title: Your TODO
        body: This should ask Temporal to run `lookup_airport`, with a timeout for each attempt and a retry policy. Until it does, it throws, and Temporal **pauses** the workflow and retries this step rather than failing it.
      - file: langs/java/hello/src/main/java/hello/ActivitiesImpl.java
        from: "    public Airport lookupAirport(String code)"
        to: return airport;
        title: "The activity: where the world gets in"
        body: "The one place that does I/O (here a table stands in for an airport database). Activities can fail and be retried; `getInfo().getAttempt()` says which try this is, and `FLAKY=1` fails the first four of each lookup so you can watch. Its name on the wire, `lookup_airport`, is set in `Activities.java`."
      - file: langs/java/hello/src/main/java/hello/Starter.java
        from: "            case \"start\" -> {"
        to: "new TripRequest(origin, destination)), null);"
        title: The starter is just a client
        body: "It records a workflow on the task queue the worker polls, under an id of its own; `waitFor`, below, prints a link to it and waits for the result. The workflow doesn't need it waiting: stop the starter and the workflow carries on."
      - file: langs/java/hello/src/main/java/hello/BoardingWorkflowImpl.java
        from: "    public String run(BoardingRequest request)"
        to: "return \"Flight \""
        title: A count nobody saves
        body: "Section 7's workflow: no activities, just a durable timer and `onBoard += 1`. Stop the worker and start it again, and the new worker replays the history (every timer that fired) and runs this loop again to rebuild the count."
      - file: langs/java/hello/src/main/java/hello/BoardingWorkflowImpl.java
        from: "    public BoardingStatus boarded()"
        title: "Reading it: a query"
        body: The Temporal UI's **Queries** tab calls this. A worker answers from the workflow's state, so with no worker running the query has no one to answer it.
  dotnet:
    files:
      - path: langs/dotnet/hello/HelloTripWorkflow.cs
        editable: true
      - path: langs/dotnet/hello/Activities.cs
      - path: langs/dotnet/hello/Starter.cs
      - path: langs/dotnet/hello/BoardingWorkflow.cs
    questions:
      - What's the difference between a workflow and an activity?
      - Why does my workflow pick up where it left off after I fix the bug?
      - How do activity retry policies and timeouts work together?
      - What does StartToCloseTimeout actually limit?
      - Where is a workflow's state while no worker is running?
    tour:
      - file: langs/dotnet/hello/HelloTripWorkflow.cs
        from: "// The workflow: a durable function"
        to: "outside world itself. It asks for that through activities"
        title: A workflow is deterministic
        body: "This class is the workflow: plain C# that Temporal can **replay** from its history, on any worker, at any time. So it never touches the outside world itself. Anything that does goes through an activity."
      - file: langs/dotnet/hello/HelloTripWorkflow.cs
        from: "[Workflow(\"HelloTripWorkflow\")]"
        to: "return $\"Your trip:"
        title: The workflow
        body: "`[Workflow]` names the workflow type a client in any language starts it by, and `[WorkflowRun]` is the method a run starts with. Each `await` is a step Temporal records, so a worker that restarts carries on after the last one that finished."
      - file: langs/dotnet/hello/HelloTripWorkflow.cs
        from: "private static async Task<Airport> AirportAsync"
        to: "throw new NotImplementedException"
        title: Your TODO
        body: This should ask Temporal to run `lookup_airport`, with a timeout for each attempt and a retry policy. Until it does, it throws, and Temporal **pauses** the workflow and retries this step rather than failing it.
      - file: langs/dotnet/hello/Activities.cs
        from: "    [Activity(\"lookup_airport\")]"
        to: ": throw new ArgumentException"
        title: "The activity: where the world gets in"
        body: "The one place that does I/O (here a table stands in for an airport database). Activities can fail and be retried; `Info.Attempt` says which try this is, and `FLAKY=1` fails the first four of each lookup so you can watch. `[Activity(\"lookup_airport\")]` gives it its name on the wire."
      - file: langs/dotnet/hello/Starter.cs
        from: "            case \"start\":"
        to: "new TripRequest(origin, destination)));"
        title: The starter is just a client
        body: "It records a workflow on the task queue the worker polls, under an id of its own; `WaitForAsync`, below, prints a link to it and waits for the result. The workflow doesn't need it waiting: stop the starter and the workflow carries on."
      - file: langs/dotnet/hello/BoardingWorkflow.cs
        from: "    public async Task<string> RunAsync(BoardingRequest request)"
        to: "return $\"Flight"
        title: A count nobody saves
        body: "Section 7's workflow: no activities, just a durable timer and `onBoard += 1`. Stop the worker and start it again, and the new worker replays the history (every timer that fired) and runs this loop again to rebuild the count."
      - file: langs/dotnet/hello/BoardingWorkflow.cs
        from: "    [WorkflowQuery(\"boarded\")]"
        title: "Reading it: a query"
        body: The Temporal UI's **Queries** tab calls this. A worker answers from the workflow's state, so with no worker running the query has no one to answer it.
---

Before we give an agent the keys to anything, we need a program that can't lose its place. That's what Temporal is for. In this exercise you build the smallest useful Temporal program: a workflow that looks up two airports and describes a trip.

There's no agent yet. Every idea here comes back in the next three exercises.

## The pieces

<!-- lang python -->
| Piece | What it is | In this exercise |
|---|---|---|
| **Workflow** | A durable function: Temporal records every step, so it can resume anywhere. | `HelloTripWorkflow` in `hello/workflow.py` |
| **Activity** | A step with side effects: a network call, a database write, a model call. | `lookup_airport` in `hello/activities.py` |
| **Worker** | The process that runs your workflow and activity code. | `uv run hello-worker` |
| **Client** | Starts workflows and asks about them. | `uv run hello-start SFO JFK` |
| **History** | Every step, recorded by Temporal: the source of truth. | The Temporal UI, http://localhost:8233 |
<!-- /lang -->
<!-- lang typescript -->
| Piece | What it is | In this exercise |
|---|---|---|
| **Workflow** | A durable function: Temporal records every step, so it can resume anywhere. | `HelloTripWorkflow` in `src/workflows.ts` |
| **Activity** | A step with side effects: a network call, a database write, a model call. | `lookup_airport` in `src/activities.ts` |
| **Worker** | The process that runs your workflow and activity code. | `npm run worker` |
| **Client** | Starts workflows and asks about them. | `npm run start -- SFO JFK` |
| **History** | Every step, recorded by Temporal: the source of truth. | The Temporal UI, http://localhost:8233 |
<!-- /lang -->
<!-- lang dotnet -->
| Piece | What it is | In this exercise |
|---|---|---|
| **Workflow** | A durable function: Temporal records every step, so it can resume anywhere. | `HelloTripWorkflow` in `HelloTripWorkflow.cs` |
| **Activity** | A step with side effects: a network call, a database write, a model call. | `lookup_airport` in `Activities.cs` |
| **Worker** | The process that runs your workflow and activity code. | `./hello worker` |
| **Client** | Starts workflows and asks about them. | `./hello start SFO JFK` |
| **History** | Every step, recorded by Temporal: the source of truth. | The Temporal UI, http://localhost:8233 |
<!-- /lang -->
<!-- lang java -->
| Piece | What it is | In this exercise |
|---|---|---|
| **Workflow** | A durable function: Temporal records every step, so it can resume anywhere. | `HelloTripWorkflow` in `HelloTripWorkflowImpl.java` |
| **Activity** | A step with side effects: a network call, a database write, a model call. | `lookup_airport` in `ActivitiesImpl.java` |
| **Worker** | The process that runs your workflow and activity code. | `./hello worker` |
| **Client** | Starts workflows and asks about them. | `./hello start SFO JFK` |
| **History** | Every step, recorded by Temporal: the source of truth. | The Temporal UI, http://localhost:8233 |
<!-- /lang -->

### How the pieces fit together

Follow a trip through this diagram: from the starter to the server, the worker and the activity, and back. The steps below break or stop these pieces one at a time, so it helps to know where each sits. Click it to explore a larger version.

[![The starter (hello-start SFO JFK) asks the Temporal server to start a workflow, and the server keeps that workflow's history. The hello-worker runs HelloTripWorkflow, which calls the lookup_airport activity; with FLAKY=1 its attempts 1 to 4 fail, and the RetryPolicy (2s, ×2, at most 6s) retries until attempt 5 gets through. The Temporal UI reads the history. The history, not the worker, holds the run: a new worker replays it and carries on, and with no worker the work waits and nothing is lost.](../../../docs/architecture/ex1-hello.png)](../../../docs/architecture/ex1-hello.html)

First, somewhere for all of it to run.

## 0. Start your sandbox

<!-- browser
Everything in this workshop runs in your sandbox: a small cloud machine of your own, with a Temporal server already running on it. The editor, the two terminals and the Temporal UI on the left all work in it. It sleeps when you're idle, wakes when you come back, and keeps your work for a day.

[Start my sandbox](#sandbox)

The first start takes a minute or two. When it's ready, open the **Temporal UI** at http://localhost:8233: the Temporal server your workflows will run on. Nothing has run on it yet.
-->
<!-- local -->
If you haven't already, start everything the workshop needs. It keeps running in the background for the whole workshop:

```bash
uv run travel-stack up
```

Open the **Temporal UI** at http://localhost:8233.
<!-- /local -->

Next, give it something to run.

## 1. Run it, and see it stop

<!-- lang python -->
In one terminal, start the worker and leave it running:

```bash
uv run hello-worker
```

In another, start a workflow:

```bash
uv run hello-start SFO JFK
```

It prints a link and then waits. Open the link. The workflow is **Running**, but the worker's terminal shows this error over and over:

```
NotImplementedError: TODO(ch01): call the lookup_airport activity
```
<!-- /lang -->
<!-- lang typescript -->
<!-- local -->
Work in the TypeScript project: `cd langs/typescript/hello`, and run `npm install` there once.
<!-- /local -->
In one terminal, start the worker and leave it running:

```bash
npm run worker
```

In another, start a workflow:

```bash
npm run start -- SFO JFK
```

It prints a link and then waits. Open the link. The workflow is **Running**, but the worker's terminal shows this over and over:

```
WARN Workflow task failed (the workflow waits, and it is retried): TODO(ch01): call the lookup_airport activity (SFO)
```
<!-- /lang -->
<!-- lang dotnet -->
<!-- local -->
Work in the C# project: `cd langs/dotnet/hello`. `./hello` builds the code whenever it has changed, then runs it: the first build takes a minute.
<!-- /local -->
In one terminal, start the worker and leave it running:

```bash
./hello worker
```

In another, start a workflow:

```bash
./hello start SFO JFK
```

It prints a link and then waits. Open the link. The workflow is **Running**, but the worker's terminal shows this over and over:

```
WARN Workflow task failed (the workflow waits, and it is retried): TODO(ch01): call the lookup_airport activity (SFO)
```
<!-- /lang -->
<!-- lang java -->
<!-- local -->
Work in the Java project: `cd langs/java/hello`. `./hello` builds the code whenever it has changed, then runs it: the first build takes a minute or two.
<!-- /local -->
In one terminal, start the worker and leave it running:

```bash
./hello worker
```

In another, start a workflow:

```bash
./hello start SFO JFK
```

It prints a link and then waits. Open the link. The workflow is **Running**, but the worker's terminal shows this over and over:

```
WARN Workflow task failed (the workflow waits, and it is retried): TODO(ch01): call the lookup_airport activity (SFO)
```
<!-- /lang -->

That's your TODO. Notice what Temporal does with a bug in workflow code: it doesn't fail the workflow. It **pauses** it, and retries the step until the code is fixed. Leave the starter waiting: next, you fix the code it's waiting on.
