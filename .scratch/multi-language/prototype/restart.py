"""Prototype (ticket 02): a learner's worker restart after an edit (F3), from the edit until the
new worker polls: the build (if any) and the start.

    QUEST_LANG=java-tuned python restart.py FILE
"""

import asyncio
import sys
import time
import uuid
from pathlib import Path

from temporalio.client import Client

sys.path.insert(0, str(Path(__file__).parent))
import langs  # noqa: E402


async def main() -> None:
    lang = langs.current()
    path = lang.dir / sys.argv[1]
    original = path.read_text()
    client = await Client.connect("localhost:7233")
    try:
        for i in range(3):
            path.write_text(original + f"\n// edit {uuid.uuid4().hex}\n")
            start = time.monotonic()
            langs.build(lang)
            built = time.monotonic() - start
            async with langs.worker(lang, client, f"restart-{uuid.uuid4().hex[:6]}"):
                total = time.monotonic() - start
            print(f"restart {i + 1}: {total:.1f}s (build {built:.1f}s)")
            langs.record("restart", lang.id, total, build=round(built, 2))
    finally:
        path.write_text(original)


asyncio.run(main())
