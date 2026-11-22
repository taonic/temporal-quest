# 01 · Settle the decisions

Status: resolved
Type: grilling
Spec: [../spec.md](../spec.md) (Decisions)

## What

Say yes or no to D1–D11 and the open questions, and record the ones that hold up as ADRs.

## Answer

Settled with Tao on 2026-11-22, in three rounds. Every recommendation was accepted except the reviewer gate:

- **Round 1.** Fundamentals only, with AI Agent Python-only for good. One module, several languages. One wire contract. TypeScript, then Java, then .NET. Python stays put and the others go under `langs/<lang>/`. One snapshot per language. Histories per language.
- **Round 2.** Language blocks in one `module.md` (GitHub showing all of them is fine). One black-box Python test suite. Python challenge scenarios with a split worker. A language picker after the persona, with languages hidden until they have a whole tier. `pace`, `remaining` and `waiting` replace the multi-word fields. A starter per language. Ship by tier, with Python as the fallback. A pass counts in every language, plus a Polyglot badge. A TypeScript language server, with Java's and C#'s decided after 02. e2e: Python on deploy, every language nightly.
- **Round 3.** Node 24, JDK 21 and .NET 10. Gradle, revisited after 02. Ids `python`, `typescript`, `java`, `dotnet`. 4 GiB for a language that doesn't fit in 2. Checks at most 15 s warm and 45 s on a first run. **No fluent-reviewer gate:** a tier ships when `verify_modules.py` and e2e pass. Three ADRs.

The spec now states each decision. ADRs: [0001](../../../docs/adr/0001-one-module-several-languages.md), [0002](../../../docs/adr/0002-one-wire-contract-python-checks.md), [0003](../../../docs/adr/0003-one-snapshot-per-language.md).
