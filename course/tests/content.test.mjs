import assert from "node:assert/strict";
import { test } from "node:test";

import { applyMode, buildCourse, parseFrontmatter, sectionKind, snippetCommands, splitSections } from "../content/build.mjs";

test("a browser block shows only in the browser, a local block only locally", () => {
  const md = "Before.\n<!-- browser\nIn the browser.\n-->\n<!-- local -->\nOn your machine.\n<!-- /local -->\nAfter.\n";
  assert.equal(applyMode(md, "browser"), "Before.\nIn the browser.\nAfter.\n");
  assert.equal(applyMode(md, "local"), "Before.\nOn your machine.\nAfter.\n");
});

test("an inline browser block joins its line", () => {
  const md = "Stop it and start it again<!-- browser\n (or click Restart)\n-->. Then wait.\n";
  assert.equal(applyMode(md, "browser"), "Stop it and start it again (or click Restart). Then wait.\n");
  assert.equal(applyMode(md, "local"), "Stop it and start it again. Then wait.\n");
});

test("frontmatter is parsed and removed", () => {
  const { meta, body } = parseFrontmatter('---\ntitle: "1 · Hello"\ntimelimit: 2100\n---\n\n# Hello\n');
  assert.deepEqual(meta, { title: "1 · Hello", timelimit: 2100 });
  assert.equal(body, "\n# Hello\n");
});

test("sections split at level-2 headings, not inside code fences", () => {
  const { preamble, sections } = splitSections("# Title\nIntro.\n## 1. One\n```\n## not a heading\n```\n## Check\nRun it.");
  assert.equal(preamble, "Intro.");
  assert.deepEqual(sections.map((s) => s.title), ["1. One", "Check"]);
  assert.deepEqual(["1. One", "Check", "Stretch (not graded)", "The pieces"].map(sectionKind), ["step", "check", "stretch", "plain"]);
});

test("snippet commands drop comments and join continuations", () => {
  const code = "# a comment\nuv run travel-stack up   # start it\n\ntemporal workflow update execute --workflow-id x \\\n  --input '{}'\n";
  assert.deepEqual(snippetCommands(code), ["uv run travel-stack up", "temporal workflow update execute --workflow-id x --input '{}'"]);
});

test("the built course covers every exercise in both modes", () => {
  const course = buildCourse();
  assert.equal(course.exercises.length, 7);
  for (const exercise of course.exercises) {
    for (const mode of ["browser", "local"]) {
      const html = [exercise.modes[mode].intro, ...exercise.modes[mode].sections.map((s) => s.html)].join("\n");
      assert.ok(!/<!--\s*(browser|local|\/local)/.test(html), `${exercise.id} ${mode} still has a mode marker`);
      if (mode === "local") assert.ok(!html.includes("data-pane"), `${exercise.id}: local links must stay links`);
    }
    // The Trip board's exercises have no code to edit.
    if (exercise.layout === "board") continue;
    assert.ok(exercise.files.some((f) => f.editable), `${exercise.id} has no editable file`);
    for (const file of exercise.files.filter((f) => f.editable && !f.scratch)) {
      assert.ok(file.solution, `${exercise.id}: ${file.path} has no solution`);
      assert.notEqual(file.starter, file.solution, `${exercise.id}: ${file.path} starter equals its solution`);
    }
  }
});

test("an update link is a button that fills in Send an Update, and words locally", () => {
  const blocks = buildCourse().exercises.find((e) => e.modules.includes("F14"));
  const browser = blocks.modes.browser.sections.map((s) => s.html).join("\n");
  assert.match(
    browser,
    /<button class="workflow-link" type="button" data-workflow-open="book-sfo-jfk-" data-workflow-update="new_card" data-update-input="\{&quot;card&quot;:&quot;1111&quot;\}"[^>]*>Send it the same card<\/button>/,
  );
  assert.match(browser, /data-workflow-update="new_card" data-update-input="\{&quot;card&quot;:&quot;4242&quot;\}"/);
  const local = blocks.modes.local.sections.map((s) => s.html).join("\n");
  assert.ok(!local.includes("data-workflow-update"), "no update buttons locally");
  assert.match(local, /<strong>More Actions<\/strong>, then <strong>Send an Update<\/strong>/);
});

test("in the browser, localhost links open panes and command snippets get a run button", () => {
  const hello = buildCourse().exercises[0];
  const html = hello.modes.browser.sections.map((s) => s.html).join("\n");
  assert.match(html, /data-pane="temporal"/);
  assert.match(html, /data-run="\[&quot;uv run hello-worker&quot;\]" data-target="worker"/);
  // A trip's button stands alone: the command beside it would only repeat it.
  assert.match(html, /<div class="trip-run"><span class="trip-toggle" data-trip="SFO JFK"[^>]*>.*?<\/span><\/span><\/div>/);
  assert.ok(!html.includes("trip-cmd") && !html.includes("<code>uv run hello-start"), "no hello-start command beside its button");
  // "Open the link" opens that trip's workflow.
  assert.match(html, /<button class="workflow-link" type="button" data-workflow-open="hello-sfo-jfk-"/);
  // Step 0 starts the sandbox; the plain worker command block after "start the worker" is gone.
  assert.match(html, /<button class="sandbox-start" type="button" data-sandbox-start>Start my sandbox<\/button>/);
  assert.ok(!/<code>uv run hello-worker\n<\/code>/.test(html), "no plain worker block beside the toggle");
  assert.match(html, /In one terminal, start the worker<button class="worker-toggle"[^>]*>[\s\S]*?<\/button> and leave it running\./);
  assert.match(html, /<code>FLAKY=1 uv run hello-worker\n<\/code>/);
  assert.match(html, /data-run="\[&quot;FLAKY=1 uv run hello-worker&quot;\]" data-target="worker"/);
  assert.match(html, /class="file-ref" data-file="hello\/workflow.py"/);
  const local = hello.modes.local.sections.map((s) => s.html).join("\n");
  assert.ok(!local.includes("data-run"), "local snippets only copy");
});

