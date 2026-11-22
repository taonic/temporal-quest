"""Prototype (ticket 02): F2's checks with the check-time fixes.

One worker in the learner's language for the whole check, with only workflows (all of
Fundamentals' TODOs are workflow code), and the activities in Python, in process. So the FLAKY test
monkeypatches Python's activity exactly as tests/test_ch01_hello.py does.

    QUEST_LANG=typescript-tsx .venv/bin/python -m pytest --rootdir . .scratch/multi-language/prototype/test_f2_split.py
"""

import asyncio
import uuid

import pytest
import pytest_asyncio
from temporalio.client import Client
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.worker import Worker

import langs
from hello import activities
from hello.shared import TripRequest

TODO_HINT = "Is the F2 TODO done? The workflow never finished."


@pytest_asyncio.fixture(scope="session")
async def client(env):
    return await Client.connect(env.client.service_client.config.target_host, namespace=env.client.namespace,
                                data_converter=pydantic_data_converter)


@pytest_asyncio.fixture(scope="session")
async def queue(client, lang):
    """The learner's workflows, in their language, on a queue for this check."""
    queue = f"hello-{uuid.uuid4().hex[:8]}"
    async with langs.worker(lang, client, queue, mode="workflows"):
        yield queue


async def _run(client, queue, origin="SFO", destination="JFK"):
    workflow_id = f"hello-test-{uuid.uuid4().hex[:8]}"
    async with Worker(client, task_queue=queue, activities=[activities.lookup_airport]):
        handle = await client.start_workflow("HelloTripWorkflow", TripRequest(origin=origin, destination=destination),
                                             id=workflow_id, task_queue=queue, result_type=str)
        try:
            result = await asyncio.wait_for(handle.result(), timeout=15)
        except TimeoutError:
            pytest.fail(TODO_HINT)
    return result, workflow_id


async def test_describes_the_trip(client, queue):
    result, _ = await _run(client, queue)
    assert result == "Your trip: San Francisco (SFO) to New York (JFK)."


async def test_retries_a_failed_activity(client, queue, monkeypatch):
    monkeypatch.setenv("FLAKY", "1")
    monkeypatch.setattr(activities, "FLAKY_FAILURES", 1)
    result, workflow_id = await _run(client, queue, "LAX", "ORD")
    assert result == "Your trip: Los Angeles (LAX) to Chicago (ORD)."
    history = await client.get_workflow_handle(workflow_id).fetch_history()
    started = [e.activity_task_started_event_attributes.attempt for e in history.events
               if e.HasField("activity_task_started_event_attributes")]
    assert started == [2, 2], f"expected each lookup to succeed on attempt 2, saw attempts {started}"


async def test_uses_a_retry_policy_with_a_gentle_backoff(client, queue):
    _, workflow_id = await _run(client, queue)
    history = await client.get_workflow_handle(workflow_id).fetch_history()
    scheduled = [e.activity_task_scheduled_event_attributes for e in history.events
                 if e.HasField("activity_task_scheduled_event_attributes")]
    assert scheduled, TODO_HINT
    for attrs in scheduled:
        assert attrs.activity_type.name == "lookup_airport", "the contract's activity name"
        assert attrs.start_to_close_timeout.ToSeconds() == 10, "give each attempt 10 seconds (start_to_close_timeout)"
        policy = attrs.retry_policy
        assert policy.initial_interval.ToSeconds() == 2, "set the RetryPolicy's initial_interval to 2 seconds"
        assert policy.backoff_coefficient == 2, "set the RetryPolicy's backoff_coefficient to 2"
        assert policy.maximum_interval.ToSeconds() == 6, "set the RetryPolicy's maximum_interval to 6 seconds"
