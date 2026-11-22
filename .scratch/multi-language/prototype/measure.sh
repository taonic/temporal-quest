#!/usr/bin/env bash
# Prototype (ticket 02): measure TypeScript, Java and .NET in a learner sandbox (1 vCPU, 2 GiB)
# with travel-stack up. Writes /tmp/measure: times.txt (each timed step), mem.txt (memory every
# 0.5 s: the cgroup's total and anon, and RSS by command), phases.txt (when each phase started),
# timings.jsonl (the adapter's build and first-poll times), and each step's log.
set -uo pipefail
OUT=/tmp/measure; rm -rf $OUT; mkdir -p $OUT
W=/workshop; PROTO=$W/.scratch/multi-language/prototype; T=$HOME/tools; CG=/sys/fs/cgroup
mkdir -p $T
cd $W
export QUEST_TIMINGS=$OUT/timings.jsonl DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 \
       NPM_CONFIG_UPDATE_NOTIFIER=false

now() { date +%s.%N | cut -c1-14; }
phase() { echo "$(now) $*" >> $OUT/phases.txt; echo "== $(date +%T) $*"; }
timed() {  # timed NAME CMD...: run it, log its output, record how long it took
  local name=$1; shift; local s; s=$(now)
  "$@" > "$OUT/$name.log" 2>&1; local rc=$?
  echo "$name $(awk "BEGIN{printf \"%.1f\", $(now) - $s}") rc=$rc" >> $OUT/times.txt
  echo "   $name: $(tail -1 $OUT/times.txt)"
  return $rc
}
edit() { echo "// edit $(date +%s%N)" >> "$1"; }

( while true; do
    anon=$(awk '$1=="anon"{print int($2/1048576)}' $CG/memory.stat 2>/dev/null)
    cur=$(( $(cat $CG/memory.current 2>/dev/null || echo 0) / 1048576 ))
    procs=$(ps -eo rss=,comm= | awk '{a[$2]+=$1} END {for (k in a) if (a[k] > 30000) printf "%s=%d ", k, a[k]/1024}')
    echo "$(now) cur=$cur anon=$anon $procs" >> $OUT/mem.txt
    sleep 0.5
  done ) &
SAMPLER=$!
trap 'kill $SAMPLER 2>/dev/null' EXIT

phase system
{ uname -m; nproc; cat $CG/memory.max; cat $CG/memory.events; free -m; df -h /; } > $OUT/system.txt 2>&1

