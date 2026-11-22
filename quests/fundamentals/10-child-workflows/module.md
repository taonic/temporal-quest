---
id: F10
title: One trip, several legs
teaser: "Split an itinerary into child workflows, one a leg, run at once, each with a history of its own."
learn: "Child workflows: work split into parts that run at once, each with its own history."
concepts: [child-workflow]
minutes: 5
xp: 10
tier: 2
requires: [F9]
check:
  kind: code
  tests: [tests/test_ch06_building_blocks.py::test_each_leg_is_a_child_workflow]
  hint: "The itinerary isn't working yet. Look for the TODO(ch06) in leg() in hello/itinerary.py: return await workflow.execute_child_workflow(HelloTripWorkflow.run, TripRequest(origin=origin, destination=destination), id=...)."
files:
  - path: hello/itinerary.py
    editable: true
  - path: hello/workflow.py
  - path: hello/starter.py
questions:
  - When should I use a child workflow instead of an activity?
  - What happens to a child workflow when its parent is cancelled?
  - Can a child workflow run on a different task queue or worker?
  - Why does a long-running job split its work into child workflows?
langs:
  typescript:
    files:
    - path: langs/typescript/hello/src/itinerary.ts
      editable: true
    - path: langs/typescript/hello/src/workflows.ts
    - path: langs/typescript/hello/src/starter.ts
    hint: "The itinerary isn't working yet. Look for the TODO(ch06) in leg() in src/itinerary.ts: return await executeChild<typeof HelloTripWorkflow>('HelloTripWorkflow', { args: [{ origin, destination }], workflowId: ... })."
  java:
    files:
      - path: langs/java/hello/src/main/java/hello/ItineraryWorkflowImpl.java
        editable: true
      - path: langs/java/hello/src/main/java/hello/ItineraryWorkflow.java
      - path: langs/java/hello/src/main/java/hello/HelloTripWorkflowImpl.java
      - path: langs/java/hello/src/main/java/hello/HelloTripWorkflow.java
      - path: langs/java/hello/src/main/java/hello/Starter.java
    hint: "The itinerary isn't working yet. Look for the TODO(ch06) in leg() in ItineraryWorkflowImpl.java: make a child stub with Workflow.newChildWorkflowStub(HelloTripWorkflow.class, ...) and the leg's workflow id, and return Async.function(child::run, new TripRequest(origin, destination))."
  dotnet:
    files:
      - path: langs/dotnet/hello/ItineraryWorkflow.cs
        editable: true
      - path: langs/dotnet/hello/HelloTripWorkflow.cs
      - path: langs/dotnet/hello/Starter.cs
    hint: "The itinerary isn't working yet. Look for the TODO(ch06) in LegAsync in ItineraryWorkflow.cs: return await Workflow.ExecuteChildWorkflowAsync((HelloTripWorkflow wf) => wf.RunAsync(new TripRequest(origin, destination)), new() { Id = ... })."
---

## 4. One trip, several legs

An itinerary like SFO → JFK → LHR is two trips, and you already have a workflow for a trip: `HelloTripWorkflow`. So the itinerary starts a **child workflow** for each leg, all at once, and joins their answers. <!-- lang python -->In `hello/itinerary.py`, `run()` splits the stops into legs and runs `leg()` for each. Replace the `TODO(ch06)` in `leg()` with:<!-- /lang --><!-- lang typescript -->In `src/itinerary.ts`, `ItineraryWorkflow` splits the stops into legs and runs `leg()` for each. Replace the `TODO(ch06)` in `leg()` with:<!-- /lang -->
<!-- lang dotnet -->In `ItineraryWorkflow.cs`, `RunAsync` splits the stops into legs and runs `LegAsync` for each. Replace the `TODO(ch06)` in `LegAsync` with:<!-- /lang -->
<!-- lang java -->In `ItineraryWorkflowImpl.java`, `run()` splits the stops into legs and starts `leg()` for each. Replace the `TODO(ch06)` in `leg()` with:<!-- /lang -->

```python hello/itinerary.py
# A child workflow: started, and waited for, by this one. Its id is this workflow's, plus
# the leg, so each leg is easy to find, and starting the same leg twice is refused.
return await workflow.execute_child_workflow(
    HelloTripWorkflow.run,
    TripRequest(origin=origin, destination=destination),
    id=f"{workflow.info().workflow_id}-leg-{n}",
)
```

```typescript langs/typescript/hello/src/itinerary.ts
// A child workflow: started, and waited for, by this one. Its id is this workflow's, plus
// the leg, so each leg is easy to find, and starting the same leg twice is refused.
return await executeChild<typeof HelloTripWorkflow>('HelloTripWorkflow', {
  args: [{ origin, destination }],
  workflowId: `${workflowInfo().workflowId}-leg-${n}`,
});
```

```java langs/java/hello/src/main/java/hello/ItineraryWorkflowImpl.java
// A child workflow: started, and waited for, by this one. Its id is this workflow's, plus
// the leg, so each leg is easy to find, and starting the same leg twice is refused.
HelloTripWorkflow child = Workflow.newChildWorkflowStub(HelloTripWorkflow.class,
        ChildWorkflowOptions.newBuilder()
                .setWorkflowId(Workflow.getInfo().getWorkflowId() + "-leg-" + n)
                .build());
return Async.function(child::run, new TripRequest(origin, destination));
```

```csharp langs/dotnet/hello/ItineraryWorkflow.cs
// A child workflow: started, and waited for, by this one. Its id is this workflow's, plus
// the leg, so each leg is easy to find, and starting the same leg twice is refused.
return await Workflow.ExecuteChildWorkflowAsync(
    (HelloTripWorkflow wf) => wf.RunAsync(new TripRequest(origin, destination)),
    new() { Id = $"{Workflow.Info.WorkflowId}-leg-{n}" });
```

- Restart the worker, and plan the trip: <!-- lang python -->`uv run hello-itinerary SFO JFK LHR`<!-- /lang --><!-- lang typescript -->`npm run itinerary -- SFO JFK LHR`<!-- /lang --><!-- lang dotnet -->`./hello itinerary SFO JFK LHR`<!-- /lang --><!-- lang java -->`./hello itinerary SFO JFK LHR`<!-- /lang -->. It prints both legs.
- <!-- browser
[Open the itinerary's Event History](#workflow/itinerary-sfo-jfk-lhr/history):
--><!-- local -->Open the itinerary's **Event History**:<!-- /local --> two **Start Child Workflow Execution Initiated**, then two **Child Workflow Execution Completed**, and no lookups. Click a child: it's a workflow of its own, with its own history and lookups.

Why a child? Each keeps its own history, so thousands of steps don't make one huge one, and it can run on another team's worker. The trip didn't change at all to become a leg.
