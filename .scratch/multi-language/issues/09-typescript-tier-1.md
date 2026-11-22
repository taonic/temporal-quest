# 09 · TypeScript: Fundamentals tier 1

Status: resolved
Blocked by: 03, 05, 06, 07, 08
Spec: [../spec.md](../spec.md) (Scope and order)

## What

- `langs/typescript/hello`: the trip workflow, the activities, the boarding counter, the worker, the starter and a `replay` command, all keeping to the contract. Masters for F2's TODO.
- TypeScript variants of F1–F7, FC1 and FC2: snippets, API sentences, hints, files and tours.
- Recordings for FC1 and FC2 in TypeScript.
- e2e in TypeScript: nightly, and on deploys that change TypeScript files.
- The editor's TypeScript language server, page side (from ticket 08): `lsp.js` connects to `/api/lsp?lang=typescript` for `.ts` files, with `typescript` as the language id and the lsp-client's own hover. The bridge (port 2088) and the relay are in place.
- The TypeScript commands in the guide: `npm run worker`, `npm run start -- SFO JFK` and `quest check F2`, from `langs/typescript/hello`, where its terminals open. The branch's `langs.typescript.worker` is `npm run worker`, and its `starter` is `npm run start --`.

There's no reviewer gate. Follow Temporal's TypeScript samples for idiom.

## Done when

`verify_modules.py` and the e2e pass in TypeScript for tier 1, and Fundamentals offers TypeScript for tier 1, with tier 2 shown as Python.

## Answer

Done on 2026-11-22. Fundamentals offers TypeScript for tier 1 (`languages: [python, typescript]`). Tier 2 and FC3 are `languages: [python]` until ticket 10, so a TypeScript learner does them in Python, tagged. With a whole tier, TypeScript is now on offer (`course.languages`), and the site asks which language a developer builds in.

- **`langs/typescript/hello`:**
  - The trip workflow, with F2's TODO in its master (`authoring/langs/typescript/hello/src/workflows.ts`).
  - The boarding workflow (`src/board.ts`: its `boarded` query, its timers and its replay-aware `log`).
  - The starter (`npm run start -- SFO JFK`, `npm run board -- SFO JFK`), which reads the workshop's `.env` without overriding the environment.
  - A worker with a readable log: one line a message, "Workflow task failed (the workflow waits, and it is retried)" where the SDK says "Workflow failed", and no bundle report. Forwarding the core's logs into Node (`forward: {}`) kept the worker from shutting down on SIGTERM or Ctrl-C, so the core logs to the console, errors only.
- **The guide:** TypeScript variants of F1–F7, with language blocks, F2's snippet (which Insert puts in place of the TODO), `langs.typescript` files, hints and a code tour, and `quest check`. A language's text names its files from its project (`src/workflows.ts`), and the build resolves them to `langs/typescript/hello/…`.
- **Challenges:** FC1 and FC2 in TypeScript, recorded, every choice as flagged in both languages. FC2's "count by the clock" uses `performance.now()`, which a workflow doesn't have, and has its own explanation. (In TypeScript `Date.now()` is the history's time, so it would have come out right.)
- **The editor:** a TypeScript language-server client (`lsp.js` `language`, CodeEditor's `lspTs`), through the bridge from ticket 08.
- **Sandboxes, found by the walkthrough:**
  - The snapshot's `bash.bashrc` moved every shell to `/workshop`, so the TypeScript image now sends them to its project.
  - The runner runs `./quest lang <language>` when it bootstraps a sandbox made for another language, so the check and catch-up use its files.
  - The snapshot hashes only the lockfile, not `package.json`.
- **e2e:** `LANGUAGE_WALKTHROUGHS.typescript["01-hello-temporal"]`, tagged `@typescript`. `e2e.yml` runs it nightly and after deploys that change TypeScript or Fundamentals, and `sandbox-snapshot.yml` builds the language snapshots on deploy.
- **README:** "In TypeScript", how to run it locally.
- **Verified:**
  - `verify_modules.py`: TypeScript's F2 fails while open and passes solved, and F7 passes.
  - The contract test runs TypeScript's tier 1, with tier 2 skipped.
  - 198 course tests pass, including what TypeScript's guide must and mustn't say.
  - `./quest lang typescript` with `./quest check F2`/`F7` work locally.
  - **The TypeScript walkthrough passed** on a local runner and site against Daytona: every step of Hello Temporal in a TypeScript sandbox, ending with ✓ Check, in 4.9 minutes.

Left for later: the architecture diagrams (exercise 1's) are drawn with Python's commands (`hello-start`, `hello-worker`).
