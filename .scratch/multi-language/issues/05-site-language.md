# 05 · Language on the site

Status: ready-for-agent
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
