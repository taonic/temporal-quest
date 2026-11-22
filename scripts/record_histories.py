"""Record the histories the versioning and replay checks replay (tests/histories/).

    uv run python scripts/record_histories.py                    # Python's
    uv run python scripts/record_histories.py --lang typescript  # another language's (tests/histories/<language>/)

- fare_hold_before_the_email.json: a fare hold that ran before it emailed anyone (F8 and F9
  solved, F12 not yet). New code has to replay it: that's what F12's patch is for.
- trip_that_waited_first.json: a HelloTripWorkflow from an older version that waited a second
  before its lookups. Today's code doesn't, so replaying it has to fail: F13's replay must say so.

Run it again only if those workflows change in a way that should change their histories.

Another language's fare hold is recorded with its own code (langs/<language>/hello, its masters
rendered with every TODO solved but F12's), since how a workflow is versioned differs between SDKs.
Its trip that waited first is Python's: it only has to fail to replay.
"""

import asyncio
import importlib
import os
import shutil
import sys
import tempfile
import uuid
from datetime import timedelta
from pathlib import Path

from temporalio import workflow
from temporalio.client import Client
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import UnsandboxedWorkflowRunner, Worker

sys.path.insert(0, str(Path(__file__).parent))
from render import AUTHORING, masters, render, todo_modules  # noqa: E402

from quests import language_of  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "histories"


def hold_before_the_email():
    """FareHoldWorkflow as it was before F12: the hold, without the email step."""
    tmp = Path(tempfile.mkdtemp(prefix="record-"))
    shutil.copytree(ROOT / "hello", tmp / "hello", ignore=shutil.ignore_patterns("__pycache__"))
    (tmp / "hello" / "hold.py").write_text(render((ROOT / "authoring/hello/hold.py").read_text(), {"F8", "F9"}))
    sys.path.insert(0, str(tmp))
    for name in [m for m in sys.modules if m == "hello" or m.startswith("hello.")]:
        del sys.modules[name]
    return importlib.import_module("hello.hold").FareHoldWorkflow


@workflow.defn(name="HelloTripWorkflow")
class TripThatWaitedFirst:
    @workflow.run
    async def run(self, trip: dict) -> str:
        await workflow.sleep(timedelta(seconds=1))
        return "An older version: it waited a second, then gave up."


async def record(client: Client, wf, arg, name: str) -> None:
    queue = f"record-{uuid.uuid4().hex[:8]}"
    # Unsandboxed: the old versions here are made up on the spot, not imported from a module.
    async with Worker(client, task_queue=queue, workflows=[wf], workflow_runner=UnsandboxedWorkflowRunner()):
        handle = await client.start_workflow(wf.run, arg, id=f"{name}-{uuid.uuid4().hex[:4]}", task_queue=queue)
        await handle.result()
        history = await handle.fetch_history()
    (OUT / f"{name}.json").write_text(history.to_json())
    print(f"wrote {(OUT / f'{name}.json').relative_to(ROOT)}")


def language_before_the_email(language: str) -> Path:
    """A copy of a language's hello with every TODO solved but F12's: its hold has no email step.
    Returns the root to point QUEST_LANGS_ROOT at."""
    app = ROOT / "langs" / language / "hello"
    if not app.exists():
        sys.exit(f"No {language} hello to record: langs/{language}/hello doesn't exist yet.")
    tmp = Path(tempfile.mkdtemp(prefix="record-"))
    skip = shutil.ignore_patterns("node_modules", "build", "bin", "obj", ".gradle", "lib")
    shutil.copytree(app, tmp / language / "hello", ignore=skip)
    if (app / "node_modules").exists():
        (tmp / language / "hello" / "node_modules").symlink_to(app / "node_modules")
    solved = todo_modules() - {"F12"}
    for master in masters():
        if language_of(master, AUTHORING) == language:
            out = tmp / master.relative_to(AUTHORING / "langs")
            out.write_text(render(master.read_text(), solved))
    return tmp


async def record_language(language: str) -> None:
    out = OUT / language
    os.environ.update(QUEST_LANG=language, QUEST_LANGS_ROOT=str(language_before_the_email(language)))
    sys.path.insert(0, str(ROOT))
    from hello.shared import HoldRequest
    from tests import langs

    async with await WorkflowEnvironment.start_local(data_converter=pydantic_data_converter) as env:
        queue = langs.queue("record")
        try:
            async with langs.hello_worker(env.client, queue):
                hold = HoldRequest(seat="14C", seconds=1)
                workflow_id = f"hold-14c-{uuid.uuid4().hex[:4]}"
                handle = await env.client.start_workflow("FareHoldWorkflow", hold, id=workflow_id, task_queue=queue)
                await handle.result()
                history = await handle.fetch_history()
        finally:
            langs.stop_all()
    out.mkdir(parents=True, exist_ok=True)
    (out / "fare_hold_before_the_email.json").write_text(history.to_json())
    shutil.copy(OUT / "trip_that_waited_first.json", out / "trip_that_waited_first.json")
    print(f"wrote {out.relative_to(ROOT)}/: fare_hold_before_the_email.json, trip_that_waited_first.json (Python's)")


async def main() -> None:
    if "--lang" in sys.argv and (language := sys.argv[sys.argv.index("--lang") + 1]) != "python":
        return await record_language(language)
    OUT.mkdir(parents=True, exist_ok=True)
    hold_wf = hold_before_the_email()
    from hello.shared import HoldRequest, TripRequest

    async with await WorkflowEnvironment.start_local(data_converter=pydantic_data_converter) as env:
        await record(env.client, hold_wf, HoldRequest(seat="14C", seconds=1), "fare_hold_before_the_email")
        trip = TripRequest(origin="SFO", destination="JFK")
        await record(env.client, TripThatWaitedFirst, trip, "trip_that_waited_first")


if __name__ == "__main__":
    asyncio.run(main())
