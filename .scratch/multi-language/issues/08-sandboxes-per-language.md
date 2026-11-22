# 08 · A sandbox for each language

Status: resolved
Blocked by: 02
Spec: [../spec.md](../spec.md) (Sandboxes and site)

## What

- **Images.** `course/snapshot` gets one image for each language: the Python base (the stack, Dogwood, the dev server) plus Node 24, JDK 21 with Gradle (or Maven, per 02), or .NET 10, with dependencies prefetched and a warm build. A language that 02 found doesn't fit in 2 GiB gets 4 GiB.
- **The runner.** `repo-files.mjs` gets snapshot inputs and names per language. `sandboxes.mjs` creates a sandbox from the learner's language's snapshot, and offers a new sandbox when the language changes.
- **Worker detection.** `pgrep` for each language's worker command.
- **Language servers.**
  - C#: csharp-ls, pinned to 0.28.0 (0.29.0 won't install).
  - Java: none, highlighting only.
  - TypeScript: typescript-language-server, with tsserver's memory capped (`maxTsServerMemory` in its init options). Measure a check plus the capped server against 2 GiB. If it isn't comfortably under, the TypeScript snapshot gets 4 GiB.
- **Image settings.** Java images set `JAVA_OPTS` and ship `gradle.properties` as the spec says. .NET images need `libicu` (or `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1`).

Every new image is a snapshot rebuild. Build it and say so before it's needed.

## Done when

A TypeScript sandbox starts from its snapshot in the same time as a Python one, and the Python snapshot hasn't changed.

## Answer

Done on 2026-11-22, for TypeScript. Java and .NET get their images when their content is near (tickets 11 and 12), the same way.

- **Memory, measured first** (`prototype/measure-tscap.sh`, in a sandbox from today's snapshot). Running the stack, the learner's TypeScript worker, typescript-language-server and an F2 check together peaks at 1.45 GB anon, with no OOM. `maxTsServerMemory` changed nothing (909 MB with no cap, 863 MB at 512, 906 MB at 384): the project is small, and the memory is Node and the SDK's types, not tsserver's heap. So **TypeScript stays at 2 GiB**, and the 512 MB cap stays only as a guard.
- **The image.** `course/snapshot/languages/typescript.Dockerfile` goes on top of Python's Dockerfile. It adds Node 24.22.3, typescript-language-server 6.1.0 and TypeScript 5.9.3, `npm ci` for `langs/typescript/hello`, `quest` on the PATH, and the bridge.
  - **Its own builder.** `course/snapshot/build-language.mjs` (`npm run snapshot:language -- typescript`) is separate from `build.mjs`, which is one of Python's inputs.
  - **Names.** `languageSnapshotName()` hashes Python's inputs plus the language's own. Python's snapshot is unchanged (`governance-course-537e9f66d918`); TypeScript's is `governance-course-typescript-30db0ef962da`.
- **`course/snapshot/languages/lsp_stdio_bridge.py`** is a generic stdio↔WebSocket bridge, and merges `--init` into `initialize`.
- **`langs/typescript/hello`** starts from the prototype's F2 code, with `npm run worker`, `npm run start` and `npm run typecheck`. Its package files are the snapshot's inputs. `repo-files.mjs` uploads `langs/`, minus `node_modules` and build output.
- **The runner:**
  - `config.languageSnapshots` lists each language's snapshot (`SANDBOX_SNAPSHOT_TYPESCRIPT` overrides it).
  - `POST /api/sandbox/start` takes the page's `language`. A new sandbox starts from that language's snapshot, labelled `language`.
  - A learner whose sandbox was made for another language gets the `language` state, and the page offers "Start a new sandbox". Their sandbox isn't deleted unasked.
  - Terminals open in `languageHome()` (`langs/typescript/hello`).
  - The poll finds each language's worker (`WORKERS`: TypeScript's is `[t]sx src/worker`) and reports its `command`, and finds TypeScript's starter.
  - `START_LSP` also starts TypeScript's bridge on port 2088 where it's installed, and `/api/lsp?lang=typescript` relays to it.
  - Exercises in another language get `quest …` scripts (from its project).
- **Decided with Tao:** a language's learners work in its project: `npm run worker`, `npm run start -- SFO JFK`, `quest check F2`.
- **Verified against Daytona** (`prototype/verify-sandboxes.mjs`, through the runner's `SandboxManager`):
  - A TypeScript sandbox is ready in 23 s and a Python one in 24 s.
  - It has Node, the packages, `quest` and the language server, and `quest` works from the project.
  - F2's check passes in TypeScript in 9 s.
  - The poll reports `npm run worker` with `FLAKY=1`.
  - The language server answers a hover over its bridge, at 252 MB.
  - A learner on Python is offered a new sandbox.
  - A runner unit test covers the snapshot choice, the folder, the worker and the mismatch; 195 course tests pass.

Moved to ticket 09: the page's TypeScript client for the language server (`lsp.js`, CodeEditor's `languageServer`). It needs a TypeScript exercise to be seen. The bridge and relay are ready for it.
