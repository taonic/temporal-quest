# 02 · F14 step by step, with the new card sent from the Temporal UI

Status: done (2026-11-22), awaiting review
Spec: [../spec.md](../spec.md) (The steps; Sending an Update from the course)
Blocked by: 01

## What

- **Prototype first.** Use the proxy's bridge to open **Send an Update** on a waiting booking in UI 2.50.1, and fill in the name and the data. Settle the spec's three risks before writing the module.
- **Code.**
  - Split `authoring/hello/saga.py`'s F14 into three blocks: the loop, the `new_card` Update, and its validator.
  - Remove `hello-new-card`, from `hello/starter.py` and from `pyproject.toml`.
  - When the booking waits, `hello-book` points at the Temporal UI.
- **Course.**
  - `content/build.mjs` turns `#workflow/<prefix>/update/<name>?…` links into buttons.
  - The bridge in `runner/proxy.mjs` gets an `update` navigation that fills the dialog in but doesn't submit.
- **Module.** F14's text becomes steps 6–9, as drafted in the spec, with `minutes: 9`. F12's steps become 10–11, and F13's becomes 12.
- **e2e.** The exercise 6 walkthrough clicks the buttons and **Submit**.

## Done when

A learner in a fresh sandbox can do steps 6–9 using only the buttons and **Submit**, with no CLI for the new card. `verify_modules.py`, `npm test` and the e2e walkthrough for exercise 6 pass. Each step's text is at most 150 words, not counting code blocks.

## Comments

**2026-11-22, prototyped.** The spec's three risks are settled (see its Prototype section): in-page DOM calls can open **Send an Update**, pick or type the name, and fill the CodeMirror data box. A rejection and a success both read clearly in the UI. Scripts are in the session scratchpad, not the repo; the bridge code gets written fresh in `runner/proxy.mjs`.

Snapshot: removing `hello-new-card` changes `pyproject.toml`, so this issue needs a new sandbox snapshot. Build it as part of the issue, and say so.

**2026-11-22, built.** As the spec says:

- **Code.** F14 is three blocks in `authoring/hello/saga.py`: the loop, the `new_card` Update, and its validator. `hello-new-card` is gone. When the booking waits, `hello-book` points at the Temporal UI.
- **Tests.** The tests give each TODO its own hint. With only the validator open, the check fails with the validator's hint.
- **Course.**
  - `content/build.mjs` renders `#workflow/<prefix>/update/<name>?k=v` as a button with `data-workflow-update` and `data-update-input`. Locally, it's words.
  - `store.openWorkflow(prefix, tab, update)` sends `{workflow, tab: "history", update}`.
  - `runner/proxy.mjs`'s bridge has `fillUpdate()`. It opens **More Actions**, then **Send an Update**, picks or types the name (switching to **Custom** if the picker doesn't list it), types the JSON into the CodeMirror box, focuses **Submit**, and answers `updateready` or `updatefail`. On `updatefail`, `SandboxPanes` shows a toast.
  - Already on the workflow's page, it doesn't reload. A dialog that's already open gets refilled.
- **Module.** Steps 6–9, as the spec drafts them, with browser and local mode blocks, `minutes: 9`. F12 is now steps 10–11, and F13 is step 12. Each step is at most 115 words in either mode.
- **Snapshot.** No rebuild was needed. With `hello-new-card` gone, `pyproject.toml` is back to the committed one, and its snapshot, `governance-course-537e9f66d918`, already exists and is active.

Verified:

- `render.py --check` and `verify_modules.py` pass.
- pytest passes for `test_ch06_building_blocks.py` and `test_base.py`.
- `npm run content` and `npm test` pass: 179, including a new test of the update link in both modes.
- The real `injectUiLoader` script, run in the real Temporal UI 2.50.1 against a dev server and driven by `nav` messages:
  - It opened and filled the dialog from the workflows list.
  - The expired card was refused, and the error showed in the dialog.
  - Refilling the open dialog with `4242` completed the booking.
  - With the worker stopped, it typed the name.

Not run: the e2e walkthrough (`course/e2e`), which needs a deployed site and a sandbox.

**2026-11-22, the Update and its validator in one step.** On review, step 9 (the validator) merged into step 8, as F9 writes `pay` and its validator together. F14 is now steps 6–8 and two TODO blocks, about 8 minutes. F12 is steps 9–10, and F13 is step 11. Step 8 sends `1111` (refused) and then `4242` (booked). The test hints, the e2e step and the update-link unit test follow. Verified again: render, `verify_modules.py`, pytest, and `npm test` (179). The snapshot name is unchanged (`governance-course-537e9f66d918`).

**2026-11-22, step 9: read what the Update did.** A new beat after step 8 walks the learner through the booking's Event History, from the bottom up:

- **Activity Task Failed** (`charge_card`, CardExpired).
- **Workflow Execution Update Accepted**, whose **Accepted Request** carries `{"card": "4242"}`.
- **Workflow Execution Update Completed**, with the Update's answer.
- **Activity Task Scheduled**, `charge_card` again, now with `"card": "4242"`.
- No event for the refused `1111`.

The event names and the order were checked against a real run in UI 2.50.1, which lists the newest event first. The e2e step asserts the accepted Update and the failed charge.

Also:

- The "A declined card, `0000`, still undoes everything" line is gone.
- `minutes: 9`.
- F12 is steps 10–11, and F13 is step 12.
