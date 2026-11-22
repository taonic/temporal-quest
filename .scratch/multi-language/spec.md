# Spec: the course in TypeScript, Java and .NET

Status: ready-for-agent
Drafted: 2026-11-22. Decisions settled the same day in [issue 01](issues/01-decide.md).
ADRs: [0001](../../docs/adr/0001-one-module-several-languages.md), [0002](../../docs/adr/0002-one-wire-contract-python-checks.md), [0003](../../docs/adr/0003-one-snapshot-per-language.md)

Today every Developer module is Python: the code learners edit (`hello/`, `travel_agent/`), the checks (pytest), the challenges' scenarios, the recorded histories, the snapshot, the editor's language server, and Ask Temporal's prompt. This spec adds TypeScript, Java and .NET (C#) to Fundamentals.

## Goals

- A learner who builds in TypeScript, Java or C# does Fundamentals (F1–F14, FC1–FC3) in that language, in the browser and locally, with the same guide, checks, challenges, XP and badges.
- Each language is real and idiomatic code for its SDK. It isn't Python with the punctuation changed.
- Adding a fourth language is mostly content: the plumbing is built once.

## Not goals

- **AI Agent stays Python, for good.** The Temporal Agent Harness, Monty and Dogwood's evaluator are Python-only. A learner on another language sees the branch tagged "Python" and does it in Python.
- **Essentials needs nothing.** Learners don't see its code.
- **Nexus, Payments, AI SDLC and Worker ops are decided later** ([issue 13](issues/13-other-branches.md)).
- **Go, Ruby and PHP aren't planned.** The wire contract makes any of them more of the same work.

## Decisions

### Scope and order

- **Fundamentals only** for now (above).
- **TypeScript first, then Java, then .NET.** TypeScript has the lightest toolchain, the cheapest language server and the largest audience after Python.
- **Toolchains:** Node 24, JDK 21 with Gradle, and .NET 10, each the current LTS. If ticket 02 shows the Gradle daemon doesn't fit, Java moves to Maven. Each language pins its SDK in its lockfile.
- **A language ships one tier at a time.** Once TypeScript has tier 1 (F1–F7, FC1, FC2), Fundamentals offers it for tier 1. A TypeScript learner who reaches F8 gets it in Python, tagged "Python". That works because every language's sandbox has the Python base.
- **No reviewer gate.** A tier ships in a language when `verify_modules.py` and the e2e pass in it.

### Content ([ADR 0001](../../docs/adr/0001-one-module-several-languages.md))

- **One module, several languages.** F2 is F2 in any language: the same id, map node, XP, badges and `requires`.
- **One `module.md`, with language blocks.** Prose stays shared. Text that names an API goes in a block, which works like the mode blocks:

  ```markdown
  <!-- lang python -->
  - `start_to_close_timeout`: how long one attempt may take…
  <!-- /lang -->
  <!-- lang typescript -->
  - `startToCloseTimeout`: how long one attempt may take…
  <!-- /lang -->
  ```

  - A run of fences one after another in different languages is one snippet with variants. The guide shows the learner's language, and Insert works as it does today.
  - Frontmatter fields that differ by language (`files`, `hint`, `tour`, `worker`, `questions`) go under a `langs:` map. The rest (`id`, `title`, `concepts`, `requires`, `check.tests`) stay shared.
  - A branch lists the languages it offers (`languages: [python, typescript]`). The build fails when one of its modules is missing a variant: a snippet, a tour anchor, or a `langs:` entry.
  - `maxWords` counts each language's rendering separately.
  - GitHub shows every language's blocks one after another. That's accepted.
- **Ids and labels.** The ids are `python`, `typescript`, `java` and `dotnet`. They're used in frontmatter, `<!-- lang … -->`, `QUEST_LANG` and paths. Learners see "Python", "TypeScript", "Java" and "C# (.NET)". Fences use the highlighter's names (`python`, `typescript`, `java`, `csharp`), and the build maps `csharp` to `dotnet`.
- **Code layout.** Python stays where it is. The others go under `langs/<lang>/` (`langs/typescript/hello/src/workflows.ts`), with masters in `authoring/langs/<lang>/…` and `// @@solution F2` markers, which `render.py` and `build.mjs` already parse.
- **A starter for each language.** F1 shows the starter as a file to read, so each language has its own (`npm run start -- SFO JFK`, `gradle run --args=…`, `dotnet run -- …`). The trip button and the worker toggle take their commands from the branch's `langs:`.
- **The Fundamentals boss** has no pool yet. When it's written, its stories avoid language-specific APIs.

