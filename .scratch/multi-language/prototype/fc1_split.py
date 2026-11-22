"""Prototype (ticket 02): FC1's choices in TypeScript, on a split worker.

The choice's workflow runs in a TypeScript worker that has only workflows, built from a temp copy
with the choice's block swapped in. The scenario's fake activity (SFO fails its first three
attempts) runs in a Python worker that has only activities, on the same task queue.

    uv run python .scratch/multi-language/prototype/fc1_split.py [A|C ...]
"""

import asyncio
import shutil
import sys
import tempfile
import time
import uuid
from pathlib import Path

from temporalio import activity
from temporalio.client import Client, WorkflowFailureError
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.exceptions import ApplicationError
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

sys.path.insert(0, str(Path(__file__).parent))
import langs  # noqa: E402
from hello.activities import AIRPORTS  # noqa: E402
from hello.shared import TripRequest  # noqa: E402

RIGHT = "Your trip: San Francisco (SFO) to New York (JFK)."
REPLACE_FROM = "  // Ask Temporal to run the activity."
REPLACE_TO = "  return await lookup_airport(code);\n"
CHOICES = {
    "A": """  // Three tries is plenty: if the database is still down, fail fast.
  const { lookup_airport } = proxyActivities<typeof activities>({
    startToCloseTimeout: '10 seconds',
    retry: { initialInterval: '2 seconds', backoffCoefficient: 2, maximumAttempts: 3 },
  });
  return await lookup_airport(code);
""",
    "C": """  // Retry failures, waiting 2s, then twice as long each time, up to 6s between attempts.
  const { lookup_airport } = proxyActivities<typeof activities>({
    startToCloseTimeout: '10 seconds',
    retry: { initialInterval: '2 seconds', backoffCoefficient: 2, maximumInterval: '6 seconds' },
  });
  return await lookup_airport(code);
""",
}


LANG = langs.LANGS[__import__("os").environ.get("QUEST_LANG", "typescript")]


def variant(choice: str) -> Path:
    lang = LANG
    tmp = Path(tempfile.mkdtemp(prefix=f"fc1-{choice}-"))
    shutil.copytree(lang.dir, tmp, ignore=shutil.ignore_patterns("node_modules", "lib", "*.tsbuildinfo"), dirs_exist_ok=True)
    (tmp / "node_modules").symlink_to(lang.dir / "node_modules")
    src = tmp / "src/workflows.ts"
    text = src.read_text()
    start, end = text.index(REPLACE_FROM), text.index(REPLACE_TO) + len(REPLACE_TO)
    src.write_text(text[:start] + CHOICES[choice] + text[end:])
    return tmp


@activity.defn(name="lookup_airport")
async def lookup_airport(code: str):
    attempt = activity.info().attempt
    if code == "SFO" and attempt <= 3:
        print(f"    lookup {code}, attempt {attempt}: 503")
        raise ApplicationError(f"503: the airport database is overloaded ({code}, attempt {attempt})")
    print(f"    lookup {code}, attempt {attempt}: found it")
    return AIRPORTS[code]


async def run(env, choice: str) -> None:
    lang = LANG
    t0 = time.monotonic()
    tmp = variant(choice)
    langs.build(lang, cwd=tmp)
    print(f"  choice {choice}: built in {time.monotonic() - t0:.1f}s")
    client = await Client.connect(env.client.service_client.config.target_host, namespace=env.client.namespace,
                                  data_converter=pydantic_data_converter)
    queue = f"fc1-{uuid.uuid4().hex[:8]}"
    async with Worker(client, task_queue=queue, activities=[lookup_airport]):
        async with langs.worker(lang, client, queue, cwd=tmp, mode="workflows"):
            print(f"  workers ready at {time.monotonic() - t0:.1f}s")
            handle = await client.start_workflow("HelloTripWorkflow", TripRequest(origin="SFO", destination="JFK"),
                                                 id=f"fc1-{choice}-{uuid.uuid4().hex[:6]}", task_queue=queue, result_type=str)
            try:
                value = await asyncio.wait_for(handle.result(), timeout=18)
                verdict = "right" if value == RIGHT else "wrong"
                print(f"  completed: {value} -> {verdict}")
            except WorkflowFailureError as e:
                print(f"  failed: {e.cause} -> wrong")
    print(f"  total {time.monotonic() - t0:.1f}s")
    shutil.rmtree(tmp)


async def main() -> None:
    async with await WorkflowEnvironment.start_local() as env:
        for choice in sys.argv[1:] or ["A", "C"]:
            await run(env, choice)


if __name__ == "__main__":
    asyncio.run(main())
