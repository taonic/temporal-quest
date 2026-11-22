# 11 · Java: Fundamentals

Status: claimed
Blocked by: 10

## What

09 and 10 again, in Java (JDK 21, with Gradle or Maven per 02).

- Versioning uses `Workflow.getVersion`, which changes F12 and FC3's choices.
- F11 teaches compensations written by hand, as the other languages do, and mentions the SDK's `Saga` class in a sentence.
- Workflow type names and activity names are set explicitly to match the contract (`@WorkflowMethod(name = …)`, `@ActivityMethod(name = "lookup_airport")`).
- No language server: the editor only highlights Java.

## Done when

`verify_modules.py` and the e2e pass in Java for all of Fundamentals, in a sandbox within 02's limits.

## Answer

On 2026-11-22, all of Fundamentals comes in Java: `languages: [python, typescript, java]` on the branch, and every module and challenge has its Java text.

- **`langs/java/hello`** (JDK 21, Gradle 9.9.2 wrapper, SDK 1.41.1):
  - An interface and an `Impl` class for each workflow. The interface names the contract's types, queries and updates (`@WorkflowMethod(name = "HelloTripWorkflow")`, `@UpdateMethod(name = "pay")`), and `Activities` names each activity (`@ActivityMethod(name = "lookup_airport")`).
  - The masters in `authoring/langs/java/hello`: F2 in `HelloTripWorkflowImpl`; F8, F9 and F12 (`Workflow.getVersion`) in `FareHoldWorkflowImpl`; F10 (`Async.function` on a child stub) in `ItineraryWorkflowImpl`; F11 and F14 in `BookTripWorkflowImpl`; F13 (`WorkflowReplayer`) in `Replay`.
  - An open TODO compiles: it throws, and the workflow task fails and waits, as in the other languages. An open update's validator throws, so the update is refused, not left to stall the workflow.
  - `./hello` builds with Gradle when the code has changed, then runs: `./hello worker`, `./hello start SFO JFK`, `./hello hold 12A 20` and so on. JVMs are small (`-Xmx256m`, serial GC, C1 only) and the Gradle daemon's is 384 MB and idles out after 15 minutes.
  - A one-line log (logback and `LogLine`): the SDK's failures come out as `WARN Workflow task failed (the workflow waits, and it is retried): TODO(ch01): …` and `WARN Activity charge_card failed (attempt 1): card ending 0000 was declined (CardDeclined)`, without stack traces.
- **Checks:** the 22 (contract, Hello Temporal, Building blocks) pass in Java. `tests/histories/java/`: the hold before the email recorded in Java (its `getVersion` marker differs from `patched`). The replayer reports nondeterminism inside a query failure's message, so `Replay` recognises it by its code, `TMPRL1100`. Any other error exits 2.
- **Text:** a Java block after every TypeScript one, Java snippets taken from the masters' solutions, and `langs.java` (files with their interfaces, hints, F1's and F8's tours). A Java text names its files from its source folder (`FareHoldWorkflowImpl.java`), and the build finds them under `src/main/java/hello` (`SOURCE_FOLDERS`). F11's mention of the SDK's `Saga` class is in the summing-up after F14, where it fits the word budget.
- **Challenges:** FC1–FC3 in Java, recorded, every choice as flagged. FC2's "count by the clock" behaves differently in Java (no sandbox stops `System.currentTimeMillis()`; the count falls to 0 after the restart) and has its own explanation. A challenge's "before" version that doesn't compile (FC1's, in a typed language) is left out; only FC3's scenario uses one.
- **Snapshot:** `course/snapshot/languages/java.Dockerfile`: Temurin 21.0.5, the hello built once into a shared Gradle home (`/opt/gradle-home`), `quest` on the PATH, terminals in the project. No language server. 2 GiB.
- **Site and runner:** Java's worker (`[h]ello.Main worker`) and starter patterns; `./hello <command> <args>` in prose gets a ▶. CI runs the walkthroughs of every language (`@typescript`, `@java`, `@dotnet`) from one list.
- **Verified:** `verify_modules.py` (every Java module fails open and passes solved); 200 course tests, including Java's guide having no Python or TypeScript in it.
