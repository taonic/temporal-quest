import pytest_asyncio
from temporalio.testing import WorkflowEnvironment

import langs


@pytest_asyncio.fixture(scope="session")
async def env():
    async with await WorkflowEnvironment.start_local() as env:
        yield env


@pytest_asyncio.fixture(scope="session")
async def lang():
    """The language under test, built once for the session (an incremental build when it's warm)."""
    lang = langs.current()
    langs.build(lang)
    return lang