test("a master's TODO blocks are the exact starter and solution lines for its modules", async () => {
  const { todoBlocks } = await import("../content/build.mjs");
  const master = "a\n    # @@solution A4\n    return 2\n    # @@starter\n    # TODO(ch02)\n    raise X\n    # @@end\n    # @@solution N2\n    three\n    # @@starter\n    todo3\n    # @@end\nb";
  assert.deepEqual(todoBlocks(master, ["A4"]), [{ starter: "    # TODO(ch02)\n    raise X\n", solution: "    return 2\n" }]);
  assert.deepEqual(todoBlocks(master, ["F2"]), []);
  assert.equal(todoBlocks(master, ["A4", "N2"]).length, 2);
  // Two in one file: each its own block.
  const two = "# @@solution A1\nA = 1\n# @@starter\nA = 0\n# @@end\nx\n# @@solution A1\nB = 1\n# @@starter\nB = 0\n# @@end\n";
  assert.deepEqual(todoBlocks(two, ["A1"]), [{ starter: "A = 0\n", solution: "A = 1\n" }, { starter: "B = 0\n", solution: "B = 1\n" }]);
});

test("a master renders with some modules' TODOs solved and the rest open, as render.py does", async () => {
  const { renderMaster } = await import("../content/build.mjs");
  const master = "a\n# @@solution N2\nask()\n# @@starter\nTODO ask\n# @@end\n# @@solution N3\nreserve()\n# @@starter\nTODO reserve\n# @@end\nb\n";
  assert.equal(renderMaster(master, []), "a\nTODO ask\nTODO reserve\nb\n");
  assert.equal(renderMaster(master, ["N2"]), "a\nask()\nTODO reserve\nb\n");
  assert.equal(renderMaster(master, ["N2", "N3"]), "a\nask()\nreserve()\nb\n");
});

test("the quests: every module where its branch says, and every module it builds on before it", async () => {
  const { closure, loadQuests } = await import("../content/build.mjs");
  const quests = loadQuests();
  const course = buildCourse();
  assert.deepEqual(course.branches.map((b) => b.id), ["essentials", "fundamentals", "ai-agent", "nexus", "payments", "ai-sdlc", "worker-ops"]);
  for (const branch of course.branches) {
    assert.ok(branch.name && branch.icon && branch.classTitle && branch.tiers?.length, `${branch.id} needs a name, icon, class title and tiers`);
    for (const id of branch.modules) {
      const module = course.modules.find((m) => m.id === id);
      assert.equal(module.branch, branch.id);
      assert.ok(module.tier >= 1 && module.tier <= branch.tiers.length, `${id}: tier ${module.tier} isn't one of ${branch.id}'s`);
    }
  }
  // N2 builds on the travel agent up to its working tools, not on approval.
  assert.deepEqual(closure(quests.modules, ["N2"]), ["A2", "A3", "A4", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "N1"]);
  assert.ok(!closure(quests.modules, ["A12"]).some((id) => id.startsWith("N")), "auto mode doesn't need Nexus");
  // The 4-hour path is the five exercises, in order, each a run of ready modules.
  const path = course.paths.find((p) => p.id === "agent-governance-4h");
  assert.deepEqual(path.modules, course.exercises.slice(0, 5).flatMap((e) => e.modules));
  // 27 modules, and the trunk's first two challenges (FC1 after F5, FC2 after F7).
  assert.equal(path.modules.length, 29);
  assert.deepEqual(path.modules.slice(0, 9), ["F1", "F2", "F3", "F4", "F5", "FC1", "F6", "F7", "FC2"]);
  for (const id of path.modules) assert.equal(course.modules.find((m) => m.id === id).status, "ready");
  assert.ok(course.modules.filter((m) => m.status === "coming-soon").length >= 9);
  // The trunk is whole: every Fundamentals module ready, its second tier the sixth exercise.
  const trunk = course.paths.find((p) => p.id === "fundamentals");
  assert.deepEqual(trunk.modules, course.branches.find((b) => b.id === "fundamentals").modules);
  for (const id of trunk.modules) assert.equal(course.modules.find((m) => m.id === id).status, "ready", `${id} isn't ready`);
  assert.deepEqual(course.exercises[5].modules, ["F8", "F9", "F10", "F11", "F14", "F12", "FC3", "F13"]);
});

