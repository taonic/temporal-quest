---
id: F10
title: One trip, several legs
teaser: "Split an itinerary into child workflows, one a leg, run at once, each with a history of its own."
learn: "Child workflows: work split into parts that run at once, each with its own history."
concepts: [child-workflow]
# Not in TypeScript yet (.scratch/multi-language ticket 10).
languages: [python]
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
---

## 4. One trip, several legs

An itinerary like SFO → JFK → LHR is two trips, and you already have a workflow for a trip: `HelloTripWorkflow`. So the itinerary starts a **child workflow** for each leg, all at once, and joins their answers. In `hello/itinerary.py`, `run()` splits the stops into legs and runs `leg()` for each. Replace the `TODO(ch06)` in `leg()` with:

```python hello/itinerary.py
# A child workflow: started, and waited for, by this one. Its id is this workflow's, plus
# the leg, so each leg is easy to find, and starting the same leg twice is refused.
return await workflow.execute_child_workflow(
    HelloTripWorkflow.run,
    TripRequest(origin=origin, destination=destination),
    id=f"{workflow.info().workflow_id}-leg-{n}",
)
```

- Restart the worker, and plan the trip: `uv run hello-itinerary SFO JFK LHR`. It prints both legs.
- <!-- browser
[Open the itinerary's Event History](#workflow/itinerary-sfo-jfk-lhr/history):
--><!-- local -->Open the itinerary's **Event History**:<!-- /local --> two **Start Child Workflow Execution Initiated**, then two **Child Workflow Execution Completed**, and no lookups. Click a child: it's a workflow of its own, with its own history and lookups.

Why a child? Each keeps its own history, so thousands of steps don't make one huge one, and it can run on another team's worker. The trip didn't change at all to become a leg.
