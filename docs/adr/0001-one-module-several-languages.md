# 0001 · One module, several languages

Status: accepted (2026-11-22)
Context: [.scratch/multi-language/spec.md](../../.scratch/multi-language/spec.md)

## Decision

Fundamentals comes in Python, TypeScript, Java and .NET as **one module with several languages**, not a branch per language. F2 keeps one id, map node, XP, set of badges and `requires` whatever the language.

- A module stays one `module.md`. Text that names an API goes in `<!-- lang <id> -->…<!-- /lang -->` blocks. Fences one after another in different languages are one snippet with variants. Fields that differ (`files`, `hint`, `tour`, `worker`, `questions`) go under `langs:`.
- A branch lists its `languages:`, and the build fails when a module is missing a variant.
- A pass counts for the module whatever the language. The pass event records `lang`, and a Polyglot badge rewards passing the same module in two.

## Why

The concepts are identical across SDKs: only the syntax changes. A branch per language would split the map, paths, badges and boss, and copying a module per language (`module.ts.md`) would let the shared prose drift between copies.

## Consequences

- GitHub shows every language's blocks one after another.
- A module edit can touch up to four snippets, and the build reports a language that's been left behind.