### Contract, checks and challenges ([ADR 0002](../../docs/adr/0002-one-wire-contract-python-checks.md))

- **One wire contract for `hello`.** Every language uses the Python version's workflow type names, activity names, query and update names, task queue (`hello`) and JSON field names. They're written down in `hello/CONTRACT.md`, and a contract test runs the Python starter against each language's worker. Where an SDK derives a name differently (a Java interface name, a .NET class name), the code sets it explicitly.
- **Activity names stay snake_case** (`lookup_airport`), as Python names them. Java and .NET set the name in the activity's annotation (`@ActivityMethod(name = "lookup_airport")`, `[Activity("lookup_airport")]`), so learners' workflow code calls `lookupAirport`/`LookupAirportAsync`. TypeScript names an activity after its function, so its activity functions keep the snake_case name too, with a comment saying why (decided 2026-11-22).
- **Three Python fields get single-word names first,** so the JSON needs no annotations anywhere:

  | Model | Old | New |
  |---|---|---|
  | `BoardingRequest` | `seconds_per_passenger` | `pace` |
  | `HoldStatus` | `seconds_left` | `remaining` |
  | `BookingStatus` | `waiting_for_new_card` | `waiting` |

- **One Python test suite checks every language.** With `QUEST_LANG=typescript`, a check builds the learner's code, starts **one** worker in their language for the whole check, with **only workflows**, on the check's own task queue, and checks the result and the history. The activities run in Python, in process, as they do in the challenges. Every Fundamentals TODO is workflow code, so the check still tests what the learner wrote (decided after [02](issues/02-prototype-f2-typescript.md): a worker per test cost 2–2.5 s each in TS and Java).
  - `tests/langs.py` is the adapter: how to build, start a workflow-only worker on a queue, and replay a history in each language. Python stays in process, as today.
  - Monkeypatches stay as they are, since they patch the Python activities.
  - The learner's own activities in their language are covered by the contract test, not the checks.
  - The other languages' `hello` workers take their queue from `HELLO_TASK_QUEUE` (default `hello`) and their mode from `WORKER_MODE` (`all`, `workflows`, `activities`). `.env` already uses `TASK_QUEUE` for the travel agent.
  - **TypeScript runs from source with `tsx`**, with no `tsc` step (4–5 s on 1 vCPU). The SDK bundles the workflow `.ts` files itself, and type errors show in the editor.
  - **Java runs small JVMs:** workers with `JAVA_OPTS="-XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xmx256m"`, and Gradle with `org.gradle.jvmargs=-Xmx384m -XX:+UseSerialGC` in `gradle.properties`.
  - F13 calls the language's `replay <history.json>` command and reads its exit status.
  - A module's `check.tests` stays the same. Only its `hint` changes per language.
  - A local TypeScript learner needs uv to run checks. They need it for `travel-stack` already.
  - Native tests (Jest, JUnit, xUnit) only for a check the suite can't express.
- **Challenge scenarios stay Python.** For a choice in another language, `kit.worker` starts a workflow-only worker from the patched file in that language. The scenario's fake activities run in a Python activity-only worker on the same task queue.
  - There's one scenario per challenge.
  - `challenge.md` takes per-language `file`, `replace` and choice `code`.
  - Recordings go per language (`recordings/<lang>/A.json`).
  - FC3's Java choices use `Workflow.getVersion`.
- **Histories are recorded per language** (`tests/histories/<lang>/`). Java's version marker isn't the one the Core-based SDKs write.

### Sandboxes and site ([ADR 0003](../../docs/adr/0003-one-snapshot-per-language.md))

