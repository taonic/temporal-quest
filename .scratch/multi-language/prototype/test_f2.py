"""Prototype (ticket 02): F2's three checks from tests/test_ch01_hello.py, against any language.

The assertions are the Python checks' own. What changed: the worker is the language's, run as a
subprocess, the workflow is started by its contract name, and FLAKY_FAILURES is an env var
instead of a monkeypatch.

    QUEST_LANG=java uv run pytest .scratch/multi-language/prototype/test_f2.py
"""

import asyncio
import uuid

import pytest
from temporalio.client import Client
from temporalio.contrib.pydantic import pydantic_data_converter

import langs
from hello.shared import TripRequest

TODO_HINT = "Is the F2 TODO done? The workflow never finished."


async def _run(env, lang, origin="SFO", destination="JFK", worker_env=None):
    client = await Client.connect(env.client.service_client.config.target_host, namespace=env.client.namespace,
                                  data_converter=pydantic_data_converter)
    queue = f"hello-{uuid.uuid4().hex[:8]}"
    workflow_id = f"hello-test-{uuid.uuid4().hex[:8]}"
    async with langs.worker(lang, client, queue, worker_env):
        handle = await client.start_workflow("HelloTripWorkflow", TripRequest(origin=origin, destination=destination),
                                             id=workflow_id, task_queue=queue, result_type=str)
        try:
            result = await asyncio.wait_for(handle.result(), timeout=15)
        except TimeoutError:
            pytest.fail(TODO_HINT)
    return result, client, workflow_id


async def test_describes_the_trip(env, lang):
    result, _, _ = await _run(env, lang)
    assert result == "Your trip: San Francisco (SFO) to New York (JFK)."


async def test_retries_a_failed_activity(env, lang):
    result, client, workflow_id = await _run(env, lang, "LAX", "ORD", {"FLAKY": "1", "FLAKY_FAILURES": "1"})
    assert result == "Your trip: Los Angeles (LAX) to Chicago (ORD)."
    history = await client.get_workflow_handle(workflow_id).fetch_history()
    started = [e.activity_task_started_event_attributes.attempt for e in history.events
               if e.HasField("activity_task_started_event_attributes")]
    assert started == [2, 2], f"expected each lookup to succeed on attempt 2, saw attempts {started}"


async def test_uses_a_retry_policy_with_a_gentle_backoff(env, lang):
    _, client, workflow_id = await _run(env, lang)
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
