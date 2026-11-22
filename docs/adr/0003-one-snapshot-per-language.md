# 0003 · One sandbox snapshot per language

Status: accepted (2026-11-22)
Context: [.scratch/multi-language/spec.md](../../.scratch/multi-language/spec.md)

## Decision

Each language gets its own Daytona snapshot: the Python base (the stack, Dogwood, the dev server) plus that one toolchain (Node 24, JDK 21 with Gradle, or .NET 10), with dependencies prefetched and a warm build. A learner's sandbox starts from their language's snapshot, and changing language offers a new sandbox.

If a language doesn't fit in 2 GiB next to `travel-stack`, its snapshot gets 4 GiB. A check takes at most 15 s on a warm build and 45 s on a first run.

Measured on 2026-11-22: all three languages' checks fit in 2 GiB. Java gets no language server (jdtls alone nearly filled 2 GiB and needs Java 25), .NET gets csharp-ls, and TypeScript gets typescript-language-server, either with its memory capped or at 4 GiB.

## Why

One image with every toolchain would be much larger, would need a rebuild whenever any toolchain changed, and wouldn't help the memory each worker needs while running. Keeping the Python base in every image lets a tier that a language doesn't have yet fall back to Python in the same sandbox.

## Consequences

- Each new or changed toolchain is a snapshot rebuild.
- Raising memory for one language raises the cost of sandboxes for that language's learners only. A lighter stack (Temporal and the console at boot, the rest on demand) is the later optimization.
