#!/usr/bin/env bash
# Prototype (ticket 02): the check-time fixes in a learner sandbox, the third run. One worker per
# check with only workflows (Python activities in process), TypeScript from source with tsx, a
# tuned JVM and a smaller Gradle daemon. Also each language's worker restart after an edit.
set -uo pipefail
OUT=/tmp/measure; rm -rf $OUT; mkdir -p $OUT
W=/workshop; PROTO=$W/.scratch/multi-language/prototype; T=$HOME/tools; CG=/sys/fs/cgroup
mkdir -p $T; cd $W
export QUEST_TIMINGS=$OUT/timings.jsonl DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 \
       NPM_CONFIG_UPDATE_NOTIFIER=false
now() { date +%s.%N | cut -c1-14; }
phase() { echo "$(now) $*" >> $OUT/phases.txt; echo "== $(date +%T) $*"; }
timed() {
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

phase stack-up
rm -f .stack/*.pid
timed stack-up uv run --frozen travel-stack up
sleep 15
phase python-check
timed python-check .venv/bin/python -m pytest -q -p no:cacheprovider tests/test_ch01_hello.py \
  -k "describes_the_trip or retries_a_failed or gentle_backoff"

phase install
arch=$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/'); jarch=$(uname -m | sed 's/x86_64/x64/;s/arm64/aarch64/')
node_v=$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c "import json,sys; print(next(r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v24.')))")
timed install-node bash -c "curl -fsSL https://nodejs.org/dist/$node_v/node-$node_v-linux-$arch.tar.gz | tar -xz --no-same-owner -C $T && mv $T/node-$node_v-linux-$arch $T/node"
timed install-jdk bash -c "mkdir -p $T/jdk && curl -fsSL https://api.adoptium.net/v3/binary/latest/21/ga/linux/$jarch/jdk/hotspot/normal/eclipse | tar -xz --no-same-owner -C $T/jdk --strip-components=1"
timed install-dotnet bash -c "curl -fsSL https://dot.net/v1/dotnet-install.sh -o $T/dotnet-install.sh && bash $T/dotnet-install.sh --channel 10.0 --install-dir $T/dotnet --no-path"
export PATH=$T/node/bin:$T/jdk/bin:$T/dotnet:$PATH JAVA_HOME=$T/jdk DOTNET_ROOT=$T/dotnet
chmod +x $PROTO/java/hello/gradlew
timed ts-deps bash -c "cd $PROTO/typescript/hello && npm ci --no-audit --no-fund"
timed java-prefetch bash -c "cd $PROTO/java/hello && ./gradlew -q installDist && ./gradlew -q --stop"
timed dotnet-prefetch bash -c "cd $PROTO/dotnet/hello && dotnet build -v q --nologo && dotnet build-server shutdown"
sleep 5

check() { QUEST_LANG=$1 .venv/bin/python -m pytest -q -p no:cacheprovider --rootdir $W $PROTO/test_f2_split.py; }
learner_worker() {
  local dir=$1; shift
  ( cd "$dir" && HELLO_TASK_QUEUE=hello exec "$@" > $OUT/learner-worker-$(basename $(dirname $dir)).log 2>&1 ) &
  LEARNER=$!; sleep 15
}

phase ts
D=$PROTO/typescript/hello
learner_worker $D node_modules/.bin/tsx src/worker.ts
edit $D/src/workflows.ts; timed ts-check-first check typescript-tsx
edit $D/src/workflows.ts; timed ts-check-warm check typescript-tsx
timed ts-restart env QUEST_LANG=typescript-tsx .venv/bin/python $PROTO/restart.py src/workflows.ts
timed ts-fc1 env QUEST_LANG=typescript-tsx .venv/bin/python $PROTO/fc1_split.py A C
kill $LEARNER; wait $LEARNER 2>/dev/null; sleep 5

phase java
D=$PROTO/java/hello; F=$D/src/main/java/hello/HelloTripWorkflowImpl.java; cp $F /tmp/java.bak
learner_worker $D env JAVA_OPTS="-XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xmx256m" build/install/hello/bin/hello worker
(cd $D && ./gradlew -q --stop)
edit $F; timed java-check-first check java-tuned
edit $F; timed java-check-warm check java-tuned
timed java-restart env QUEST_LANG=java-tuned .venv/bin/python $PROTO/restart.py src/main/java/hello/HelloTripWorkflowImpl.java
kill $LEARNER; wait $LEARNER 2>/dev/null; cp /tmp/java.bak $F; (cd $D && ./gradlew -q --stop); sleep 5

phase dotnet
D=$PROTO/dotnet/hello; F=$D/HelloTripWorkflow.cs; cp $F /tmp/dotnet.bak
learner_worker $D dotnet bin/Debug/net10.0/Hello.dll worker
dotnet build-server shutdown > /dev/null 2>&1
edit $F; timed dotnet-check-first check dotnet
edit $F; timed dotnet-check-warm check dotnet
timed dotnet-restart env QUEST_LANG=dotnet .venv/bin/python $PROTO/restart.py HelloTripWorkflow.cs
kill $LEARNER; wait $LEARNER 2>/dev/null; cp /tmp/dotnet.bak $F; dotnet build-server shutdown > /dev/null 2>&1

phase end
cat $CG/memory.events > $OUT/memory-events-end.txt
touch $OUT/done
