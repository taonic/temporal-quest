---
id: FC1
title: Get the trip through a bad minute
teaser: The airport database fails SFO three times. Pick the activity call that gets the trip through, and watch each one run.
learn: "How to pick a retry policy that rides out a flaky dependency."
after: F5
file: hello/workflow.py
# The block each choice replaces: the activity call, as F2 left it.
replace: |
  return await workflow.execute_activity(
      lookup_airport,
      code,
      # How long one attempt may take before Temporal gives up on it and tries again.
      start_to_close_timeout=timedelta(seconds=10),
      # Retry failures, waiting 2s, then twice as long each time, up to 6s between attempts.
      retry_policy=RetryPolicy(
          initial_interval=timedelta(seconds=2), backoff_coefficient=2, maximum_interval=timedelta(seconds=6)
      ),
  )
hint: Which of these still has the right airport when it's done, however many attempts it took?
choices:
  - label: Give up after three attempts
    code: |
      # Three tries is plenty: if the database is still down, fail fast.
      return await workflow.execute_activity(
          lookup_airport,
          code,
          start_to_close_timeout=timedelta(seconds=10),
          retry_policy=RetryPolicy(initial_interval=timedelta(seconds=2), backoff_coefficient=2, maximum_attempts=3),
      )
    explanation: "SFO's lookup needed a fourth attempt, and the policy stopped at three: the activity failed, and with it the trip. A cap on attempts is for errors that won't go away; for a database that's just overloaded, let it keep retrying (a timeout bounds the wait, if you need one)."
    langs:
      typescript:
        code: |
          // Three tries is plenty: if the database is still down, fail fast.
          const { lookup_airport } = proxyActivities<typeof activities>({
            startToCloseTimeout: '10 seconds',
            retry: { initialInterval: '2 seconds', backoffCoefficient: 2, maximumAttempts: 3 },
          });
          return await lookup_airport(code);
  - label: Try once, and fall back if it fails
    code: |
      # One try, and never fail the trip: if the lookup fails, carry on with what we know.
      try:
          return await workflow.execute_activity(
              lookup_airport,
              code,
              start_to_close_timeout=timedelta(seconds=10),
              retry_policy=RetryPolicy(maximum_attempts=1),
          )
      except Exception:
          return Airport(code=code, name="Unknown airport", city="somewhere")
    explanation: "It finished, but wrong: the trip says it starts somewhere. Catching the failure hid it, and the retries that would have got the real answer never happened. Let the retry policy deal with failures that pass; catch only what you can really handle."
    langs:
      typescript:
        code: |
          // One try, and never fail the trip: if the lookup fails, carry on with what we know.
          const { lookup_airport } = proxyActivities<typeof activities>({
            startToCloseTimeout: '10 seconds',
            retry: { maximumAttempts: 1 },
          });
          try {
            return await lookup_airport(code);
          } catch {
            return { code, name: 'Unknown airport', city: 'somewhere' };
          }
  - label: Retry with a backoff, and no limit
    right: true
    code: |
      # Retry failures, waiting 2s, then twice as long each time, up to 6s between attempts.
      return await workflow.execute_activity(
          lookup_airport,
          code,
          start_to_close_timeout=timedelta(seconds=10),
          retry_policy=RetryPolicy(
              initial_interval=timedelta(seconds=2), backoff_coefficient=2, maximum_interval=timedelta(seconds=6)
          ),
      )
    explanation: "Attempt 4 got through, after waits of 2, 4 and 6 seconds, and the trip has the real airport. Temporal retried the activity for you, and the workflow never saw the failures: it just waited for the answer."
    langs:
      typescript:
        code: |
          // Retry failures, waiting 2s, then twice as long each time, up to 6s between attempts.
          const { lookup_airport } = proxyActivities<typeof activities>({
            startToCloseTimeout: '10 seconds',
            retry: { initialInterval: '2 seconds', backoffCoefficient: 2, maximumInterval: '6 seconds' },
          });
          return await lookup_airport(code);
langs:
  typescript:
    file: langs/typescript/hello/src/workflows.ts
    replace: |
      // Ask Temporal to run the activity. Its result is recorded in the workflow's history,
      // so a replay reuses the result instead of running the activity again.
      const { lookup_airport } = proxyActivities<typeof activities>({
        // How long one attempt may take before Temporal times it out and tries again.
        startToCloseTimeout: '10 seconds',
        // Failed attempts are retried for you: wait 2s, then twice as long each time, up to 6s.
        retry: { initialInterval: '2 seconds', backoffCoefficient: 2, maximumInterval: '6 seconds' },
      });
      return await lookup_airport(code);
---

The airport database is having a bad minute: SFO's lookup fails three times before it gets through. Which version of `airport()` in <!-- lang python -->`hello/workflow.py`<!-- /lang --><!-- lang typescript -->`src/workflows.ts`<!-- /lang --> gets the SFO → JFK trip through, with the right airports?
