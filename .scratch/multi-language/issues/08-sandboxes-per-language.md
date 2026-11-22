# 08 · A sandbox for each language

Status: ready-for-agent
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
