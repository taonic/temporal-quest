#!/usr/bin/env bash
# Prototype (ticket 08): a TypeScript check while typescript-language-server, its tsserver capped
# (maxTsServerMemory), stays open beside it and the learner's worker: does it fit in 2 GiB?
set -uo pipefail
OUT=/tmp/measure; rm -rf $OUT; mkdir -p $OUT
W=/workshop; PROTO=$W/.scratch/multi-language/prototype; T=$HOME/tools; CG=/sys/fs/cgroup
mkdir -p $T; cd $W
export QUEST_TIMINGS=$OUT/timings.jsonl NPM_CONFIG_UPDATE_NOTIFIER=false QUEST_LANGS_ROOT=$PROTO QUEST_LANG=typescript
now() { date +%s.%N | cut -c1-14; }
phase() { echo "$(now) $*" >> $OUT/phases.txt; echo "== $(date +%T) $*"; }
timed() {
  local name=$1; shift; local s; s=$(now)
  "$@" > "$OUT/$name.log" 2>&1; local rc=$?
  echo "$name $(awk "BEGIN{printf \"%.1f\", $(now) - $s}") rc=$rc" >> $OUT/times.txt
  echo "   $name: $(tail -1 $OUT/times.txt)"
  return $rc
}
( while true; do
    anon=$(awk '$1=="anon"{print int($2/1048576)}' $CG/memory.stat 2>/dev/null)
    cur=$(( $(cat $CG/memory.current 2>/dev/null || echo 0) / 1048576 ))
    procs=$(ps -eo rss=,comm= | awk '{a[$2]+=$1} END {for (k in a) if (a[k] > 30000) printf "%s=%d ", k, a[k]/1024}')
    echo "$(now) cur=$cur anon=$anon $procs" >> $OUT/mem.txt
    sleep 0.5
  done ) &
SAMPLER=$!
trap 'kill $SAMPLER 2>/dev/null' EXIT
F2="tests/test_ch01_hello.py::test_describes_the_trip tests/test_ch01_hello.py::test_retries_a_failed_activity tests/test_ch01_hello.py::test_uses_a_retry_policy_with_a_gentle_backoff"

phase stack-up
rm -f .stack/*.pid
timed stack-up uv run --frozen travel-stack up
sleep 15
phase install
arch=$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')
node_v=$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c "import json,sys; print(next(r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v24.')))")
timed install-node bash -c "curl -fsSL https://nodejs.org/dist/$node_v/node-$node_v-linux-$arch.tar.gz | tar -xz --no-same-owner -C $T && mv $T/node-$node_v-linux-$arch $T/node"
export PATH=$T/node/bin:$PATH
timed ts-deps bash -c "cd $PROTO/typescript/hello && npm ci --no-audit --no-fund"
timed install-tsls npm install --prefix $T/tsls --no-audit --no-fund typescript-language-server typescript
D=$PROTO/typescript/hello
( cd $D && HELLO_TASK_QUEUE=hello exec node_modules/.bin/tsx src/worker.ts > $OUT/learner-worker.log 2>&1 ) &
LEARNER=$!
sleep 10

for cap in 0 512 384; do
  phase lsp-$cap
  init='{}'; [ $cap -gt 0 ] && init="{\"maxTsServerMemory\": $cap}"
  ( LSP_INIT="$init" LSP_HOLD=60 .venv/bin/python $PROTO/lsp_probe.py $D src/workflows.ts "proxyActivities<typeof" -- \
      $T/tsls/node_modules/.bin/typescript-language-server --stdio > $OUT/lsp-$cap.log 2>&1 ) &
  PROBE=$!
  sleep 20
  phase check-$cap
  timed check-$cap .venv/bin/python -m pytest -q -p no:cacheprovider $F2
  wait $PROBE
  cat $OUT/lsp-$cap.log
  sleep 5
done
kill $LEARNER 2>/dev/null
phase end
cat $CG/memory.events > $OUT/memory-events-end.txt
touch $OUT/done
