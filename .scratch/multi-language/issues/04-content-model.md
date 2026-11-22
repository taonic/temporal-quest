# 04 · Language in the content model (Python only)

Status: ready-for-agent

Spec: [../spec.md](../spec.md) (D2, D7)

## What

- `quests/`: `languages:` on a branch, `<!-- lang x -->` blocks, `langs:` frontmatter, and fence runs as snippet variants. Document them in `quests/README.md`.
- `scripts/quests.py`, `render.py`, `quest.py`: masters under `authoring/langs/<lang>/`, `.ts`, `.java` and `.cs` suffixes, and `./quest lang <x>`.
- `course/content/build.mjs`: emit each module per language. Take `SNIPPET_FILES`, the worker command and the starter command from content rather than from regexes. Fail on a missing variant.
- `verify_modules.py`: loop over languages.

## Done when

Fundamentals declares `languages: [python]`. The site, `./quest` and every test behave exactly as before, and the build fails on a test fixture that's missing a variant.