phase stack-up
rm -f .stack/*.pid
timed stack-up uv run --frozen travel-stack up
sleep 15
phase idle-baseline
sleep 10

phase python-check
timed python-check .venv/bin/python -m pytest -q -p no:cacheprovider tests/test_ch01_hello.py \
  -k "describes_the_trip or retries_a_failed or gentle_backoff"

phase install
arch=$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')
node_v=$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c "import json,sys; print(next(r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v24.')))")
timed install-node bash -c "curl -fsSL https://nodejs.org/dist/$node_v/node-$node_v-linux-$arch.tar.gz | tar -xz -C $T && mv $T/node-$node_v-linux-$arch $T/node"
jarch=$(uname -m | sed 's/x86_64/x64/;s/arm64/aarch64/')
timed install-jdk bash -c "mkdir -p $T/jdk && curl -fsSL https://api.adoptium.net/v3/binary/latest/21/ga/linux/$jarch/jdk/hotspot/normal/eclipse | tar -xz -C $T/jdk --strip-components=1"
timed install-dotnet bash -c "curl -fsSL https://dot.net/v1/dotnet-install.sh -o $T/dotnet-install.sh && bash $T/dotnet-install.sh --channel 10.0 --install-dir $T/dotnet --no-path"
export PATH=$T/node/bin:$T/jdk/bin:$T/dotnet:$PATH JAVA_HOME=$T/jdk DOTNET_ROOT=$T/dotnet
{ node --version; java -version 2>&1 | head -1; dotnet --version; } > $OUT/versions.txt 2>&1

learner_worker() {  # learner_worker DIR CMD...: the learner's own worker, on the hello queue, as in the worker terminal
  local dir=$1; shift
  ( cd "$dir" && TASK_QUEUE=hello exec "$@" > $OUT/learner-worker-$(basename $(dirname $dir)).log 2>&1 ) &
  LEARNER=$!
  sleep 15
}
check() { QUEST_LANG=$1 .venv/bin/python -m pytest -q -p no:cacheprovider --rootdir $W $PROTO/test_f2.py; }

# --- TypeScript ---
D=$PROTO/typescript/hello; cp $D/src/workflows.ts /tmp/ts.bak
phase ts-deps;  timed ts-deps bash -c "cd $D && npm ci --no-audit --no-fund"
phase ts-build; timed ts-build-cold bash -c "cd $D && rm -rf lib tsconfig.tsbuildinfo && npx tsc --build"
edit $D/src/workflows.ts; timed ts-build-incremental bash -c "cd $D && npx tsc --build"
phase ts-check
learner_worker $D node lib/worker.js
edit $D/src/workflows.ts; timed ts-check-first check typescript
edit $D/src/workflows.ts; timed ts-check-warm check typescript
phase ts-fc1;   timed ts-fc1 .venv/bin/python $PROTO/fc1_split.py A C
kill $LEARNER 2>/dev/null; wait $LEARNER 2>/dev/null; cp /tmp/ts.bak $D/src/workflows.ts
phase ts-done; sleep 5

# --- Java ---
D=$PROTO/java/hello; F=$D/src/main/java/hello/HelloTripWorkflowImpl.java; cp $F /tmp/java.bak; chmod +x $D/gradlew
phase java-deps;  timed java-deps bash -c "cd $D && ./gradlew -q installDist"
phase java-build
(cd $D && ./gradlew -q --stop)
edit $F; timed java-build-cold-daemon bash -c "cd $D && ./gradlew -q installDist"
edit $F; timed java-build-warm bash -c "cd $D && ./gradlew -q installDist"
phase java-check
learner_worker $D build/install/hello/bin/hello worker
(cd $D && ./gradlew -q --stop)
edit $F; timed java-check-first check java
edit $F; timed java-check-warm check java
kill $LEARNER 2>/dev/null; wait $LEARNER 2>/dev/null; cp /tmp/java.bak $F
(cd $D && ./gradlew -q --stop)
phase java-done; sleep 5

# --- .NET ---
D=$PROTO/dotnet/hello; F=$D/HelloTripWorkflow.cs; cp $F /tmp/dotnet.bak
phase dotnet-deps;  timed dotnet-deps bash -c "cd $D && dotnet restore -v q"
phase dotnet-build
timed dotnet-build-first bash -c "cd $D && dotnet build -v q --nologo"
dotnet build-server shutdown > /dev/null 2>&1
edit $F; timed dotnet-build-cold-server bash -c "cd $D && dotnet build -v q --nologo"
edit $F; timed dotnet-build-warm bash -c "cd $D && dotnet build -v q --nologo"
phase dotnet-check
learner_worker $D dotnet bin/Debug/net10.0/Hello.dll worker
dotnet build-server shutdown > /dev/null 2>&1
edit $F; timed dotnet-check-first check dotnet
edit $F; timed dotnet-check-warm check dotnet
kill $LEARNER 2>/dev/null; wait $LEARNER 2>/dev/null; cp /tmp/dotnet.bak $F
dotnet build-server shutdown > /dev/null 2>&1
phase dotnet-done; sleep 5

# --- Language servers ---
phase lsp-install
timed install-tsls npm install --prefix $T/tsls --no-audit --no-fund typescript-language-server typescript
timed install-jdtls bash -c "mkdir -p $T/jdtls && curl -fsSL https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz | tar -xz -C $T/jdtls"
timed install-csls dotnet tool install csharp-ls --tool-path $T/csls
phase lsp-typescript
timed lsp-typescript .venv/bin/python $PROTO/lsp_probe.py $PROTO/typescript/hello src/workflows.ts "proxyActivities<typeof" -- \
  $T/tsls/node_modules/.bin/typescript-language-server --stdio
phase lsp-java
timed lsp-java .venv/bin/python $PROTO/lsp_probe.py $PROTO/java/hello src/main/java/hello/HelloTripWorkflowImpl.java newActivityStub -- \
  $T/jdtls/bin/jdtls -data /tmp/jdtls-ws
pkill -f gradle 2>/dev/null
phase lsp-dotnet
timed lsp-dotnet .venv/bin/python $PROTO/lsp_probe.py $PROTO/dotnet/hello HelloTripWorkflow.cs ExecuteActivityAsync -- \
  $T/csls/csharp-ls
dotnet build-server shutdown > /dev/null 2>&1
phase end
cat $CG/memory.events > $OUT/memory-events-end.txt
touch $OUT/done
