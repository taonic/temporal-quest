// Builds a language's learner snapshot: the Python one (Dockerfile, as build.mjs builds it) with
// that language's toolchain on top (languages/<language>.Dockerfile). docs/adr/0003.
//
//   node course/snapshot/build-language.mjs typescript            # build it on Daytona
//   node course/snapshot/build-language.mjs typescript --local    # with local Docker, to test it
//   node course/snapshot/build-language.mjs typescript --name     # the name the runner will ask for
//
// A file of its own, not build.mjs: build.mjs is one of the Python snapshot's inputs (its name
// hashes it), so changing it would ask for a new Python snapshot.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Daytona, Image } from "@daytonaio/sdk";

import { LANGUAGE_RESOURCES, LANGUAGE_SNAPSHOT_INPUTS, languageSnapshotName, repoRoot, workshopFiles } from "../runner/repo-files.mjs";

function stageContext(language) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `governance-snapshot-${language}-`));
  const base = fs.readFileSync(path.join(repoRoot, "course/snapshot/Dockerfile"), "utf8");
  const extra = fs.readFileSync(path.join(repoRoot, `course/snapshot/languages/${language}.Dockerfile`), "utf8");
  fs.writeFileSync(path.join(dir, "Dockerfile"), `${base}\n${extra}`);
  fs.copyFileSync(path.join(repoRoot, "course/snapshot/lsp_bridge.py"), path.join(dir, "lsp_bridge.py"));
  fs.copyFileSync(path.join(repoRoot, "course/snapshot/languages/lsp_stdio_bridge.py"), path.join(dir, "lsp_stdio_bridge.py"));
  for (const rel of workshopFiles()) {
    const dest = path.join(dir, "workshop", rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, rel), dest);
  }
  return dir;
}

async function main() {
  const [language, ...rest] = process.argv.slice(2);
  const args = new Set(rest);
  if (!LANGUAGE_SNAPSHOT_INPUTS[language]) throw new Error(`usage: build-language.mjs <${Object.keys(LANGUAGE_SNAPSHOT_INPUTS).join("|")}> [--local|--name|--force]`);
  const name = languageSnapshotName(language);
  if (args.has("--name")) {
    console.log(name);
    return;
  }
  const context = stageContext(language);
  console.log(`Staged the build context in ${context}`);
  if (args.has("--local")) {
    execFileSync("docker", ["build", "-t", name, context], { stdio: "inherit" });
    console.log(`\n✓ Built ${name} locally. Try it: docker run --rm -it ${name} bash`);
    return;
  }

  const daytona = new Daytona();
  try {
    const existing = await daytona.snapshot.get(name);
    if (!args.has("--force")) {
      console.log(`✓ Snapshot ${name} already exists (${existing.state}). --force rebuilds it.`);
      return;
    }
    console.log(`Deleting the existing ${name}...`);
    await daytona.snapshot.delete(existing);
  } catch (err) {
    if (!/not found/i.test(String(err?.message))) throw err;
  }
  console.log(`Building snapshot ${name} on Daytona (compiling Dogwood takes a while)...`);
  await daytona.snapshot.create(
    { name, image: Image.fromDockerfile(path.join(context, "Dockerfile")), resources: LANGUAGE_RESOURCES[language], entrypoint: ["sleep", "infinity"] },
    { onLogs: (chunk) => process.stdout.write(chunk.endsWith("\n") ? chunk : `${chunk}\n`), timeout: 0 },
  );
  console.log(`\n✓ Snapshot ${name} is ready.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
