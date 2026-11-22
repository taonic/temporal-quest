---
id: F9
title: Pay for it with an Update
teaser: "Send a running workflow a message: an Update that pays for the seat, and a validator that turns a bad card away."
learn: "Updates: a message to a running workflow, and a validator that can turn it away."
concepts: [update, validator]
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
langs:
  typescript:
    files:
    - path: langs/typescript/hello/src/hold.ts
      editable: true
    - path: langs/typescript/hello/src/starter.ts
    hint: "Paying for a hold isn't working yet. Look for the TODO(ch06) for the pay update in src/hold.ts: setHandler(pay, ...) that sets paidWith to the payment's card and returns a confirmation, with a validator that rejects a card that isn't four digits."
  java:
    files:
      - path: langs/java/hello/src/main/java/hello/FareHoldWorkflowImpl.java
        editable: true
      - path: langs/java/hello/src/main/java/hello/FareHoldWorkflow.java
      - path: langs/java/hello/src/main/java/hello/Starter.java
    hint: "Paying for a hold isn't working yet. Look for the TODO(ch06) for the pay update in FareHoldWorkflowImpl.java: pay() sets paidWith to the payment's card and returns a confirmation, and validatePay() throws for a card that isn't four digits."
  dotnet:
    files:
      - path: langs/dotnet/hello/FareHoldWorkflow.cs
        editable: true
      - path: langs/dotnet/hello/Starter.cs
    hint: "Paying for a hold isn't working yet. Look for the TODO(ch06) for the pay update in FareHoldWorkflow.cs: PayAsync sets paidWith to the payment's card and returns a confirmation, and ValidatePay throws for a card that isn't four digits."
---

## 3. Pay for it

Three ways to talk to a running workflow:

| Message | What it does | In the hold |
|---|---|---|
| **Query** | Reads its state; never in the history. | `status`, already written |
| **Signal** | Changes it, fire and forget: no answer. | |
| **Update** | Changes it, and answers. A validator can turn it away first. | `pay`, your TODO |

Paying is an Update: the payer needs to know it worked. <!-- lang python -->In `hello/hold.py`, replace the `TODO(ch06)` for `pay` with:<!-- /lang --><!-- lang typescript -->In `src/hold.ts`, replace the pay update's `TODO(ch06)` with:<!-- /lang -->
<!-- lang dotnet -->In `FareHoldWorkflow.cs`, replace the pay update's `TODO(ch06)`, both its methods, with:<!-- /lang -->
<!-- lang java -->In `FareHoldWorkflowImpl.java`, replace the pay update's `TODO(ch06)`, both its methods, with:<!-- /lang -->

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

```typescript langs/typescript/hello/src/hold.ts
// An update: a message that changes the workflow, and gets an answer back. Its validator runs
// first, and a payment it rejects is never written to the history.
setHandler(
  pay,
  (payment) => {
    paidWith = payment.card;
    return `Paid for seat ${hold.seat}.`;
  },
  {
    validator: (payment) => {
      if (!/^\d{4}$/.test(payment.card)) throw new Error(`give the card's last four digits, not '${payment.card}'`);
      if (paidWith !== undefined) throw new Error(`seat ${hold.seat} is already paid for`);
    },
  },
);
```

```java langs/java/hello/src/main/java/hello/FareHoldWorkflowImpl.java
// An update: a message that changes the workflow, and gets an answer back.
@Override
public String pay(Payment payment) {
    paidWith = payment.card();
    return "Paid for seat " + hold.seat() + ".";
}

// Its validator runs first, and a payment it rejects is never written to the history.
@Override
public void validatePay(Payment payment) {
    if (!payment.card().matches("\\d{4}")) {
        throw new IllegalArgumentException("give the card's last four digits, not '" + payment.card() + "'");
    }
    if (paidWith != null) throw new IllegalStateException("seat " + hold.seat() + " is already paid for");
}
```

```csharp langs/dotnet/hello/FareHoldWorkflow.cs
// An update: a message that changes the workflow, and gets an answer back.
[WorkflowUpdate("pay")]
public Task<string> PayAsync(Payment payment)
{
    paidWith = payment.Card;
    return Task.FromResult($"Paid for seat {hold!.Seat}.");
}

// Its validator runs first, and a payment it rejects is never written to the history.
[WorkflowUpdateValidator(nameof(PayAsync))]
public void ValidatePay(Payment payment)
{
    if (payment.Card.Length != 4 || !payment.Card.All(char.IsAsciiDigit))
    {
        throw new ArgumentException($"give the card's last four digits, not '{payment.Card}'");
    }
    if (paidWith != null) throw new InvalidOperationException($"seat {hold!.Seat} is already paid for");
}
```

<!-- lang python -->Setting `self.paid_with` wakes step 1's `wait_condition`.<!-- /lang --><!-- lang typescript -->Setting `paidWith` wakes step 1's `condition()`.<!-- /lang -->
<!-- lang dotnet -->Setting `paidWith` wakes step 1's `Workflow.WaitConditionAsync`.<!-- /lang -->
<!-- lang java -->Setting `paidWith` wakes step 1's `Workflow.await`.<!-- /lang -->

- Restart the worker, and hold seat 12A for two minutes: <!-- lang python -->`uv run hello-hold 12A 120`<!-- /lang --><!-- lang typescript -->`npm run hold -- 12A 120`<!-- /lang --><!-- lang dotnet -->`./hello hold 12A 120`<!-- /lang --><!-- lang java -->`./hello hold 12A 120`<!-- /lang -->.
- Pay with something that isn't a card: <!-- lang python -->`uv run hello-pay 12A 12ab`<!-- /lang --><!-- lang typescript -->`npm run pay -- 12A 12ab`<!-- /lang --><!-- lang dotnet -->`./hello pay 12A 12ab`<!-- /lang --><!-- lang java -->`./hello pay 12A 12ab`<!-- /lang -->. Refused, and <!-- browser
[the hold's Event History](#workflow/hold-12a/history)
--><!-- local -->the hold's **Event History**<!-- /local --> has nothing about it: the validator turned it away first.
- Pay properly: <!-- lang python -->`uv run hello-pay 12A 4242`<!-- /lang --><!-- lang typescript -->`npm run pay -- 12A 4242`<!-- /lang --><!-- lang dotnet -->`./hello pay 12A 4242`<!-- /lang --><!-- lang java -->`./hello pay 12A 4242`<!-- /lang -->. `Paid for seat 12A.`, and the hold completes at once: **Workflow Execution Update Accepted**, **Update Completed**, then **Workflow Execution Completed**.
