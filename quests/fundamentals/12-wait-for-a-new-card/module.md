---
id: F14
title: "Expired card: wait for a new one"
teaser: "Book with a card that's expired. Instead of undoing the trip, wait for the traveller's new card, take it from the Temporal UI, and turn the wrong one away."
learn: "Manual retry: a failure a person can fix waits, durably, for the fix, then tries the step again."
concepts: [non-retryable, wait-condition, update, validator]
minutes: 9
xp: 10
tier: 2
requires: [F11]
check:
  kind: code
  tests:
    - tests/test_ch06_building_blocks.py::test_an_expired_card_waits_for_a_new_one
    - tests/test_ch06_building_blocks.py::test_the_expired_card_is_turned_away
  hint: "Two TODO(ch06)s in hello/saga.py: the loop above the except (on a CardExpired error, set self.waiting_for_new_card = True, wait_condition until it's False, charge self.card; re-raise anything else), and the new_card update with its validator, which turns away the card that expired."
files:
  - path: hello/saga.py
    editable: true
  - path: hello/activities.py
  - path: hello/starter.py
questions:
  - When should a workflow wait for a person instead of retrying or undoing?
  - Why not give the retry policy more attempts for an expired card?
  - How would I undo the booking if no new card arrives within three days?
  - Should the new card be a Signal or an Update?
---

## 6. An expired card undoes the trip

Book with card `1111`, which has expired:

```bash
uv run hello-book SFO JFK 1111
```

It fails: `card ending 1111 has expired`. The worker's log shows the saga cancelling the hotel, then the flight.

Like a declined card, an expired one is final: no retry brings it back. Unlike a declined card, a person can fix it, because the traveller has another card. Undoing a whole trip over that is wrong. In the next two steps, the booking waits for the new card, then takes it, and turns away the wrong one.

## 7. Wait instead

In `hello/saga.py`, replace the `TODO(ch06)` above the `except` with:

```python hello/saga.py
# Charge the card. An expired one isn't the end: wait for the traveller's new card,
# for as long as it takes, then charge that. Anything else goes on to the undo below.
while True:
    try:
        await workflow.execute_activity(charge_card, booking, **STEP)
        break
    except ActivityError as err:
        if not (isinstance(err.cause, ApplicationError) and err.cause.type == "CardExpired"):
            raise
        self.waiting_for_new_card = True
        await workflow.wait_condition(lambda: not self.waiting_for_new_card)
        booking = booking.model_copy(update={"card": self.card})
```

On `CardExpired`, it sets a flag and waits until something clears it. Any other error goes on to the saga.

- Restart the worker.
- Book with `1111` again: `uv run hello-book SFO JFK 1111`. Nothing is undone, and the command says the booking is waiting for a new card.
- <!-- browser
[Open its history](#workflow/book-sfo-jfk/history):
--><!-- local -->Open it in the Temporal UI:<!-- /local --> the flight and the hotel are reserved, `charge_card` failed, and then nothing.

There's no timer and no retry. The booking is **Running**, and it would wait the same for a minute or a month. But nothing can clear the flag yet: the booking has no way to receive a card.

## 8. Take the new card, not the wrong one

Replace the `TODO(ch06)` for `new_card` with an Update and its validator, like the hold's `pay`:

```python hello/saga.py
# An update: the traveller's new card. It clears the flag the charge loop waits on.
@workflow.update
def new_card(self, payment: Payment) -> str:
    self.card = payment.card
    self.waiting_for_new_card = False
    return f"Charging the card ending {payment.card}."

# Its validator runs first, and a card it turns away is never written to the history.
@new_card.validator
def check_new_card(self, payment: Payment) -> None:
    if not self.waiting_for_new_card:
        raise ValueError("this booking isn't waiting for a new card")
    if not (payment.card.isdigit() and len(payment.card) == 4):
        raise ValueError(f"give the card's last four digits, not {payment.card!r}")
    if payment.card == self.card:
        raise ValueError(f"the card ending {payment.card} is the one that expired")
```

Without the validator, the same expired card would be taken, charged, and fail again.

- Restart the worker. The booking from step 7 is still waiting: the new worker replays its history, and carries on waiting, now with a way in.
- <!-- browser
[Send it the same card](#workflow/book-sfo-jfk/update/new_card?card=1111): **Send an Update** opens, filled in. Click **Submit**.
--><!-- local -->In the Temporal UI, open the booking, and choose **More Actions**, then **Send an Update**. Pick `new_card`, put `{"card": "1111"}` in **Data**, and click **Submit**.<!-- /local --> The dialog shows `the card ending 1111 is the one that expired`, and the history has nothing new.
- <!-- browser
[Send `4242`](#workflow/book-sfo-jfk/update/new_card?card=4242), and click **Submit**.
--><!-- local -->Change **Data** to `{"card": "4242"}`, and click **Submit**.<!-- /local --> The UI says **Update successful**, and the booking is **Completed**.

## 9. Read what the Update did

<!-- browser
[Open the booking's Event History](#workflow/book-sfo-jfk/history),
--><!-- local -->Open the booking's **Event History** in the Temporal UI,<!-- /local --> and click each of these events to see its details. The newest is at the top, so read up from the bottom:

- **Activity Task Failed**, `charge_card`: `card ending 1111 has expired`. The first charge.
- **Workflow Execution Update Accepted**: `new_card`. Its **Accepted Request** carries `{"card": "4242"}`. The new card is in the history, so a replay gets the same card.
- **Workflow Execution Update Completed**: the Update's answer, `Charging the card ending 4242.`
- **Activity Task Scheduled**, `charge_card` again. Its input now has `"card": "4242"`: your loop took the card from the Update and ran the step that failed again. Then **Activity Task Completed**.

There's no event for `1111`: the validator turned it away before anything was written.

## Three answers to a failure

| The failure | Will trying again work? | What the workflow does |
|---|---|---|
| The airport database is busy | Yes, given time | A retry policy tries again, waiting longer each time |
| The card is declined | No | A saga undoes what's done |
| The card has expired, an account number has a typo | Yes, once a person fixes it | It waits for the fix, then tries again |

In production you'd bound the wait: `wait_condition(..., timeout=timedelta(days=3))` is a durable timer, like the fare hold's, and when it runs out, raising the original error hands the trip to the saga.