- **One snapshot per language:** the Python base plus that one toolchain, with dependencies prefetched and one warm build. A learner's sandbox starts from their language's snapshot, and changing language offers a new sandbox. Each new or changed toolchain means a snapshot rebuild.
- **Memory.** If a language's worker and build tool don't fit in 2 GiB next to `travel-stack`, that language's snapshot gets 4 GiB. A lighter stack (only Temporal and the console at boot) is a later optimization. Measured in [02](issues/02-prototype-f2-typescript.md) (peak anon during a check): TypeScript 1.02 GB, Java 1.15 GB, .NET 0.65 GB, so all three fit at 2 GiB. The language servers decide the rest (Editor, below).
- **Check time.** A check in any language takes at most 15 s on a warm build and 45 s on a fresh sandbox's first run. A language that misses this gets fixed before its content is written. With the fixes above, measured in 02: TypeScript 10.5 s and 10.2 s, Java 22.0 s and 11.5 s, .NET 10.5 s and 8.6 s (first run, then warm).
- **Choosing a language.** A second question comes right after the Developer persona ("Which language do you build in?"). It can be changed from the top bar any time and is saved on the server with progress. A cohort can set a default, and `?lang=` sets it in a link. A language stays hidden until it has at least one whole tier.
- **Progress.** A pass counts for the module, whatever the language. The pass event records `lang`, and admin journeys show it. A new **Polyglot** skill badge goes to a learner who passes the same code module in two languages.
- **Editor.** Syntax highlighting for all four languages. The language servers, decided after 02:
  - **TypeScript:** typescript-language-server. Its process tree holds about 0.9 GB, which with a check is too close to 2 GiB. Ticket 08 first tries capping tsserver's memory (`maxTsServerMemory`). If the cap doesn't keep a check plus the server comfortably under 2 GiB, the TypeScript snapshot gets 4 GiB.
  - **Java: highlighting only.** jdtls pushed the sandbox to 1.87 GB on its own, took 57 s for its first hover, and needs Java 25 to run. Java stays at 2 GiB.
  - **C#:** csharp-ls, pinned to 0.28.0 (0.29.0's package won't install). It holds 0.23 GB, so .NET stays at 2 GiB.
- **Ask Temporal** is told the learner's language, in place of "The workshop is in Python".
- **e2e.** Python runs on every deploy, as today. Every language runs nightly, and also on any deploy that changes that language's files.

## What changes, by area

| Area | Today | With languages |
|---|---|---|
| `quests/` | Python snippets and hints | language blocks, `langs:` frontmatter, `languages:` on a branch |
| `hello/` | multi-word fields | `pace`, `remaining`, `waiting`; `CONTRACT.md` |
| `authoring/`, `render.py`, `quest.py` | `.py` and `.dw` | plus `.ts`, `.java` and `.cs` under `langs/`; `./quest lang <x>` |
| `verify_modules.py` | each module, Python | each module and each language |
| `tests/` | imports `hello` | the language adapter; env vars in place of monkeypatches; histories per language |
| `scripts/challenges.py` | imports the patched file | starts the patched worker for its language, with Python activities beside it |
| `course/content/build.mjs` | `SNIPPET_FILES`, `WORKER_COMMAND`, `HELLO_START` hard-code Python | per-language snippets; worker and starter commands from frontmatter |
| `course/web` | Python mode, jedi | language picker, CodeMirror modes, TypeScript language server, Polyglot badge |
| `course/runner` | `pgrep` for `hello-worker`, the jedi bridge | worker detection and language server per language, the learner's language's snapshot |
| `helper.mjs` | "The workshop is in Python" | the learner's language |
| `course/snapshot` | Python plus Dogwood | one image per language |
| e2e | each exercise in Python | each exercise in each language (cadence above) |

## Phases

1. **Decide and measure.** Done: [01](issues/01-decide.md) settled the decisions, and [02](issues/02-prototype-f2-typescript.md) measured them in real sandboxes. Its code is in [prototype/](prototype/README.md).
2. **Plumbing, Python only (03–08).** Add language as a dimension everywhere, with Python the only language. Nothing changes for learners, and every existing test and e2e still passes.
3. **TypeScript (09, 10).** Tier 1, then tier 2. Ship after each.
4. **Java (11), then .NET (12).**
5. **Other branches (13).**

## Risks

- **The shared prose drifts from one language's code.** The build fails on a missing variant, and `verify_modules.py` runs every module's check in every language.
- **Checks get slow.** Measured in 02, and fixed within the limits (above). A later module whose check needs several workers, or a build step, has to be measured against them again.
- **Java learners get no language server.** Hover and completion are worth less in Java, where the editor would mostly show the SDK's signatures. Revisit if Java sandboxes get 4 GiB for another reason.
- **Writers have to keep 4 languages in step.** Each module edit touches up to four snippets. Language blocks keep that in one file, and the build reports which languages a change left behind.
- **No fluent reviewer.** Idiom mistakes in TypeScript, Java or C# reach learners if the checks don't catch them. The code follows Temporal's own samples for each SDK, and feedback from learners on a language goes back into its modules.
