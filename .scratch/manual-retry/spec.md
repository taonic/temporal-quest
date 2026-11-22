# Manual retry: wait for a person to fix it, then try again

Source: `temporal-training-exercise-python/exercise7` (Manual Activity Retry), adapted to the course's world.

## Why

Fundamentals Tier II teaches two answers to a failing step: a retry policy, when time will fix it (F5), and a saga, when nothing will (F11). Exercise 7 adds the third: some failures are final for the code but fixable by a person. Retrying won't help and undoing is wrong, so the workflow waits, durably, for someone to supply the fix, then tries again.

## The module

**F14 · Expired card: wait for a new one**, in Fundamentals Tier II, right after F11. It reuses F11's booking saga, `hello/saga.py`. `charge_card` raises a non-retryable `CardExpired` for card `1111`, next to `0000`'s `CardDeclined`.

The learner builds it a piece at a time, and each piece shows something:

1. See the problem: an expired card falls through to F11's undo.
2. Wait instead: the loop. The booking now waits, but nothing can answer it.
3. Take the new card, not the wrong one: the Update and its validator, written together as F9 writes `pay`. The learner sends the expired card (refused) and then `4242` (booked) from the Temporal UI.

There are two `@@solution F14` blocks in `authoring/hello/saga.py`: the loop, then the `new_card` Update with its validator. The `status` Query, `self.card` and `self.waiting_for_new_card` stay given. It's about 8 minutes, up from 6.

The validator was going to be its own step, showing first what happens without it: the same card is taken, charged, and fails again. It isn't, because F9 already teaches an Update and its validator as one, and that step cost another booking and another restart. A sentence in step 8 says what happens without it.

## The steps

Each step's text is at most 150 words, not counting code blocks. Below are drafts of the guide's text; the module has the final wording. F12's steps become 9 and 10, and F13's becomes 11.

### 6. An expired card undoes the trip

Book with card `1111`, which has expired:

```bash
uv run hello-book SFO JFK 1111
```

It fails: `card ending 1111 has expired`. The worker's log shows the saga cancelling the hotel, then the flight.

Like a declined card, an expired one is final: no retry brings it back. Unlike a declined card, a person can fix it, because the traveller has another card. Undoing a whole trip over that is wrong. In the next two steps, the booking waits for the new card, then takes it, and turns away the wrong one.

### 7. Wait instead

In `hello/saga.py`, replace the `TODO(ch06)` above the `except` with:

```python hello/saga.py
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

Restart the worker and book with `1111` again. Nothing is undone. [Open its history](#workflow/book-sfo-jfk/history): the flight and hotel are reserved, `charge_card` failed, and then nothing. There's no timer and no retry. The booking is **Running**, and it would wait the same for a minute or a month. But nothing can clear the flag yet, because the booking has no way to receive a card.

### 8. Take the new card, not the wrong one

Replace the `TODO(ch06)` for `new_card` with an Update and its validator, like the hold's `pay` (the code is in the module). Without the validator, the same expired card would be taken, charged, and fail again. Restart the worker. The booking from step 7 is still waiting: the new worker replays its history, and carries on waiting, now with a way in.

[Send it the same card](#workflow/book-sfo-jfk/update/new_card?card=1111): the Temporal UI opens **Send an Update**, filled in. Click **Submit**. The dialog shows `the card ending 1111 is the one that expired`, and the history has nothing new. [Send `4242`](#workflow/book-sfo-jfk/update/new_card?card=4242), and **Submit**. **Update successful**: the booking is **Completed**, and its history shows the Update, then a second `charge_card`.

### Three answers to a failure

The closing table stays as it is: a retry policy, a saga, or waiting for the fix.

## Sending an Update from the course

- **The link.** `#workflow/<id prefix>/update/<name>?<field>=<value>&…` is a button in the browser course. Locally, it's just its words.
- **What the button does.** `content/build.mjs` turns the link into a `nav` message carrying `{workflow, update: {name, input}}`. The proxy's bridge (`runner/proxy.mjs`) opens the latest run, then clicks **More Actions** and **Send an Update**. It picks the name: the `[role=option]` in `#update-select` if listed, else `input#update-name`. It fills the data with the input as JSON. It doesn't submit: the learner clicks **Submit**.
- **Local copy.** A `<!-- local -->` block names the menu path, the name and the JSON, plus `temporal workflow update execute --name new_card --input '{"card":"4242"}' -w <id>`.
- **`hello-new-card` goes away.** When the booking is waiting, `hello-book` points at the Temporal UI instead.

## Prototype (2026-11-22, UI 2.50.1): all three risks settled

Driven with Playwright against a dev server, but only through in-page DOM calls, which is all the bridge can do.

1. **The data box** is a CodeMirror editor (`.cm-content`). Focus it, then `execCommand("selectAll")` and `execCommand("insertText", false, json)`. CodeMirror takes that as typing, pretty-prints the JSON, and enables **Submit**.
2. **The name.** With a worker running, `#update-select` lists `new_card` (plus **Custom**) as `[role=option]`, and clicking it selects it. With no worker, there's no picker, only `input#update-name`, and the same `execCommand` fills it.
3. **The labels** are **More Actions**, **Send an Update**, **Cancel** and **Submit**. A rejected Update shows the validator's message in the dialog, with a stack trace, and the dialog stays open. A successful one closes the dialog and shows an **Update successful** toast. The Update's return value isn't shown in the UI, only in the history.

## Checks

- **Tests.** The two existing tests stay: a new card completes the booking, and the expired card is refused. With any of the three blocks open, they fail.
- **e2e walkthrough.** It clicks each button and **Submit** in the Temporal UI frame.
- **Before shipping.** Run `verify_modules.py`, `npm test` and `npm run content`. Rebuild the snapshot only if `pyproject.toml` changes; removing `hello-new-card` changes it.

## What it drops from exercise 7

The `approve` signal (F9 and E7 teach it), the stringly-typed `RetryUpdate` signal (an Update with a validator instead), and the transfer/refund flow (F11 is the saga).
