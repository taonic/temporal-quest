# 09 · TypeScript: Fundamentals tier 1

Status: ready-for-agent
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
