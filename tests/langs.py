"""The learner's code in their language, for the Fundamentals checks.

`QUEST_LANG` (python unless set: `./quest check` sets it from `./quest lang`) says which. Python's
checks run the workflows and activities in this process, as they always have. Any other language's
run its workflows in a worker of its own, started from langs/<language>/hello, with only workflows
(all of Fundamentals' TODOs are workflow code), and the activities here, in Python: the wire
contract (hello/CONTRACT.md) makes the two one worker as far as Temporal can tell. That worker is
started once per task queue and kept for the check, since starting one takes seconds.

    async with langs.hello_worker(client, langs.queue("hello")):   # in a check
        ...

docs/adr/0002-one-wire-contract-python-checks.md says why.
"""

import asyncio
import contextlib
import os
import signal
import subprocess
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

import pytest
from temporalio.api.enums.v1 import TaskQueueType
from temporalio.api.taskqueue.v1 import TaskQueue
from temporalio.api.workflowservice.v1 import DescribeTaskQueueRequest
from temporalio.worker import Worker

from hello.worker import ACTIVITIES, build_worker

ROOT = Path(__file__).resolve().parent.parent
LANGUAGE = os.environ.get("QUEST_LANG", "python")
PYTHON = LANGUAGE == "python"
# Where each language's code is: langs/<language>/hello. QUEST_LANGS_ROOT points elsewhere (the
# prototype's, say) to try the adapter on code that isn't in the repo yet.
LANGS_ROOT = Path(os.environ.get("QUEST_LANGS_ROOT", ROOT / "langs"))
HISTORIES = ROOT / "tests" / "histories"
# How long a worker may take to start polling, from launch: a cold JVM or a first TypeScript
# bundle on one vCPU takes a few seconds.
START_TIMEOUT = 60


@dataclass(frozen=True)
class Runtime:
    """How to build a language's hello, run its worker, and replay a history with it."""

    build: tuple[str, ...]
    worker: tuple[str, ...]
    # Followed by --history FILE: exits 0 when the history replays on the code, 1 when the code
    # doesn't match it (nondeterminism), and anything else for anything else (an open TODO, say).
    replay: tuple[str, ...]
    env: tuple[tuple[str, str], ...] = ()


RUNTIMES = {
    # From source: the SDK bundles the workflows itself, so there's nothing to build.
    "typescript": Runtime(
        build=(),
        worker=("node_modules/.bin/tsx", "src/worker.ts"),
        replay=("node_modules/.bin/tsx", "src/replay.ts"),
    ),
    "java": Runtime(
        build=("./gradlew", "-q", "installDist"),
        worker=("build/install/hello/bin/hello", "worker"),
        replay=("build/install/hello/bin/hello", "replay"),
        # A small, short-lived JVM: the sandbox has 2 GiB for everything.
        env=(("JAVA_OPTS", "-XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xmx256m"),),
    ),
    "dotnet": Runtime(
        build=("dotnet", "build", "-v", "q", "--nologo"),
        worker=("dotnet", "bin/Debug/net10.0/Hello.dll", "worker"),
        replay=("dotnet", "bin/Debug/net10.0/Hello.dll", "replay"),
    ),
}

SESSION = uuid.uuid4().hex[:8]
_built = False
_workers: dict[tuple[str, str], subprocess.Popen] = {}


class LanguageError(Exception):
    """The learner's code wouldn't build or start: the message says what it printed."""


def runtime(language: str = LANGUAGE) -> Runtime:
    if language not in RUNTIMES:
        raise ValueError(f"language {language} isn't one of python, {', '.join(RUNTIMES)}")
    return RUNTIMES[language]


def app_root(language: str = LANGUAGE) -> Path:
    """Where a language's hello is: langs/<language>/hello (under QUEST_LANGS_ROOT, if it's set)."""
    return LANGS_ROOT / language / "hello"


def repo_path(rel: str) -> Path:
    """A repo-relative path (`langs/typescript/hello/src/workflows.ts`), wherever QUEST_LANGS_ROOT
    puts langs/."""
    return LANGS_ROOT / rel.removeprefix("langs/") if rel.startswith("langs/") else ROOT / rel


def build_app(language: str, app: Path) -> None:
    """Builds a language's hello in `app` (TypeScript has nothing to build)."""
    if not runtime(language).build:
        return
    done = subprocess.run(runtime(language).build, cwd=app, capture_output=True, text=True)
    if done.returncode != 0:
        raise LanguageError(f"Your code doesn't build:\n{(done.stdout + done.stderr).strip()[-3000:]}")


async def _polled(client, task_queue: str, kind) -> bool:
    request = DescribeTaskQueueRequest(
        namespace=client.namespace, task_queue=TaskQueue(name=task_queue), task_queue_type=kind
    )
    found = await client.workflow_service.describe_task_queue(request)
    return bool(found.pollers)