test("every exercise's TODO block is in its starter, and its snippet replaces it", async () => {
  const { insertMode } = await import("../content/build.mjs");
  for (const exercise of buildCourse().exercises) {
    for (const file of exercise.files) {
      for (const todo of file.todos) {
        assert.ok(file.starter.includes(todo.starter), `${exercise.id}: a TODO block isn't in the starter of ${file.path}`);
        assert.ok(file.solution.includes(todo.solution), `${exercise.id}: a solution block isn't in the solution of ${file.path}`);
      }
      if (!file.todos.length) continue;
      const html = exercise.modes.browser.sections.map((s) => s.html).join("\n");
      assert.match(html, new RegExp(`data-insert="${file.path}" data-insert-mode="todo"`), `${exercise.id}: no snippet replaces the TODO`);
    }
  }
  assert.equal(insertMode("permit (x);", [{ solution: "forbid (y);" }], "policies/travel.dw"), "append");
  assert.equal(insertMode("x = 1", null, "a.py"), "cursor");
  const policy = 'permit (a);\n\n// why\n@id("hotels")\nforbid (x)\nunless {\n  y\n};\n';
  assert.equal(insertMode('@id("hotels")\n@decision("escalate")\nforbid (x);', null, "policies/travel.dw", policy), "replace");
  assert.equal(insertMode('@id("new-rule")\nforbid (z);', null, "policies/travel.dw", policy), "append");
  assert.equal(insertMode("return f(a)  # why", [{ solution: "    # because\n    return f(a)\n" }], "a.py"), "todo");
});

test("local pages have no insert buttons", () => {
  for (const exercise of buildCourse().exercises) {
    const html = exercise.modes.local.sections.map((s) => s.html).join("\n");
    assert.ok(!html.includes("data-insert"), exercise.id);
  }
});

test("in the browser, every mention of stopping or starting the worker gets the toggle, except in headings", () => {
  const hello = buildCourse().exercises[0];
  const html = hello.modes.browser.sections.map((s) => s.html).join("\n");
  const toggles = html.match(/data-worker-toggle/g) ?? [];
  assert.ok(toggles.length >= 5, `only ${toggles.length} toggles`);
  assert.match(html, /[Ss]top the worker \(Ctrl-C\)<button class="worker-toggle"/);
  assert.doesNotMatch(html, /<h2>[^<]*<button class="worker-toggle"/);
  const local = hello.modes.local.sections.map((s) => s.html).join("\n");
  assert.ok(!local.includes("data-worker-toggle"), "local pages have no toggles");
});

test("in the browser, a quoted message for the agent is a send button; locally it stays a quote", () => {
  const session = buildCourse().exercises.find((e) => e.id.startsWith("02"));
  const html = session.modes.browser.sections.map((s) => s.html).join("\n");
  assert.match(html, /<button class="agent-prompt" type="button" data-send="I need a flight from SFO to JFK next month\."/);
  assert.ok(!html.includes("<blockquote>"), "no quotes left in the browser");
  const local = session.modes.local.sections.map((s) => s.html).join("\n");
  assert.ok(!local.includes("data-send"), "local pages have no send buttons");
  assert.match(local, /<blockquote>\s*<p>I need a flight from SFO to JFK next month\.<\/p>/);
});

test("after \"restart the worker\" comes a restart button, except with something to set (FLAKY=1)", () => {
  const exercises = buildCourse().exercises;
  const hello = exercises[0].modes.browser.sections.map((s) => s.html).join("\n");
  const session = exercises[1].modes.browser.sections.map((s) => s.html).join("\n");
  assert.match(session, /Restart the worker<button class="worker-toggle" type="button" data-worker-toggle data-worker-restart>/);
  assert.match(hello, /Restart the worker<button class="worker-toggle" type="button" data-worker-toggle>[\s\S]*? with <code/);
  assert.match(hello, /[Ss]top the worker \(Ctrl-C\)<button class="worker-toggle" type="button" data-worker-toggle>/);
});

