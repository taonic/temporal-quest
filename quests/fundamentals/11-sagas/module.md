---
id: F11
title: Undo a booking with a saga
teaser: "Book a flight and a hotel, have the card declined, and undo what already happened, newest first."
learn: "Sagas: undoing the steps that already happened, newest first, when a later one fails."
concepts: [saga, non-retryable]
# Not in TypeScript yet (.scratch/multi-language ticket 10).
languages: [python]
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
---

## 5. Undo a booking

Booking a trip is three calls: reserve a flight, reserve a hotel, charge the card. No transaction spans three companies, so if the card is declined, the flight and hotel stay reserved. A **saga** undoes them, newest first.

In `hello/saga.py`, the steps and their undos are written. Book with `0000`, a declined card:

```bash
uv run hello-book SFO JFK 0000
```

It fails, and the worker's log shows the flight and hotel reserved, and nothing undone. `charge_card` raised a **non-retryable** error: a retry won't change the bank's mind.

Replace the `TODO(ch06)` in `hello/saga.py` with:

```python hello/saga.py
# A step failed: undo the ones that succeeded, newest first, then fail the booking.
# The undo steps are activities too, so they're retried, and survive a crash.
for compensate, reservation in undo:
    await workflow.execute_activity(compensate, reservation, **STEP)
raise
```

- Restart the worker, and book with `0000` again: `uv run hello-book SFO JFK 0000`. It still fails, but the log shows `Cancelled hotel HT-JFK`, then `Cancelled flight FL-SFOJFK`.
- Book with a good card, `uv run hello-book SFO JFK 4242`: nothing to undo.

The undos are activities too, so they're retried and recorded: a worker that dies mid-undo resumes.
