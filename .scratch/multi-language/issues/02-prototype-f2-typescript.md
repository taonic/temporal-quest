# 02 · Prototype: F2 in TypeScript, and measure Java and .NET

Status: resolved
Type: prototype
Spec: [../spec.md](../spec.md) (Contract, checks and challenges; Sandboxes and site)

## What

Throwaway code that tests the plan before any plumbing is built:

- `langs/typescript/hello` (Node 24): the trip workflow, `lookup_airport`, a worker and a starter, keeping to the wire contract. A Python client starts the TypeScript workflow.
- `test_ch01_hello.py`'s three F2 tests, passing against the TypeScript worker through a rough adapter.
- One FC1 choice: a TypeScript workflow-only worker, with the scenario's Python activities on the same queue.
- In a Daytona sandbox at today's size (1 vCPU, 2 GiB) with `travel-stack` up, measure the TypeScript bundle, a Java worker with Gradle (JDK 21), and a .NET 10 worker with `dotnet build`. For each: peak memory, the first build, the incremental build, the time from worker start to first poll, and a whole F2 check.

## Done when

The numbers are in the spec, and each language gets a verdict against the limits:

- **Memory:** fits in 2 GiB, or needs 4 GiB.
- **Check time:** at most 15 s warm and 45 s on a first run. If not, the fix that gets it there.
- **Java's build tool:** Gradle's daemon fits, or Java moves to Maven.
- **Language servers:** whether jdtls and a C# server fit.

## Results (2026-11-22)

The prototype code and how to run it again are in [../prototype/](../prototype/README.md).

There were three runs in Daytona sandboxes made from today's snapshot (`governance-course-537e9f66d918`): x86_64, 1 vCPU, `memory.max` 2 GiB, with `travel-stack up`. The stack holds 340–410 MB anon on its own. Versions: Node 24.22.3, JDK 21.0.13, .NET 10.0.404; the Temporal SDKs are TS 1.26.0, Java 1.41.1 and .NET 1.22.0. Memory below is the cgroup's peak **anon** memory, since page cache fills the 2 GiB whenever anything downloads and is reclaimable. No run had an OOM kill.

### Confirmed

- **The wire contract (D3) holds.** A Python client using the pydantic converter starts the TS, Java and .NET workflows by name, and their payloads round-trip. TS and Java needed no converter settings. .NET needs camelCase JSON (`JsonSerializerDefaults.Web`), set once where its client is created. Activity names stay snake_case; see the spec.
- **Black-box checks (D4) work.** F2's three checks pass against all three languages, with the Python checks' own assertions.
- **The split worker for challenges (D5) works.** FC1 choice A, in TypeScript, gives up after 3 attempts and fails the trip; choice C gets through on attempt 4. That's the same as in Python, with the scenario's fake activities running in Python on the same queue.

### Check time

| F2 check | First run (cold build daemons) | Warm (after an edit) | Worker restart after an edit |
|---|---|---|---|
| Python, today | 6.4 s | 6.4 s | |
| TypeScript, as prototyped (`tsc`, a worker per test) | 18.3 s | 18.4 s ✗ | |
| TypeScript, with the fixes | 10.5 s | 10.2 s | 3.2 s |
| Java, as prototyped (a worker per test) | 33.0 s | 21.3 s ✗ | |
| Java, with the fixes | 22.0 s | 11.5 s | 3.9–4.3 s |
| .NET, as prototyped | 11.8 s | 10.8 s | |
| .NET, with the fixes | 10.5 s | 8.6 s | 1.9–3.4 s |

**The fixes** bring every language within both limits (15 s warm, 45 s first run):

1. **One worker per check, not one per test.** It runs only the learner's workflows, and the activities run in Python, in process, as they do in the challenges. Starting a worker was the biggest cost (TS 2.4 s, Java 2 s, each time). Every Fundamentals TODO is workflow code, so the check still tests what the learner wrote. The FLAKY test goes back to the original monkeypatch. The learner's own activities in their language are left to the contract test.
2. **TypeScript runs from source with `tsx`,** so there's no `tsc` step. `tsc` took 4–5 s on 1 vCPU even for an incremental build. The SDK bundles the workflow `.ts` files itself. Type errors show in the editor, not in the check.
3. **A smaller JVM:** workers run with `JAVA_OPTS="-XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xmx256m"`, and Gradle with `org.gradle.jvmargs=-Xmx384m -XX:+UseSerialGC`.

FC1 in TypeScript, with the fixes, takes 10.8 s for choice A and 15.7 s for choice C, within the scenario's 20 s.

### Memory (peak anon, whole sandbox, during a check)

| | Check, with the learner's worker running | Language server (process tree after its first hover) | Its first hover |
|---|---|---|---|
| Python, today | 0.51 GB | jedi | |
| TypeScript | 1.02 GB | typescript-language-server: 0.91 GB | 2.3 s |
| Java | 1.15 GB (1.37 GB before the JVM settings) | jdtls: 1.55 GB (the sandbox reached 1.87 GB anon with only the stack beside it) | 57 s |
| .NET | 0.65 GB | csharp-ls 0.28.0: 0.23 GB | 5.1 s |

### Verdicts

- **TypeScript fits 2 GiB without its language server.** With typescript-language-server (decided for v1), a check and the server together come to about 1.9 GB. That doesn't fit with margin, so by the rule (Q21) the TypeScript snapshot gets 4 GiB. Cheaper to try first in 08: cap tsserver's memory (`maxTsServerMemory`) and measure again.
- **Java fits 2 GiB without a language server.** With jdtls it needs 4 GiB, and jdtls has more costs: it needs **Java 25 to run** (current snapshots require it, though the project still targets 21), so that's a second JDK in the image, and its first hover takes about a minute while it imports the Gradle project. Capping jdtls's heap didn't help: the launcher's `--jvm-arg=-Xmx512m` didn't start at all. **Your call:** a 4 GiB Java sandbox with jdtls, or a 2 GiB one with highlighting only.
- **.NET fits 2 GiB with csharp-ls.** Pin 0.28.0: 0.29.0's package is broken (`DotnetToolSettings.xml` is missing) and won't install.
- **Java stays on Gradle.** Its daemon fits with the 384 MB cap, and a warm build takes 2.2–3.6 s.

### Other findings

- **`TASK_QUEUE` is taken.** `.env` already sets `TASK_QUEUE=travel-agent`. The real override for the other languages' `hello` workers needs its own name (`HELLO_TASK_QUEUE`). The prototype gets away with it only because the adapter always passes it.
- **TypeScript's activity options sit inside `airport()`.** TypeScript sets activity options in `proxyActivities`, not per call. Creating the proxy inside `airport()` keeps F2's block, and FC1's choices, the same shape as Python's. That's valid, though less common than a module-level proxy.
- **Disk, for the snapshots:** JDK 21 is 346 MB and JDK 25 (for jdtls) 303 MB; .NET 10 is 627 MB; the Gradle cache is 197 MB and the NuGet cache 361 MB.
- **Fetching dependencies for the snapshot:** about 10 s for `npm ci`, 44–52 s for Gradle (its distribution plus the SDK), and 10–16 s for `dotnet restore`/build. Installing each toolchain takes under 10 s.

## Answer

Tao decided on 2026-11-22:
1. **Adopt the check fixes:** one workflow-only worker per check with Python activities, TypeScript run with `tsx`, and smaller JVMs.
2. **Java: highlighting only.** No jdtls, and Java stays at 2 GiB.
3. **TypeScript: try capping tsserver's memory first** (ticket 08). 4 GiB only if the cap isn't enough.

The spec and ADRs 0002 and 0003 now say so.
