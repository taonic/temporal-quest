# Prototype: ticket 02

This is throwaway code that tests the plan in [../spec.md](../spec.md) before any plumbing gets built. Ticket 09 starts `langs/typescript/hello` from the TypeScript code here, and tickets 11 and 12 start from the Java and .NET code. The results are in [../issues/02-prototype-f2-typescript.md](../issues/02-prototype-f2-typescript.md).

```
typescript/hello/   F2's trip workflow, lookup_airport, a worker and a starter (Node 24, SDK 1.26.0)
java/hello/         the same in Java (JDK 21, Gradle 9.9.2 wrapper, SDK 1.41.1)
dotnet/hello/       the same in C# (.NET 10, SDK 1.22.0)
langs.py            a rough check adapter: build a language, run its worker as a subprocess until it polls
conftest.py         the dev server, and the language built once per session
test_f2.py          F2's three checks from tests/test_ch01_hello.py, against any language
fc1_split.py        FC1's choices A and C in TypeScript: workflow-only TS worker, Python fake activities
measure.sh          the measurements, run inside a learner sandbox
lsp_probe.py        a language server's time to hover, and its memory
sandbox.mjs         makes a sandbox from today's snapshot, runs measure.sh, fetches the results, deletes it
```

Run it locally, with Node, JDK 21 and .NET 10 on `PATH` (and `JAVA_HOME`, `DOTNET_ROOT`):

```bash
(cd .scratch/multi-language/prototype/typescript/hello && npm ci)
for l in typescript java dotnet; do
  QUEST_LANG=$l .venv/bin/python -m pytest -q --rootdir . .scratch/multi-language/prototype/test_f2.py
done
.venv/bin/python .scratch/multi-language/prototype/fc1_split.py A C
```

Use `.venv/bin/python -m pytest`, not `uv run pytest`: on a machine where a global pytest is on `PATH`, `uv run pytest` can pick that one up.

Run it in a sandbox. This starts a billed Daytona sandbox for about 40 minutes and deletes it afterwards:

```bash
node .scratch/multi-language/prototype/sandbox.mjs <out-dir>
```