async def _ready(client, task_queue: str, mode: str) -> bool:
    kinds = [TaskQueueType.TASK_QUEUE_TYPE_WORKFLOW]
    if mode == "all":
        kinds.append(TaskQueueType.TASK_QUEUE_TYPE_ACTIVITY)
    return all([await _polled(client, task_queue, kind) for kind in kinds])


async def start_worker(client, language: str, app: Path, task_queue: str, mode: str = "workflows") -> subprocess.Popen:
    """A worker of a language's hello in `app` (its workflows, or with `mode` all, its activities
    too), once it polls `task_queue`. It has to be built first (build_app)."""
    env = {
        **os.environ,
        "TEMPORAL_ADDRESS": client.service_client.config.target_host,
        "TEMPORAL_NAMESPACE": client.namespace,
        "HELLO_TASK_QUEUE": task_queue,
        "WORKER_MODE": mode,
        **dict(runtime(language).env),
    }
    proc = subprocess.Popen(
        runtime(language).worker,
        cwd=app,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )
    started = time.monotonic()
    while not await _ready(client, task_queue, mode):
        if proc.poll() is not None:
            raise LanguageError(f"Your worker stopped before it started:\n{proc.stdout.read().strip()[-3000:]}")
        if time.monotonic() - started > START_TIMEOUT:
            stop(proc)
            raise LanguageError(f"Your worker didn't start polling within {START_TIMEOUT}s")
        await asyncio.sleep(0.1)
    return proc


def stop(proc: subprocess.Popen) -> None:
    with contextlib.suppress(ProcessLookupError):
        os.killpg(proc.pid, signal.SIGTERM)
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGKILL)
        proc.wait()


# --- In a check: the learner's language, and its errors as the check's failure -----------------


def queue(prefix: str) -> str:
    """A task queue for a check. Python's tests each have their own; another language's share
    one per prefix for the check, so its worker starts once."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}" if PYTHON else f"{prefix}-{SESSION}"


def history(name: str) -> Path:
    """A recorded history, in the learner's language: Java versions a workflow differently."""
    return HISTORIES / f"{name}.json" if PYTHON else HISTORIES / LANGUAGE / f"{name}.json"


def build() -> None:
    """Builds the learner's code, once a check. A compile error fails the check, with its output."""
    global _built
    if not _built:
        try:
            build_app(LANGUAGE, app_root())
        except LanguageError as err:
            pytest.fail(str(err), pytrace=False)
        _built = True


async def _start(client, task_queue: str, mode: str) -> subprocess.Popen:
    build()
    try:
        return await start_worker(client, LANGUAGE, app_root(), task_queue, mode)
    except LanguageError as err:
        pytest.fail(str(err), pytrace=False)


def stop_all() -> None:
    """The check's workers, stopped: at the end of the check (conftest.py)."""
    while _workers:
        stop(_workers.popitem()[1])


@contextlib.asynccontextmanager
async def hello_worker(client, task_queue: str, *, fresh: bool = False, own_activities: bool = False):
    """A hello worker on `task_queue`, for the block: in Python, as always; in another language,
    its workflows in a worker of its own (kept for the check, unless `fresh`: a new one, stopped at
    the end of the block, for a check that restarts the worker) and the activities here, in Python.
    `own_activities`: the language's own activities instead, in its worker (the contract test)."""
    if PYTHON:
        async with build_worker(client, task_queue):
            yield
        return
    mode = "all" if own_activities else "workflows"
    key = (task_queue, mode)
    if fresh:
        proc = await _start(client, task_queue, mode)
    elif key not in _workers or _workers[key].poll() is not None:
        _workers[key] = proc = await _start(client, task_queue, mode)
    try:
        if own_activities:
            yield
        else:
            async with Worker(client, task_queue=task_queue, activities=ACTIVITIES):
                yield
    finally:
        if fresh:
            stop(proc)


def replay(path: Path, *, provided: bool = False) -> tuple[str, str]:
    """Replays a history file on the learner's code, in their language: ("ok", output),
    ("nondeterminism", output), or ("error", output). With their replayer (F13's TODO), or with
    `provided`, the SDK's (for F12, whose check mustn't need F13 solved)."""
    build()
    done = subprocess.run(
        [*runtime().replay, "--history", str(path), *(["--provided"] if provided else [])],
        cwd=app_root(),
        env={**os.environ, **dict(runtime().env)},
        capture_output=True,
        text=True,
    )
    output = (done.stdout + done.stderr).strip()[-3000:]
    return {0: "ok", 1: "nondeterminism"}.get(done.returncode, "error"), output
