"""Prototype (ticket 02): a rough language adapter for the checks.

How to build each language's hello, and how to run its worker as a subprocess on a task queue
of the check's own, waiting until it polls. Toolchains come from PATH (and JAVA_HOME,
DOTNET_ROOT). Timings go to $QUEST_TIMINGS (one JSON line each) for the measurements.
"""

import asyncio
import contextlib
import json
import os
import signal
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from temporalio.api.enums.v1 import TaskQueueType
from temporalio.api.taskqueue.v1 import TaskQueue
from temporalio.api.workflowservice.v1 import DescribeTaskQueueRequest

HERE = Path(__file__).parent


@dataclass(frozen=True)
class Lang:
    id: str
    dir: Path
    build: list[str]
    worker: list[str]
    env: tuple[tuple[str, str], ...] = ()


LANGS = {
    "typescript": Lang("typescript", HERE / "typescript/hello", ["npx", "tsc", "--build"], ["node", "lib/worker.js"]),
    "java": Lang("java", HERE / "java/hello", ["./gradlew", "-q", "installDist"], ["build/install/hello/bin/hello", "worker"]),
    # The fixes for check time: TypeScript straight from source (the SDK bundles the workflows
    # itself), and a JVM tuned for a small, short-lived worker.
    "typescript-tsx": Lang("typescript", HERE / "typescript/hello", [], ["node_modules/.bin/tsx", "src/worker.ts"]),
    "java-tuned": Lang("java", HERE / "java/hello", ["./gradlew", "-q", "installDist"], ["build/install/hello/bin/hello", "worker"],
                       (("JAVA_OPTS", "-XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xshare:auto -Xmx256m"),)),
    "dotnet": Lang("dotnet", HERE / "dotnet/hello", ["dotnet", "build", "-v", "q", "--nologo"],
                   ["dotnet", "bin/Debug/net10.0/Hello.dll", "worker"]),
}


def current() -> Lang:
    return LANGS[os.environ.get("QUEST_LANG", "typescript")]


def record(what: str, lang: str, seconds: float, **extra) -> None:
    if path := os.environ.get("QUEST_TIMINGS"):
        with open(path, "a") as f:
            f.write(json.dumps({"what": what, "lang": lang, "seconds": round(seconds, 2), **extra}) + "\n")


def build(lang: Lang, cwd: Path | None = None) -> float:
    if not lang.build:
        return 0.0
    start = time.monotonic()
    done = subprocess.run(lang.build, cwd=cwd or lang.dir, capture_output=True, text=True)
    if done.returncode != 0:
        raise RuntimeError(f"{lang.id} build failed:\n{done.stdout}\n{done.stderr}")
    seconds = time.monotonic() - start
    record("build", lang.id, seconds)
    return seconds


async def _polled(client, queue: str, kind) -> bool:
    resp = await client.workflow_service.describe_task_queue(DescribeTaskQueueRequest(
        namespace=client.namespace, task_queue=TaskQueue(name=queue), task_queue_type=kind))
    return bool(resp.pollers)


@contextlib.asynccontextmanager
async def worker(lang: Lang, client, queue: str, env: dict[str, str] | None = None, *,
                 cwd: Path | None = None, mode: str = "all", timeout: float = 60):
    """The language's worker, polling `queue`, until the block ends."""
    proc_env = {**os.environ, "TEMPORAL_ADDRESS": client.service_client.config.target_host,
                "TEMPORAL_NAMESPACE": client.namespace, "TASK_QUEUE": queue, "WORKER_MODE": mode, **dict(lang.env), **(env or {})}
    start = time.monotonic()
    proc = subprocess.Popen(lang.worker, cwd=cwd or lang.dir, env=proc_env, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, start_new_session=True)
    kind = TaskQueueType.TASK_QUEUE_TYPE_ACTIVITY if mode == "activities" else TaskQueueType.TASK_QUEUE_TYPE_WORKFLOW
    try:
        while not await _polled(client, queue, kind):
            if proc.poll() is not None:
                raise RuntimeError(f"{lang.id} worker exited:\n{proc.stdout.read()}")
            if time.monotonic() - start > timeout:
                raise TimeoutError(f"{lang.id} worker didn't poll within {timeout}s")
            await asyncio.sleep(0.1)
        record("first-poll", lang.id, time.monotonic() - start, mode=mode)
        yield proc
    finally:
        with contextlib.suppress(ProcessLookupError):
            os.killpg(proc.pid, signal.SIGTERM)
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait()
