---
id: F2
title: Call the activity
teaser: "Your first TODO: ask Temporal to run an activity, with a timeout and a retry policy."
learn: "How a workflow calls an activity, and what its timeout and retry policy are for."
concepts: [activity, timeout, retry-policy]
minutes: 5
xp: 10
tier: 1
requires:
  - F1
check:
  kind: code
  tests:
    - tests/test_ch01_hello.py::test_describes_the_trip
    - tests/test_ch01_hello.py::test_retries_a_failed_activity
    - tests/test_ch01_hello.py::test_uses_a_retry_policy_with_a_gentle_backoff
  hint: "The trip workflow isn't working yet. Look for TODO(ch01) in hello/workflow.py: call the lookup_airport activity with a 10-second start_to_close_timeout and a RetryPolicy with a 2-second initial_interval, a backoff_coefficient of 2 and a 6-second maximum_interval."
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
    hint: "The trip workflow isn't working yet. Look for TODO(ch01) in src/workflows.ts: in airport(), get lookup_airport from proxyActivities with a 10-second startToCloseTimeout and a retry with a 2-second initialInterval, a backoffCoefficient of 2 and a 6-second maximumInterval, and await it."
  java:
    files:
      - path: langs/java/hello/src/main/java/hello/HelloTripWorkflowImpl.java
        editable: true
      - path: langs/java/hello/src/main/java/hello/HelloTripWorkflow.java
      - path: langs/java/hello/src/main/java/hello/ActivitiesImpl.java
      - path: langs/java/hello/src/main/java/hello/Starter.java
      - path: langs/java/hello/src/main/java/hello/BoardingWorkflowImpl.java
    hint: "The trip workflow isn't working yet. Look for TODO(ch01) in HelloTripWorkflowImpl.java: in airport(), make a stub with Workflow.newActivityStub(Activities.class, ...), with a 10-second start-to-close timeout and RetryOptions with a 2-second initial interval, a backoff coefficient of 2 and a 6-second maximum interval, and return its lookupAirport(code)."
  dotnet:
    files:
      - path: langs/dotnet/hello/HelloTripWorkflow.cs
        editable: true
      - path: langs/dotnet/hello/Activities.cs
      - path: langs/dotnet/hello/Starter.cs
      - path: langs/dotnet/hello/BoardingWorkflow.cs
    hint: "The trip workflow isn't working yet. Look for TODO(ch01) in HelloTripWorkflow.cs: in AirportAsync, return await Workflow.ExecuteActivityAsync((Activities act) => act.LookupAirportAsync(code), new() { ... }), with a 10-second StartToCloseTimeout and a RetryPolicy with a 2-second InitialInterval, a BackoffCoefficient of 2 and a 6-second MaximumInterval."
---

## 2. Call the activity

<!-- lang python -->
Open `hello/workflow.py` and find `TODO(ch01)` in `airport()`. Replace the `raise` with a call to the activity:
<!-- /lang -->
<!-- lang typescript -->
Open `src/workflows.ts` and find `TODO(ch01)` in `airport()`. Replace the `throw` with a call to the activity:
<!-- /lang -->
<!-- lang dotnet -->
Open `HelloTripWorkflow.cs` and find `TODO(ch01)` in `airport()`. Replace the `throw` with a call to the activity:
<!-- /lang -->
<!-- lang java -->
Open `HelloTripWorkflowImpl.java` and find `TODO(ch01)` in `airport()`. Replace the `throw` with a call to the activity:
<!-- /lang -->

```python
# Ask Temporal to run the activity. Its result is recorded in the workflow's history,
# so a replay reuses the result instead of running the activity again.
return await workflow.execute_activity(
    lookup_airport,
    code,
    # How long one attempt may take before Temporal times it out and tries again.
    start_to_close_timeout=timedelta(seconds=10),
    # Failed attempts are retried for you: wait 2s, then twice as long each time, up to 6s.
    retry_policy=RetryPolicy(
        initial_interval=timedelta(seconds=2), backoff_coefficient=2, maximum_interval=timedelta(seconds=6)
    ),
)
```

