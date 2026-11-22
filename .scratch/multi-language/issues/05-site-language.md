# 05 · Language on the site

Status: resolved
Blocked by: 04
Spec: [../spec.md](../spec.md) (Sandboxes and site)

## What

- **The language question.** It comes right after the Developer persona ("Which language do you build in?"), can be changed from the top bar any time, and is saved on the server with progress. A cohort can set a default, and `?lang=` sets it in a link. A language stays hidden until it has at least one whole tier.
- **The guide follows the learner's language,** and so do Insert, the code tour and file tabs. A tier that the language doesn't have yet shows in Python, tagged "Python", and so does the AI Agent branch.
- **Ids and labels.** `python`, `typescript`, `java`, `dotnet` are shown as "Python", "TypeScript", "Java", "C# (.NET)".
- **The editor.** CodeMirror modes for TypeScript, Java and C#.
- **Commands from content.** The worker toggle and the trip button take their commands from the branch's `langs:`.
- **Progress.** The pass event records `lang`, and admin journeys show it.
- **The Polyglot skill badge.** It goes to a learner who passes the same code module in two languages. Add it to `badges.yaml`, with a rule in `badges.js` and art in `badgeArt.js`.
- **Ask Temporal.** `helper.mjs` tells it the learner's language.

## Done when

It works with a fake second language in the unit tests. Python learners see no change, since the picker stays hidden until a second language has a tier.

## Answer

Done on 2026-11-22. With only Python on offer, learners see no change: no question, no menu item, no tags, no Polyglot badge. The site loads headless with no runtime errors, and `?lang=typescript` does nothing yet.

- **Shipping a tier at a time.** A module or challenge can narrow its branch's languages (`languages: [python]`), in the build, `quests.py` and `challenges.py`. `course.languages` lists only those with a whole tier of a branch (`offeredLanguages`).
- **The page.** [web/src/language.js](../../../course/web/src/language.js) gives the course in the learner's language: each exercise with its `byLang` merged in (files, guide, tour, challenges, worker and starter) and `language` set, and Polyglot hidden until there's a second language. The language comes from `?lang=`, then the browser, the server, the cohort, and finally Python.
  - **Choosing.** `LanguageChoice.vue` asks right after the Developer persona, and the account menu has "Building in: … · switch". `chooseLanguage` keeps it, records `language_set`, and reloads. Sign-in syncs it both ways.
  - **Editor.** CodeMirror modes for `.ts` (2-space indent), `.java` and `.cs`.
  - **Commands.** The trip button and starter use the exercise's `starter`, the restart after catch-up uses the exercise's worker, and a worker ▶ matches the running worker's command (the runner's `command`, or `uv run <name>`).
  - **Tags.** The map card says "· in Python" and the guide's header says "in Python" when the module isn't in the learner's language.
  - **Ask Temporal** gets `language`, and the prompt names the learner's SDK.
- **The runner:**
  - A migration adds `cohorts.language`; the cohort form has it once there's a choice.
  - `language_set` is checked against the languages on offer. Progress has `language` (theirs, then the cohort's) and `passedIn`.
  - Polyglot (`badges.yaml`, `badges.js`'s `polyglot` rule, with the `brackets` icon) goes to a module with a code check passed in two languages. A pass in a new language records `module_passed` with its `lang`, with no XP the second time.
  - Admin learner rows, the CSV and journeys show the language, each pass's languages and each switch.
  - Assignments for Ask Temporal are per language (`byLang`).
- **Tests.** [course/tests/languages.test.mjs](../../../course/tests/languages.test.mjs) runs a fake second language through: exercises in it and the fallback, Polyglot shown only with a choice, `?lang=`, a language offered only with a whole tier, the Polyglot rule, the server's language, `passedIn` and the cohort default, and Ask Temporal's prompt. 194 course tests pass.

Not done here: the runner's worker detection and its trip-starter detection are still `pgrep` for Python's commands (ticket 08), and the picker hasn't been seen with a real second language, since there isn't one yet (ticket 09).
