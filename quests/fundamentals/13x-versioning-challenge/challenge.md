---
id: FC3
title: Ship a step without breaking a hold
teaser: Ship the email step while an old hold is running. Pick the version that keeps both holds going, and watch each one run.
learn: "How to ship a change that keeps old and new runs going side by side."
after: F12
file: hello/hold.py
# The block each choice replaces: the email step, as F12 left it.
replace: |
  # A step added while holds were already running. patched() is True for a run that reaches
  # this line on the new code, and False when replaying a run that got past it without the
  # step: so an old hold carries on as it was, and every new one sends the email.
  if workflow.patched("email-the-hold"):
      await workflow.execute_activity(send_hold_email, hold, start_to_close_timeout=timedelta(seconds=10))
hint: A worker replays every hold sooner or later, old and new. Which version gives the same answer on every replay as it did the first time?
choices:
  - label: Just add the step
    code: |
      # Email the traveller first: the new step.
      await workflow.execute_activity(send_hold_email, hold, start_to_close_timeout=timedelta(seconds=10))
    explanation: "The new hold was fine, but the old one got stuck: replaying its history, the new code asked for an email first, and the history says it started a timer first. Nondeterminism: the workflow task fails, and keeps failing, until the code matches."
    langs:
      typescript:
        code: |
          // Email the traveller first: the new step.
          await send_hold_email(hold);
      java:
        code: |
          // Email the traveller first: the new step.
          activities.sendHoldEmail(hold);
      dotnet:
        code: |
          // Email the traveller first: the new step.
          await Workflow.ExecuteActivityAsync((Activities act) => act.SendHoldEmailAsync(hold), Step);
  - label: Skip the step when replaying
    code: |
      # Old holds are replays: only send the email on a first run.
      if not workflow.unsafe.is_replaying():
          await workflow.execute_activity(send_hold_email, hold, start_to_close_timeout=timedelta(seconds=10))
    explanation: "The old hold carried on, but the new one got stuck after the restart: its history has the email, and the replay skipped it. is_replaying() is true for every run a worker replays, new or old: it can't tell a run that started before the change from one after it. A patch can, because it's recorded."
    langs:
      typescript:
        code: |
          // Old holds are replays: only send the email on a first run.
          if (!workflowInfo().unsafe.isReplaying) {
            await send_hold_email(hold);
          }
        explanation: "The old hold carried on, but the new one got stuck after the restart: its history has the email, and the replay skipped it. isReplaying is true for every run a worker replays, new or old: it can't tell a run that started before the change from one after it. A patch can, because it's recorded."
      java:
        code: |
          // Old holds are replays: only send the email on a first run.
          if (!Workflow.isReplaying()) {
              activities.sendHoldEmail(hold);
          }
        explanation: "The old hold carried on, but the new one got stuck after the restart: its history has the email, and the replay skipped it. Workflow.isReplaying() is true for every run a worker replays, new or old: it can't tell a run that started before the change from one after it. A version can, because it's recorded."
      dotnet:
        code: |
          // Old holds are replays: only send the email on a first run.
          if (!Workflow.Unsafe.IsReplaying)
          {
              await Workflow.ExecuteActivityAsync((Activities act) => act.SendHoldEmailAsync(hold), Step);
          }
        explanation: "The old hold carried on, but the new one got stuck after the restart: its history has the email, and the replay skipped it. Workflow.Unsafe.IsReplaying is true for every run a worker replays, new or old: it can't tell a run that started before the change from one after it. A patch can, because it's recorded."
  - label: Guard it with a patch
    right: true
    code: |
      # patched() is recorded in the history: True from now on, False for a run that got past this line without it.
      if workflow.patched("email-the-hold"):
          await workflow.execute_activity(send_hold_email, hold, start_to_close_timeout=timedelta(seconds=10))
    explanation: "Both holds finished. The old one replayed as it was (no email, no marker), and the new one sent the email and recorded the patch, so its replays take the new path too."
    langs:
      typescript:
        code: |
          // patched() is recorded in the history: true from now on, false for a run that got past this line without it.
          if (patched('email-the-hold')) {
            await send_hold_email(hold);
          }
      java:
        code: |
          // getVersion is recorded in the history: 1 from now on, DEFAULT_VERSION for a run that got past this line without it.
          int version = Workflow.getVersion("email-the-hold", Workflow.DEFAULT_VERSION, 1);
          if (version == 1) {
              activities.sendHoldEmail(hold);
          }
        explanation: "Both holds finished. The old one replayed as it was (no email, no marker), and the new one sent the email and recorded its version, so its replays take the new path too."
      dotnet:
        code: |
          // Patched() is recorded in the history: true from now on, false for a run that got past this line without it.
          if (Workflow.Patched("email-the-hold"))
          {
              await Workflow.ExecuteActivityAsync((Activities act) => act.SendHoldEmailAsync(hold), Step);
          }
langs:
  typescript:
    file: langs/typescript/hello/src/hold.ts
    replace: |
      // A step added while holds were already running. patched() is true for a run that reaches this
      // line on the new code, and false when replaying a run that got past it without the step: so an
      // old hold carries on as it was, and every new one sends the email.
      if (patched('email-the-hold')) {
        await send_hold_email(hold);
      }
  java:
    file: langs/java/hello/src/main/java/hello/FareHoldWorkflowImpl.java
    replace: |
      // A step added while holds were already running. getVersion records a marker when a run first
      // reaches this line on the new code, and returns 1; replaying a run that got past it without
      // the step, it returns DEFAULT_VERSION: so an old hold carries on as it was, and every new one
      // sends the email.
      int version = Workflow.getVersion("email-the-hold", Workflow.DEFAULT_VERSION, 1);
      if (version == 1) {
          activities.sendHoldEmail(hold);
      }
  dotnet:
    file: langs/dotnet/hello/FareHoldWorkflow.cs
    replace: |
      // A step added while holds were already running. Patched() is true for a run that reaches
      // this line on the new code, and false when replaying a run that got past it without the
      // step: so an old hold carries on as it was, and every new one sends the email.
      if (Workflow.Patched("email-the-hold"))
      {
          await Workflow.ExecuteActivityAsync((Activities act) => act.SendHoldEmailAsync(hold), Step);
      }
---

Hold 14C started before the email step existed. You ship the step, a new hold starts, and the worker restarts, so both holds get replayed. Which version of the email step in <!-- lang python -->`run()` in `hello/hold.py`<!-- /lang --><!-- lang typescript -->`src/hold.ts`<!-- /lang --><!-- lang java -->`FareHoldWorkflowImpl.java`<!-- /lang --><!-- lang dotnet -->`FareHoldWorkflow.cs`<!-- /lang --> keeps both holds going?