```typescript
// Ask Temporal to run the activity. Its result is recorded in the workflow's history,
// so a replay reuses the result instead of running the activity again.
const { lookup_airport } = proxyActivities<typeof activities>({
  // How long one attempt may take before Temporal times it out and tries again.
  startToCloseTimeout: '10 seconds',
  // Failed attempts are retried for you: wait 2s, then twice as long each time, up to 6s.
  retry: { initialInterval: '2 seconds', backoffCoefficient: 2, maximumInterval: '6 seconds' },
});
return await lookup_airport(code);
```

```java
// Ask Temporal to run the activity. Its result is recorded in the workflow's history,
// so a replay reuses the result instead of running the activity again.
Activities activities = Workflow.newActivityStub(Activities.class, ActivityOptions.newBuilder()
        // How long one attempt may take before Temporal times it out and tries again.
        .setStartToCloseTimeout(Duration.ofSeconds(10))
        // Failed attempts are retried for you: wait 2s, then twice as long each time, up to 6s.
        .setRetryOptions(RetryOptions.newBuilder()
                .setInitialInterval(Duration.ofSeconds(2))
                .setBackoffCoefficient(2)
                .setMaximumInterval(Duration.ofSeconds(6))
                .build())
        .build());
return activities.lookupAirport(code);
```

```csharp
// Ask Temporal to run the activity. Its result is recorded in the workflow's history,
// so a replay reuses the result instead of running the activity again.
return await Workflow.ExecuteActivityAsync(
    (Activities act) => act.LookupAirportAsync(code),
    new()
    {
        // How long one attempt may take before Temporal times it out and tries again.
        StartToCloseTimeout = TimeSpan.FromSeconds(10),
        // Failed attempts are retried for you: wait 2s, then twice as long each time, up to 6s.
        RetryPolicy = new()
        {
            InitialInterval = TimeSpan.FromSeconds(2),
            BackoffCoefficient = 2,
            MaximumInterval = TimeSpan.FromSeconds(6),
        },
    });
```

<!-- lang python -->
- `start_to_close_timeout`: how long one attempt may take before Temporal gives up on it and tries again.
- `retry_policy`: how to retry. By default Temporal retries forever, backing off between attempts. Here it waits 2 seconds, then twice as long each time (4s, then 6s), and never more than 6 seconds.

Workflow code never calls `lookup_airport()` directly. It asks Temporal to run it, and Temporal records the result in the history.
<!-- /lang -->
<!-- lang typescript -->
- `startToCloseTimeout`: how long one attempt may take before Temporal gives up on it and tries again.
- `retry`: how to retry. By default Temporal retries forever, backing off between attempts. Here it waits 2 seconds, then twice as long each time (4s, then 6s), and never more than 6 seconds.

Workflow code never runs `lookup_airport` itself: `proxyActivities` gives it a stand-in that asks Temporal to run it, and Temporal records the result in the history.
<!-- /lang -->
<!-- lang dotnet -->
- `StartToCloseTimeout`: how long one attempt may take before Temporal gives up on it and tries again.
- `RetryPolicy`: how to retry. By default Temporal retries forever, backing off between attempts. Here it waits 2 seconds, then twice as long each time (4s, then 6s), and never more than 6 seconds.

Workflow code never runs the activity itself: `Workflow.ExecuteActivityAsync` asks Temporal to run `lookup_airport` (the lambda only names it and its argument), and Temporal records the result in the history.
<!-- /lang -->
<!-- lang java -->
- `setStartToCloseTimeout`: how long one attempt may take before Temporal gives up on it and tries again.
- `setRetryOptions`: how to retry. By default Temporal retries forever, backing off between attempts. Here it waits 2 seconds, then twice as long each time (4s, then 6s), and never more than 6 seconds.

Workflow code never runs the activity itself: `Workflow.newActivityStub` gives it a stub whose `lookupAirport` asks Temporal to run `lookup_airport`, and Temporal records the result in the history.
<!-- /lang -->

Your fix is saved, but the running worker still has the old code.
