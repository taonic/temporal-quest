# 04 · Language in the content model (Python only)

Status: resolved

Spec: [../spec.md](../spec.md) (D2, D7)

## What

- `quests/`: `languages:` on a branch, `<!-- lang x -->` blocks, `langs:` frontmatter, and fence runs as snippet variants. Document them in `quests/README.md`.
- `scripts/quests.py`, `render.py`, `quest.py`: masters under `authoring/langs/<lang>/`, `.ts`, `.java` and `.cs` suffixes, and `./quest lang <x>`.
- `course/content/build.mjs`: emit each module per language. Take `SNIPPET_FILES`, the worker command and the starter command from content rather than from regexes. Fail on a missing variant.
- `verify_modules.py`: loop over languages.

## Done when

Fundamentals declares `languages: [python]`. The site, `./quest` and every test behave exactly as before, and the build fails on a test fixture that's missing a variant.

## Answer

Done on 2026-11-22. Python is still the only language. The site's generated content is identical to before, apart from three new keys: `languages` on each exercise and branch, and Fundamentals' `starter`.

- **Content.** Fundamentals' `branch.md` declares `languages: [python]` and `starter: uv run hello-start`. [quests/README.md](../../../quests/README.md#languages) documents `languages:`, branch and module `langs:`, `<!-- lang x -->` blocks, and snippets in several languages.
- **`course/content/build.mjs`:**
  - `applyLanguage` gives a module's text in one language. `checkLanguageText`, `checkBranchLanguages` and `checkModuleLanguages` fail the build on a missing variant, a language block for a language the branch doesn't have, a heading in a language block, or a missing `langs:` entry.
  - Each exercise is built per language: today's fields are the default language's, plus `languages`, and `byLang` (worker, files, tour, tourAfter, questions, modes) when there's more than one.
  - The worker and starter commands come from the branches, not regexes.
  - `SNIPPET_FILES` and the highlighter know `.ts`, `.java` and `.cs`.
  - A challenge in a branch with several languages fails the build until ticket 07.
- **Scripts:**
  - `quests.py` reads `languages` and `langs`, and gains `language_of(path)`, `Module.language()`, `worker_in()` and `hint_in()`.
  - `render.py` renders `.ts`, `.java` and `.cs` masters.
  - `./quest lang [x]` is kept in `.course/lang`. `enter`, `solve`, `reset`, `catch-up` and `status` work on the learner's language's files (Python where a branch doesn't have it), and `check` sets `QUEST_LANG`.
  - `verify_modules.py` checks each module in each of its branch's languages.
- **Tests.** Four new course tests cover the language rules, including the build failing on a snippet with no TypeScript version: 186 pass. `verify_modules.py` passes, and so does the contract test.

Left for later: Ask Temporal still reads each module's raw text (all its languages), which is ticket 05. Concept detection still looks only at Python snippets.
