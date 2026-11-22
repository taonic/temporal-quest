#!/usr/bin/env bash
# Prototype (ticket 02): the Java and C# language servers in a learner sandbox, the second run.
# jdtls needs Java 25 to run (the project still targets 21); csharp-ls 0.29.0's package is broken,
# so 0.28.0. Dependencies are fetched first, as a snapshot would have them. Writes /tmp/measure.
set -uo pipefail
OUT=/tmp/measure; rm -rf $OUT; mkdir -p $OUT
W=/workshop; PROTO=$W/.scratch/multi-language/prototype; T=$HOME/tools; CG=/sys/fs/cgroup
mkdir -p $T; cd $W
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1
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

phase stack-up
rm -f .stack/*.pid
timed stack-up uv run --frozen travel-stack up
sleep 15

phase install
jarch=$(uname -m | sed 's/x86_64/x64/;s/arm64/aarch64/')
timed install-jdk21 bash -c "mkdir -p $T/jdk && curl -fsSL https://api.adoptium.net/v3/binary/latest/21/ga/linux/$jarch/jdk/hotspot/normal/eclipse | tar -xz --no-same-owner -C $T/jdk --strip-components=1"
timed install-jdk25 bash -c "mkdir -p $T/jdk25 && curl -fsSL https://api.adoptium.net/v3/binary/latest/25/ga/linux/$jarch/jdk/hotspot/normal/eclipse | tar -xz --no-same-owner -C $T/jdk25 --strip-components=1"
timed install-dotnet bash -c "curl -fsSL https://dot.net/v1/dotnet-install.sh -o $T/dotnet-install.sh && bash $T/dotnet-install.sh --channel 10.0 --install-dir $T/dotnet --no-path"
export PATH=$T/jdk/bin:$T/dotnet:$PATH JAVA_HOME=$T/jdk DOTNET_ROOT=$T/dotnet
timed install-jdtls bash -c "mkdir -p $T/jdtls && curl -fsSL https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz | tar -xz --no-same-owner -C $T/jdtls"
timed install-csls dotnet tool install csharp-ls --version 0.28.0 --tool-path $T/csls
chmod +x $PROTO/java/hello/gradlew
timed java-prefetch bash -c "cd $PROTO/java/hello && ./gradlew -q installDist && ./gradlew -q --stop"
timed dotnet-prefetch bash -c "cd $PROTO/dotnet/hello && dotnet build -v q --nologo && dotnet build-server shutdown"
du -sh $T/jdk $T/jdk25 $T/dotnet $T/jdtls $T/csls ~/.gradle ~/.nuget 2>/dev/null > $OUT/disk.txt
sleep 5

probe() {  # probe NAME ROOT FILE SYMBOL -- CMD...
  local name=$1; shift
  phase $name
  LSP_STDERR=$OUT/$name.stderr timed $name .venv/bin/python $PROTO/lsp_probe.py "$@"
  cat $OUT/$name.log
  pkill -f GradleDaemon 2>/dev/null; dotnet build-server shutdown > /dev/null 2>&1
  sleep 5
}
probe lsp-java $PROTO/java/hello src/main/java/hello/HelloTripWorkflowImpl.java newActivityStub -- \
  env JAVA_HOME=$T/jdk25 PATH=$T/jdk25/bin:$PATH $T/jdtls/bin/jdtls -data /tmp/jdtls-ws
rm -rf /tmp/jdtls-ws
probe lsp-java-512m $PROTO/java/hello src/main/java/hello/HelloTripWorkflowImpl.java newActivityStub -- \
  env JAVA_HOME=$T/jdk25 PATH=$T/jdk25/bin:$PATH $T/jdtls/bin/jdtls --jvm-arg=-Xmx512m -data /tmp/jdtls-ws
probe lsp-dotnet $PROTO/dotnet/hello HelloTripWorkflow.cs ExecuteActivityAsync -- $T/csls/csharp-ls
phase end
cat $CG/memory.events > $OUT/memory-events-end.txt
touch $OUT/done
