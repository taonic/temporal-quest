---
id: F9
title: Pay for it with an Update
teaser: "Send a running workflow a message: an Update that pays for the seat, and a validator that turns a bad card away."
learn: "Updates: a message to a running workflow, and a validator that can turn it away."
concepts: [update, validator]
# Not in TypeScript yet (.scratch/multi-language ticket 10).
languages: [python]
minutes: 6
xp: 10
tier: 2
requires: [F8]
check:
  kind: code
  tests: [tests/test_ch06_building_blocks.py::test_paying_ends_the_hold_and_a_bad_card_is_refused]
  hint: "Paying for a hold isn't working yet. Look for the TODO(ch06) for the pay update in hello/hold.py: a @workflow.update method, pay, that sets self.paid_with to the payment's card, and a @pay.validator that rejects a card that isn't four digits."
files:
  - path: hello/hold.py
    editable: true
  - path: hello/starter.py
questions:
  - What's the difference between a Signal, a Query and an Update?
  - When should I use an Update instead of a Signal?
  - What happens to an Update its validator rejects?
  - Can a workflow handle an Update while it's waiting on a timer?
---

## 3. Pay for it

Three ways to talk to a running workflow:

| Message | What it does | In the hold |
|---|---|---|
| **Query** | Reads its state; never in the history. | `status`, already written |
| **Signal** | Changes it, fire and forget: no answer. | |
| **Update** | Changes it, and answers. A validator can turn it away first. | `pay`, your TODO |

Paying is an Update: the payer needs to know it worked. In `hello/hold.py`, replace the `TODO(ch06)` for `pay` with:

```python hello/hold.py
# An update: a message that changes the workflow, and gets an answer back.
@workflow.update
def pay(self, payment: Payment) -> str:
    self.paid_with = payment.card
    return f"Paid for seat {self.seat}."

# Its validator runs first, and a payment it rejects is never written to the history.
@pay.validator
def check_payment(self, payment: Payment) -> None:
    if not (payment.card.isdigit() and len(payment.card) == 4):
        raise ValueError(f"give the card's last four digits, not {payment.card!r}")
    if self.paid_with is not None:
        raise ValueError(f"seat {self.seat} is already paid for")
```

Setting `self.paid_with` wakes step 1's `wait_condition`.

- Restart the worker, and hold seat 12A for two minutes: `uv run hello-hold 12A 120`.
- Pay with something that isn't a card: `uv run hello-pay 12A 12ab`. Refused, and <!-- browser
[the hold's Event History](#workflow/hold-12a/history)
--><!-- local -->the hold's **Event History**<!-- /local --> has nothing about it: the validator turned it away first.
- Pay properly: `uv run hello-pay 12A 4242`. `Paid for seat 12A.`, and the hold completes at once: **Workflow Execution Update Accepted**, **Update Completed**, then **Workflow Execution Completed**.
