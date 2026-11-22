# 12 · .NET: Fundamentals

Status: resolved
Blocked by: 10

## What

09 and 10 again in C#.

## Done when

All of Fundamentals passes in C#.

## Answer

On 2026-11-22, all of Fundamentals comes in C#: `languages: [python, typescript, java, dotnet]`.

- **`langs/dotnet/hello`** (.NET 10, Temporalio 1.22.0): one class a workflow, named by the contract (`[Workflow("HelloTripWorkflow")]`, `[WorkflowUpdate("pay")]`, `[Activity("lookup_airport")]`), JSON with the web defaults (lowercase field names). The masters in `authoring/langs/dotnet/hello`: F2, F8, F9, F12 (`Workflow.Patched`), F10 (`ExecuteChildWorkflowAsync`, legs joined with `Workflow.WhenAllAsync`), F11, F14 and F13 (`WorkflowReplayer`).
  - `./hello` as in Java: builds (quietly, unless it fails), then runs `Hello.dll`.
  - A one-line log (`ConsoleLog`), with the SDK core's own log at errors only.
  - The worker handles SIGTERM itself (`PosixSignalRegistration`), so it shuts down properly. Without it, the process ended at once, Temporal kept sending the workflow to the dead worker for a while, and a restart looked like a hang (found by FC2's recording).
- **Checks:** the 22 pass in C#; `tests/histories/dotnet/`.
- **Text, challenges:** as Java's. FC2's clock choice reads `DateTime.UtcNow`, and falls back to 0 after the restart, as in Java, with its own explanation. FC1–FC3 recorded, every choice as flagged.
- **Snapshot:** `course/snapshot/languages/dotnet.Dockerfile`: the .NET 10.0.404 SDK, culture-invariant (the slim base image has no ICU, and `dotnet` aborts without it), packages in `/opt/nuget`, the hello built once, csharp-ls 0.28.0 (0.29.0 is broken, ticket 02) behind the same stdio bridge as TypeScript's, on port 2089. 2 GiB.
- **Editor:** a C# language-server client (`createLsp({ language: "dotnet" })`, LSP language id `csharp`), relayed at `/api/lsp?lang=dotnet`.
- **e2e, against Daytona, one walkthrough at a time (2026-11-23):** Hello Temporal and Building blocks pass in Python, TypeScript, Java and C#, every step ending with ✓ Check; and both language switches: Java to Python keeps the sandbox (its terminals move to /workshop), Java to C# swaps it for a C# one without asking.
