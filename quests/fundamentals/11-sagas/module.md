---
id: F11
title: Undo a booking with a saga
teaser: "Book a flight and a hotel, have the card declined, and undo what already happened, newest first."
learn: "Sagas: undoing the steps that already happened, newest first, when a later one fails."
concepts: [saga, non-retryable]
minutes: 6
xp: 10
tier: 2
requires: [F10]
check:
  kind: code
  tests:
    - tests/test_ch06_building_blocks.py::test_a_declined_card_undoes_the_booking
    - tests/test_ch06_building_blocks.py::test_a_good_card_books_the_trip
  hint: "A declined card doesn't undo the booking yet. Look for the TODO(ch06) in hello/saga.py: for each (activity, reservation) in undo, run the activity with the reservation, then re-raise the error."
files:
  - path: hello/saga.py
    editable: true
  - path: hello/activities.py
  - path: hello/starter.py
questions:
  - What is the saga pattern, and why does Temporal make it easier?
  - What happens if a compensation itself fails?
  - Why is the declined card a non-retryable error?
  - Should compensations run in reverse order?
langs:
  typescript:
    files:
    - path: langs/typescript/hello/src/saga.ts
      editable: true
    - path: langs/typescript/hello/src/activities.ts
    - path: langs/typescript/hello/src/starter.ts
    hint: "A declined card doesn't undo the booking yet. Look for the TODO(ch06) in the catch in src/saga.ts: call each function in undo, in order, then throw the error again."
  java:
    files:
      - path: langs/java/hello/src/main/java/hello/BookTripWorkflowImpl.java
        editable: true
      - path: langs/java/hello/src/main/java/hello/BookTripWorkflow.java
      - path: langs/java/hello/src/main/java/hello/ActivitiesImpl.java
      - path: langs/java/hello/src/main/java/hello/Starter.java
    hint: "A declined card doesn't undo the booking yet. Look for the TODO(ch06) in the catch in BookTripWorkflowImpl.java: run each Runnable in undo, in order, then throw the failure again."
  dotnet:
    files:
      - path: langs/dotnet/hello/BookTripWorkflow.cs
        editable: true
      - path: langs/dotnet/hello/Activities.cs
      - path: langs/dotnet/hello/Starter.cs
    hint: "A declined card doesn't undo the booking yet. Look for the TODO(ch06) in the catch in BookTripWorkflow.cs: await each function in undo, in order, then throw; again."
---

## 5. Undo a booking

Booking a trip is three calls: reserve a flight, reserve a hotel, charge the card. No transaction spans three companies, so if the card is declined, the flight and hotel stay reserved. A **saga** undoes them, newest first.

In <!-- lang python -->`hello/saga.py`<!-- /lang --><!-- lang typescript -->`src/saga.ts`<!-- /lang --><!-- lang dotnet -->`BookTripWorkflow.cs`<!-- /lang --><!-- lang java -->`BookTripWorkflowImpl.java`<!-- /lang -->, the steps and their undos are written. Book with `0000`, a declined card:

<!-- lang python -->
```bash
uv run hello-book SFO JFK 0000
```
<!-- /lang -->
<!-- lang typescript -->
```bash
npm run book -- SFO JFK 0000
```
<!-- /lang -->
<!-- lang dotnet -->
```bash
./hello book SFO JFK 0000
```
<!-- /lang -->
<!-- lang java -->
```bash
./hello book SFO JFK 0000
```
<!-- /lang -->

It fails, and the worker's log shows the flight and hotel reserved, and nothing undone. `charge_card` <!-- lang python -->raised<!-- /lang --><!-- lang typescript -->threw<!-- /lang --><!-- lang dotnet -->threw<!-- /lang --><!-- lang java -->threw<!-- /lang --> a **non-retryable** error: a retry won't change the bank's mind.

<!-- lang python -->
Replace the `TODO(ch06)` in `hello/saga.py` with:
<!-- /lang -->
<!-- lang typescript -->
Replace the `TODO(ch06)` in `src/saga.ts` with:
<!-- /lang -->
<!-- lang dotnet -->
Replace the `TODO(ch06)` in `BookTripWorkflow.cs` with:
<!-- /lang -->
<!-- lang java -->
Replace the `TODO(ch06)` in `BookTripWorkflowImpl.java` with:
<!-- /lang -->

```python hello/saga.py
# A step failed: undo the ones that succeeded, newest first, then fail the booking.
# The undo steps are activities too, so they're retried, and survive a crash.
for compensate, reservation in undo:
    await workflow.execute_activity(compensate, reservation, **STEP)
raise
```

```typescript langs/typescript/hello/src/saga.ts
// A step failed: undo the ones that succeeded, newest first, then fail the booking.
// The undo steps are activities too, so they're retried, and survive a crash.
for (const compensate of undo) await compensate();
throw err;
```

```java langs/java/hello/src/main/java/hello/BookTripWorkflowImpl.java
// A step failed: undo the ones that succeeded, newest first, then fail the booking.
// The undo steps are activities too, so they're retried, and survive a crash.
for (Runnable compensate : undo) {
    compensate.run();
}
throw err;
```

```csharp langs/dotnet/hello/BookTripWorkflow.cs
// A step failed: undo the ones that succeeded, newest first, then fail the booking.
// The undo steps are activities too, so they're retried, and survive a crash.
foreach (var compensate in undo)
{
    await compensate();
}
throw;
```

- Restart the worker, and book with `0000` again: <!-- lang python -->`uv run hello-book SFO JFK 0000`<!-- /lang --><!-- lang typescript -->`npm run book -- SFO JFK 0000`<!-- /lang --><!-- lang dotnet -->`./hello book SFO JFK 0000`<!-- /lang --><!-- lang java -->`./hello book SFO JFK 0000`<!-- /lang -->. It still fails, but the log shows `Cancelled hotel HT-JFK`, then `Cancelled flight FL-SFOJFK`.
- Book with a good card, <!-- lang python -->`uv run hello-book SFO JFK 4242`<!-- /lang --><!-- lang typescript -->`npm run book -- SFO JFK 4242`<!-- /lang --><!-- lang dotnet -->`./hello book SFO JFK 4242`<!-- /lang --><!-- lang java -->`./hello book SFO JFK 4242`<!-- /lang -->: nothing to undo.

The undos are activities too, so they're retried and recorded: a worker that dies mid-undo resumes.