test("in the browser, every new session the instructions ask for is a button with its posture", () => {
  const exercises = buildCourse().exercises;
  const all = (mode) => exercises.map((e) => e.modes[mode].sections.map((s) => s.html).join("\n")).join("\n");
  const postures = [...all("browser").matchAll(/data-new-session="Travel agent" data-posture="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(postures, ["dangerously_skip_all", "dangerously_skip_all", "human_approval_only", "approve_bookings", "auto_mode", "auto_mode"]);
  assert.ok(!all("local").includes("data-new-session"), "local pages have no session buttons");
  assert.match(all("local"), /Then start a new <strong>Travel agent<\/strong> session\. The start form/);
});

test("in the browser, the Agent UI comes with a tour, from a button; locally, from its URL", () => {
  const session = buildCourse().exercises.find((e) => e.id.startsWith("02"));
  const html = session.modes.browser.sections.map((s) => s.html).join("\n");
  assert.match(html, /<button class="pane-button" type="button" data-agent-tour>✦ Take a tour of the Agent UI<\/button>/);
  assert.ok(!html.includes("localhost:8000"), "no localhost URL in the browser");
  const local = session.modes.local.sections.map((s) => s.html).join("\n");
  assert.match(local, /Open it at <a href="http:\/\/localhost:8000"/);
  assert.ok(!local.includes("pane-button"), "no pane button locally");
});

test("an inserted snippet is found again, however it's indented, and not once it's edited", async () => {
  const { findSnippet, indentLines, dedent } = await import("../web/src/snippets.js");
  const code = "# why\nreturn f(\n    a,\n)\n";
  const file = `def g():\n${indentLines(dedent(code), "    ")}\n\nmore\n`;
  const found = findSnippet(file, code);
  assert.ok(found);
  assert.equal(file.slice(found.start, found.end), "    # why\n    return f(\n        a,\n    )");
  assert.equal(findSnippet(file.replace("a,", "b,"), code), null);
  assert.equal(findSnippet("", code), null);
});

test("every insertable snippet explains itself with comments, and still replaces its TODO", () => {
  for (const exercise of buildCourse().exercises) {
    const html = exercise.modes.browser.sections.map((s) => s.html).join("\n");
    for (const m of html.matchAll(/data-insert-mode="(\w+)"[\s\S]*?<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)) {
      const code = m[2].replace(/<[^>]+>/g, "");
      assert.match(code, /(^|\n)\s*(#|\/\/) |\s(#|\/\/) /, `${exercise.id}: a snippet without comments`);
    }
  }
});

test("in the browser, a command in prose gets a run button; a command with a placeholder doesn't", async () => {
  const { isInlineCommand } = await import("../content/build.mjs");
  assert.ok(isInlineCommand("uv run hello-start SEA LHR"));
  assert.ok(isInlineCommand("FLAKY=1 uv run hello-worker"));
  assert.ok(!isInlineCommand("temporal workflow show -w <workflow-id>"));
  assert.ok(!isInlineCommand("hello/workflow.py"));
  assert.ok(!isInlineCommand("temporal { … }")); // a policy's temporal block, not the CLI
  const hello = buildCourse().exercises[0];
  const html = hello.modes.browser.sections.map((s) => s.html).join("\n");
  assert.match(html, /Start a trip: <span class="trip-toggle" data-trip="SEA LHR"/);
  assert.match(html, /<code>FLAKY=1 uv run hello-worker<\/code><button class="cmd-run"|data-run="\[&quot;FLAKY=1 uv run hello-worker&quot;\]"/);
  assert.ok(!hello.modes.local.sections.map((s) => s.html).join("\n").includes("cmd-run"));
});

test("in the browser, \"Temporal UI\" in prose opens the pane; not in headings or locally", () => {
  const hello = buildCourse().exercises[0];
  const html = hello.modes.browser.sections.map((s) => s.html).join("\n") + hello.modes.browser.intro;
  assert.match(html, /open the <strong><a href="#" class="pane-ref" data-pane="temporal" data-path="\/"[^>]*>Temporal UI<\/a><\/strong>/);
  assert.match(html, /the two terminals and the <a href="#" class="pane-ref" data-pane="temporal"[^>]*>Temporal UI<\/a> on the left/);
  // A workflow to look at is a link to it, on the tab the step needs.
  assert.match(html, /data-workflow-open="hello-lax-ord-" data-workflow-tab="pending-activities"/);
  assert.match(html, /data-workflow-open="board-sfo-jfk-" data-workflow-tab="query"/);
  // ...never "open the workflow in the UI" and leave the learner to find it.
  for (const exercise of buildCourse().exercises) {
    const text = exercise.modes.browser.sections.map((s) => s.html).join("\n").replace(/<[^>]+>/g, "");
    assert.ok(!/open the (?:workflow|session|`?board)[^.:]{0,40} in the (?:Temporal )?UI/i.test(text), `${exercise.id}: a workflow to find by hand`);
  }
  assert.doesNotMatch(html, /<h\d[^>]*>[^<]*<a [^>]*pane-ref/);
  const local = hello.modes.local.sections.map((s) => s.html).join("\n");
  assert.ok(!local.includes("pane-ref"));
});

test("every exercise has a code tour, and every stop is found in its file, in a chunk that fits", async () => {
  const { tourRange } = await import("../web/src/tourRange.js");
  for (const exercise of buildCourse().exercises.filter((e) => e.layout === "code")) {
    assert.ok(exercise.tour.length >= 3, `${exercise.id} has a code tour`);
    for (const stop of exercise.tour) {
      const file = exercise.files.find((f) => f.path === stop.file);
      const range = tourRange(file.starter, stop);
      assert.ok(range && range.end - range.start < 30, `${exercise.id}: ${stop.title} is ${range ? range.end - range.start + 1 : "no"} lines`);
      assert.ok(stop.html && !stop.html.includes("<p>"), `${stop.title} is inline Markdown`);
    }
  }
});

test("a tour stop takes its block, or runs to the next blank line, and follows edits", async () => {
  const { tourRange } = await import("../web/src/tourRange.js");
  const py = ["x = 1", "", "@decorator", "async def f(a):", "    one", "", "    two", "", "def g():", "    pass"].join("\n");
  assert.deepEqual(tourRange(py, { from: "@decorator" }), { start: 3, end: 7 });
  assert.deepEqual(tourRange(py, { from: "x = 1" }), { start: 1, end: 1 });
  assert.deepEqual(tourRange(py, { from: "async def f", to: "one" }), { start: 4, end: 5 });
  // A learner's edit took the `to` line away: the block instead, unless strict.
  assert.deepEqual(tourRange(py, { from: "async def f", to: "raise" }), { start: 4, end: 7 });
  assert.equal(tourRange(py, { from: "async def f", to: "raise" }, { strict: true }), null);
  assert.equal(tourRange(py, { from: "nowhere" }), null);
  const cedar = ['@id("a")', "permit (", "  x", ");", "", '@id("b")'].join("\n");
  assert.deepEqual(tourRange(cedar, { from: '@id("a")' }), { start: 1, end: 4 });
});

test("a policy rule is found by its @id, with the comments right above it, through its `};`", async () => {
  const { ruleBlock, ruleId } = await import("../web/src/snippets.js");
  const text = 'permit (a);\n\n// why\n@id("hotels")\nforbid (x)\nunless {\n  y\n};\n\n@id("other")\nforbid (z);\n';
  assert.equal(ruleId('// c\n@id("hotels")\nforbid (x);'), "hotels");
  const block = ruleBlock(text, "hotels");
  assert.equal(text.slice(block.start, block.end), '// why\n@id("hotels")\nforbid (x)\nunless {\n  y\n};');
  assert.equal(ruleBlock(text, "missing"), null);
});

test("a link to a section names one of its exercise's sections", () => {
  for (const exercise of buildCourse().exercises) {
    for (const mode of ["browser", "local"]) {
      const page = exercise.modes[mode];
      const ids = new Set(page.sections.map((s) => s.id));
      for (const html of [page.intro, ...page.sections.map((s) => s.html)]) {
        for (const [, id] of html.matchAll(/href="#([^"/]+)"/g)) {
          assert.ok(ids.has(id), `${exercise.id} (${mode}) links to #${id}, which isn't one of its sections: was the heading renamed?`);
        }
      }
    }
  }
});

test("a challenge is a beat of its exercise, after its module, with one right choice and a recording of each", () => {
  const course = buildCourse();
  const challenges = course.modules.filter((m) => m.kind === "challenge");
  assert.deepEqual(challenges.map((c) => c.id), ["EC1", "EC2", "EC3", "FC1", "FC2", "FC3"]);
  for (const c of challenges) {
    const exercise = course.exercises.find((e) => e.id === c.exercise);
    const data = exercise.challenges[c.id];
    assert.ok(data, `${c.id}: no data in ${exercise.id}`);
    assert.equal(data.choices.filter((x) => x.right).length, 1, `${c.id}: one right choice`);
    // Essentials' are question challenges: plain answers, nothing to run, nothing recorded.
    assert.equal(data.question, c.id.startsWith("EC"), `${c.id}: a question challenge only in Essentials`);
    for (const choice of data.choices) {
      if (data.question) {
        assert.equal(choice.code, "", `${c.id} ${choice.id}: a plain answer has no code`);
        assert.equal(choice.recording, null);
        continue;
      }
      assert.ok(choice.recording.lines.length, `${c.id} ${choice.id}: an empty recording`);
      assert.equal(choice.recording.done.right, choice.right, `${c.id} ${choice.id}: its recording disagrees with its flag`);
    }
    // In both modes, the challenge's beat comes right after its module's last beat.
    for (const mode of ["browser", "local"]) {
      const sections = exercise.modes[mode].sections;
      const at = sections.findIndex((s) => s.challenge === c.id);
      assert.ok(at > 0 && sections[at].kind === "challenge", `${c.id}: no challenge beat in ${mode}`);
      assert.ok(exercise.moduleBeats[c.after].includes(sections[at - 1].id), `${c.id}: not right after ${c.after}`);
    }
    assert.deepEqual(exercise.moduleBeats[c.id], [exercise.modes.browser.sections.find((s) => s.challenge === c.id).id]);
    assert.equal(exercise.modules[exercise.modules.indexOf(c.after) + 1], c.id);
  }
  // FC2 sits before exercise 1's check, not after it.
  const hello = course.exercises[0].modes.browser.sections;
  assert.equal(hello.at(-1).kind, "check");
  assert.equal(hello.at(-2).challenge, "FC2");
});

test("each persona sees its own branches, paths and badges, and what it sees builds only on what it sees", () => {
  const course = buildCourse();
  assert.deepEqual(course.personas.map((p) => p.id), ["developer", "essentials"]);
  const branchesOf = (persona) => course.branches.filter((b) => b.personas.includes(persona)).map((b) => b.id);
  assert.deepEqual(branchesOf("essentials"), ["essentials"]);
  assert.ok(!branchesOf("developer").includes("essentials"));
  assert.deepEqual(course.paths.find((p) => p.id === "essentials").personas, ["essentials"]);
  assert.deepEqual(course.paths.find((p) => p.id === "agent-governance-4h").personas, ["developer"]);
  const skills = (persona) => course.badges.filter((b) => b.kind === "skill" && b.personas.includes(persona)).map((b) => b.id);
  assert.deepEqual(skills("essentials"), ["clean-run", "flawless", "logbook-keeper", "fix-forward", "storm-rider", "night-owl", "crash-proof", "time-keeper", "signed-off", "clean-undo"]);
  assert.deepEqual(skills("developer"), ["clean-run", "no-peeking", "flawless", "explorer", "polyglot", "cross-team", "first-run", "history-reader", "retry-wrangler", "count-keeper", "seat-holder", "trip-planner", "second-chance", "safe-shipper", "session-starter", "tool-fixer", "code-mode", "approver", "light-touch", "patient-gate", "time-traveler", "good-neighbor", "steady-partner"]);
  const essentials = course.exercises.find((e) => e.id === "07-essentials");
  assert.equal(essentials.layout, "board");
  assert.deepEqual(essentials.personas, ["essentials"]);
  assert.deepEqual(essentials.scripts, {});
  assert.deepEqual(essentials.boards.E2, { twin: true, mistake: true, onShift: true, hold: false, approval: false, declined: false });
  assert.equal(essentials.boards.E4.onShift, false);
  // Every Essentials module has a world check and its question, on one of its own beats.
  assert.deepEqual(essentials.modules.filter((id) => !id.startsWith("EC")), ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"]);
  for (const id of ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"]) {
    const check = essentials.checks[id];
    assert.ok(check && essentials.moduleBeats[id].includes(check.beat), `${id}: a world check on one of its beats`);
    assert.equal(check.quiz.choices.filter((c) => c.right).length, 1, `${id}: one right answer`);
    assert.equal(course.modules.find((m) => m.id === id).check, "world");
  }
  // E8's check, and its challenge, come before the closing beat.
  const ids = essentials.modes.browser.sections.map((s) => s.id);
  assert.ok(ids.indexOf(essentials.checks.E8.beat) < ids.indexOf("challenge-the-card-says-no"));
  assert.ok(ids.indexOf("challenge-the-card-says-no") < ids.indexOf("spot-it-in-your-business"));
  assert.ok(course.exercises.filter((e) => e.id !== "07-essentials").every((e) => e.layout === "code"));
});

test("Essentials' answers give nothing away: the right one isn't always first, nor always the longest", () => {
  const course = buildCourse();
  const essentials = course.exercises.find((e) => e.id === "07-essentials");
  const text = (html) => html.replace(/<[^>]+>/g, "").replace(/&[a-z0-9#]+;/g, "x");
  const questions = [
    ...Object.entries(essentials.checks).map(([id, check]) => [id, check.quiz.choices, true]),
    ...Object.entries(essentials.challenges).map(([id, challenge]) => [id, challenge.choices, true]),
    // The boss shuffles its choices each fight (boss.js), so only their lengths matter.
    ...course.modules.find((m) => m.id === "E-boss").pool.map((q) => [q.id, q.choices, false]),
  ];
  const at = (choices) => choices.findIndex((c) => c.right);
  const longest = (choices) => {
    const lengths = choices.map((c) => text(c.label).length);
    return lengths[at(choices)] === Math.max(...lengths);
  };
  // Shown in the order written: no one place holds the right answer in more than half of them.
  const ordered = questions.filter(([, , fixed]) => fixed);
  for (const place of [0, 1, 2, 3]) {
    const there = ordered.filter(([, choices]) => at(choices) === place).map(([id]) => id);
    assert.ok(there.length <= ordered.length / 2, `the right answer is choice ${"ABCD"[place]} in ${there.join(", ")}: mix the order`);
  }
  const tells = questions.filter(([, choices]) => longest(choices)).map(([id]) => id);
  assert.ok(tells.length <= questions.length / 2, `the right answer is the longest in ${tells.join(", ")}: even out the lengths`);
});

test("in the browser, a #board link is the board's action button; anything else isn't an action", async () => {
  const essentials = buildCourse().exercises.find((e) => e.id === "07-essentials");
  const html = essentials.modes.browser.sections.map((s) => s.html).join("\n");
  assert.match(html, /<button class="board-action" type="button" data-board-action="start-trip">Start a trip<\/button>/);
  assert.match(html, /data-board-action="ship-fix"/);
  // #board/pull-plug/after-book_hotel waits for that step, and says so (its link's title).
  assert.match(html, /data-board-action="pull-plug" data-after="book_hotel" data-waiting="Pull the plug once the hotel is booked"/);
  // #latest-trip is a button that opens the board's latest trip, its own workflow, in the Temporal
  // UI: on its compact event history, or on the tab the link names.
  assert.match(html, /<button class="board-action is-open" type="button" data-board-trip data-workflow-tab="compact" title="[^"]+">Open the trip's logbook<\/button>/);
  assert.match(html, /data-board-trip data-workflow-tab="pending-activities"[^>]*>Open the stuck trip</);
  const local = essentials.modes.local.sections.map((s) => s.html).join("\n");
  assert.ok(!local.includes("data-board-action") && !local.includes("data-board-trip"));
});

test("a branch that shows no module ids can't name one in its copy, but may in its ids and links", async () => {
  const { checkUnnumbered, loadQuests } = await import("../content/build.mjs");
  const branch = { id: "essentials", modules: ["E1", "EC1"] };
  const module = (id, extra) => ({ id, kind: "module", source: `${id}.md`, requires: ["E1"], after: "E1", body: "Start a trip.", ...extra });
  const fine = new Map([["E1", module("E1")], ["EC1", module("EC1", { choices: [{ id: "A", explanation: "You'll see one at the end." }] })]]);
  assert.doesNotThrow(() => checkUnnumbered(branch, fine));
  const named = new Map([...fine, ["EC1", module("EC1", { choices: [{ id: "A", explanation: "You'll see one in E1." }] })]]);
  assert.throws(() => checkUnnumbered(branch, named), /EC1\.md: names E1/);
  const inBody = new Map([...fine, ["E1", module("E1", { body: "As in EC1, the card…" })]]);
  assert.throws(() => checkUnnumbered(branch, inBody), /E1\.md: names EC1/);
  // And Essentials' own copy names none.
  const quests = loadQuests();
  assert.equal(quests.branches.find((b) => b.id === "essentials").numbered, false);
});

test("a branch with maxWords keeps each guide message that short, counting the words a learner reads", async () => {
  const { checkWords, wordsIn, buildCourse: build } = await import("../content/build.mjs");
  assert.equal(wordsIn('<p>Start <strong>a trip</strong>, then <button class="board-action">Ship the fix</button>.</p>'), 7);
  const page = (words) => ({ intro: "<p>Hi.</p>", sections: [{ title: "Run a trip", html: `<p>${"word ".repeat(words)}</p>` }] });
  assert.doesNotThrow(() => checkWords(page(100), 100, "here"));
  assert.throws(() => checkWords(page(101), 100, "here"), /"Run a trip" is 101 words; its branch keeps each message to 100/);
  // Code isn't prose: a snippet or a code block doesn't count.
  const code = `<div class="snippet"><div class="snippet-actions"></div><pre><code>${"x ".repeat(300)}</code></pre></div><pre>${"y ".repeat(300)}</pre>`;
  assert.doesNotThrow(() => checkWords({ intro: "", sections: [{ title: "Code", html: `<p>${"word ".repeat(100)}</p>${code}` }] }, 100, "here"));
  // Essentials' own messages are all within it.
  const essentials = build().exercises.find((e) => e.id === "07-essentials").modes.browser;
  assert.ok([essentials.intro, ...essentials.sections.map((s) => s.html)].every((html) => wordsIn(html) <= 100));
  // Fundamentals keeps each step to 150 (build() would throw otherwise).
  assert.equal(build().branches.find((b) => b.id === "fundamentals").maxWords, 150);
});

test("concepts: each module's are in quests/concepts.yaml, and its code can't use one it doesn't list", async () => {
  const { checkConcepts, loadConcepts } = await import("../content/build.mjs");
  const concepts = loadConcepts();
  const branch = { id: "b", modules: ["X1"] };
  const module = (over) => new Map([["X1", { id: "X1", kind: "module", status: "ready", source: "x/module.md", body: "", ...over }]]);
  assert.throws(() => checkConcepts([branch], module({ concepts: ["telepathy"] }), concepts), /concept telepathy isn't in quests\/concepts.yaml/);
  const code = "```python x.py\n@workflow.update\ndef pay(self): ...\n```";
  assert.throws(() => checkConcepts([branch], module({ concepts: ["query"], body: code }), concepts), /uses Update .* don't list update/);
  assert.doesNotThrow(() => checkConcepts([branch], module({ concepts: ["update"], body: code }), concepts));
  // Incidental calls don't count: an activity call is in nearly every module.
  assert.doesNotThrow(() => checkConcepts([branch], module({ concepts: ["saga"], body: "```python\nawait workflow.execute_activity(a, b, start_to_close_timeout=t)\n```" }), concepts));
  // In a branch that tags its modules, every ready one is tagged.
  const two = new Map([...module({ concepts: ["saga"] }), ["X2", { id: "X2", kind: "module", status: "ready", source: "y/module.md", body: "" }]]);
  assert.throws(() => checkConcepts([{ id: "b", modules: ["X1", "X2"] }], two, concepts), /y\/module.md: no concepts/);

  const course = buildCourse();
  const fundamentals = course.modules.filter((m) => m.branch === "fundamentals" && m.kind === "module");
  assert.ok(fundamentals.every((m) => m.concepts?.length), "every Fundamentals module lists its concepts");
  assert.deepEqual(course.concepts.find((c) => c.id === "update").modules, ["F9", "F14"]);
  assert.deepEqual(course.concepts.find((c) => c.id === "signal").modules, [], "not in the course yet");
});

// --- Languages (ADR 0001) ---

const TWO = ["python", "typescript"];
const SNIPPETS = [
  "Call the activity:",
  "",
  "```python",
  "await workflow.execute_activity(lookup_airport, code)",
  "```",
  "",
  "```typescript",
  "await lookup_airport(code);",
  "```",
  "",
  "<!-- lang python -->",
  "- `start_to_close_timeout`: how long one attempt may take.",
  "<!-- /lang -->",
  "<!-- lang typescript -->",
  "- `startToCloseTimeout`: how long one attempt may take.",
  "<!-- /lang -->",
  "Then restart the worker.",
  "",
].join("\n");

test("a module's text in each language: its own language blocks, and its own version of each snippet", async () => {
  const { applyLanguage } = await import("../content/build.mjs");
  const python = applyLanguage(SNIPPETS, "python", TWO);
  assert.match(python, /execute_activity/);
  assert.doesNotMatch(python, /await lookup_airport\(code\);|startToCloseTimeout|<!--/);
  assert.match(python, /- `start_to_close_timeout`/);
  const ts = applyLanguage(SNIPPETS, "typescript", TWO);
  assert.match(ts, /await lookup_airport\(code\);/);
  assert.doesNotMatch(ts, /execute_activity|start_to_close_timeout|<!--/);
  assert.equal(ts, "Call the activity:\n\n```typescript\nawait lookup_airport(code);\n```\n\n- `startToCloseTimeout`: how long one attempt may take.\nThen restart the worker.\n");
  // A branch with one language: two snippets in a row are two snippets.
  const one = "```python\na = 1\n```\n\n```python\nb = 2\n```\n";
  assert.equal(applyLanguage(one, "python", ["python"]), one);
});

test("the build fails on a snippet without a version in each of its branch's languages", async () => {
  const { checkLanguageText } = await import("../content/build.mjs");
  assert.doesNotThrow(() => checkLanguageText("m.md", SNIPPETS, TWO));
  const missing = SNIPPETS.replace("```typescript\nawait lookup_airport(code);\n```\n", "");
  assert.throws(() => checkLanguageText("m.md", missing, TWO), /line 3 of its text has no typescript version/);
  assert.throws(() => checkLanguageText("m.md", SNIPPETS, ["python", "typescript", "java"]), /no java version/);
  assert.throws(() => checkLanguageText("m.md", "```python\na\n```\n\n```python\nb\n```\n", TWO), /two python versions/);
  // A one-language snippet is fine inside its language's block, and only there.
  assert.doesNotThrow(() => checkLanguageText("m.md", "<!-- lang python -->\n```python\na\n```\n<!-- /lang -->\n", TWO));
  assert.throws(() => checkLanguageText("m.md", "<!-- lang python -->\n```typescript\na\n```\n<!-- /lang -->\n", TWO), /typescript code block inside <!-- lang python -->/);
  assert.throws(() => checkLanguageText("m.md", "```typescript\na\n```\n", ["python"]), /isn't one of its branch's languages/);
  assert.throws(() => checkLanguageText("m.md", "<!-- lang java -->\nx\n<!-- /lang -->\n", TWO), /lang java --> isn't one of its branch's languages/);
  assert.throws(() => checkLanguageText("m.md", "<!-- lang python -->\n## 2. A step\n<!-- /lang -->\n", TWO), /a heading inside/);
  assert.throws(() => checkLanguageText("m.md", "<!-- lang python -->\nnever closed\n", TWO), /isn't closed/);
});

test("a branch's languages, and what a module gives each one, are checked", async () => {
  const { checkBranchLanguages, checkModuleLanguages } = await import("../content/build.mjs");
  const branch = { languages: TWO, worker: "uv run hello-worker", starter: "uv run hello-start", langs: { typescript: { worker: "npm run worker", starter: "npm run start --" } } };
  assert.doesNotThrow(() => checkBranchLanguages("b.md", branch));
  assert.throws(() => checkBranchLanguages("b.md", { ...branch, languages: ["python", "rust"] }), /rust isn't one of/);
  assert.throws(() => checkBranchLanguages("b.md", { ...branch, langs: { typescript: { worker: "npm run worker" } } }), /no langs.typescript.starter/);
  assert.throws(() => checkBranchLanguages("b.md", { ...branch, langs: { ...branch.langs, python: { worker: "x" } } }), /langs.python, but python isn't one of its other languages/);
  const module = { files: [{ path: "hello/workflow.py" }], tour: [{ file: "hello/workflow.py" }], check: { kind: "code" } };
  const given = { files: [{ path: "langs/typescript/hello/src/workflows.ts" }], tour: [{}], hint: "Look in workflows.ts." };
  assert.doesNotThrow(() => checkModuleLanguages("m.md", { ...module, langs: { typescript: given } }, TWO));
  assert.doesNotThrow(() => checkModuleLanguages("m.md", module, ["python"]));
  assert.throws(() => checkModuleLanguages("m.md", module, TWO), /no langs.typescript.files/);
  assert.throws(() => checkModuleLanguages("m.md", { ...module, langs: { typescript: { ...given, hint: undefined } } }, TWO), /no langs.typescript.hint/);
  assert.throws(() => checkModuleLanguages("m.md", { ...module, langs: { typescript: { ...given, title: "x" } } }, TWO), /langs.typescript.title isn't one of/);
});

test("every branch has its languages, Python where it names none, and every exercise its own", () => {
  const course = buildCourse();
  for (const branch of course.branches) assert.ok(branch.languages?.length, `${branch.id} has no languages`);
  assert.deepEqual(course.branches.find((b) => b.id === "fundamentals").languages, ["python"]);
  for (const exercise of course.exercises) assert.deepEqual(exercise.languages, ["python"], exercise.id);
});
