"""The hello wire contract (hello/CONTRACT.md): every workflow, message and activity by its name,
with plain JSON payloads, as a client in another language would send them.

The worker is the language's (QUEST_LANG, tests/langs.py), with its own activities: the module
checks run Python's activities, so this test is what keeps every language's activities matching.
"""

import asyncio
import contextlib
import uuid

import pytest
import pytest_asyncio
from temporalio.client import Client, WorkflowFailureError, WorkflowUpdateFailedError
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.exceptions import ActivityError, ApplicationError

from tests import langs


@pytest_asyncio.fixture
async def plain(env) -> Client:
    """A client with no shared models: payloads are plain JSON, field names and all."""
    return await Client.connect(env.client.service_client.config.target_host, namespace=env.client.namespace)


@contextlib.asynccontextmanager
async def hello_worker(env):
    """A hello worker in the language under test, with its own activities."""
    client = await Client.connect(
        env.client.service_client.config.target_host,
        namespace=env.client.namespace,
        data_converter=pydantic_data_converter,
    )
    queue = langs.queue("contract")
    async with langs.hello_worker(client, queue, own_activities=True):
        yield queue


def wid(name: str) -> str:
    return f"{name}-{uuid.uuid4().hex[:6]}"


async def activities_run(handle) -> list[str]:
    history = await handle.fetch_history()
    return [
        e.activity_task_scheduled_event_attributes.activity_type.name
        for e in history.events
        if e.HasField("activity_task_scheduled_event_attributes")
    ]


async def until(check, timeout=10):
    async def poll():
        while not await check():
            await asyncio.sleep(0.2)

    await asyncio.wait_for(poll(), timeout)


async def test_hello_trip(env, plain):
    async with hello_worker(env) as queue:
        handle = await plain.start_workflow(
            "HelloTripWorkflow",
            {"origin": "SFO", "destination": "JFK"},
            id=wid("trip"),
            task_queue=queue,
            result_type=str,
        )
        assert await handle.result() == "Your trip: San Francisco (SFO) to New York (JFK)."
        assert await activities_run(handle) == ["lookup_airport", "lookup_airport"]


async def test_boarding(env, plain):
    async with hello_worker(env) as queue:
        handle = await plain.start_workflow(
            "BoardingWorkflow",
            {"origin": "SFO", "destination": "JFK", "seats": 2, "pace": 0.5},
            id=wid("board"),
            task_queue=queue,
            result_type=str,
        )
        status = await handle.query("boarded", result_type=dict)
        assert set(status) == {"flight", "boarded", "seats"}
        assert status["flight"] == "SFO→JFK" and status["seats"] == 2
        assert await handle.result() == "Flight SFO→JFK: 2 passengers boarded."


async def test_fare_hold(env, plain):
    async with hello_worker(env) as queue:
        handle = await plain.start_workflow(
            "FareHoldWorkflow", {"seat": "12A", "seconds": 30}, id=wid("hold-12a"), task_queue=queue, result_type=str
        )
        status = await handle.query("status", result_type=dict)
        assert set(status) == {"seat", "paid", "remaining"}
        assert status["seat"] == "12A" and status["paid"] is False and 0 < status["remaining"] <= 30
        with pytest.raises(WorkflowUpdateFailedError):
            await handle.execute_update("pay", {"card": "42"}, result_type=str)
        assert await handle.execute_update("pay", {"card": "4242"}, result_type=str) == "Paid for seat 12A."
        assert await handle.result() == "Seat 12A: paid with the card ending 4242. It's yours."
        assert (await handle.query("status", result_type=dict))["paid"] is True
        assert await activities_run(handle) == ["send_hold_email"]


async def test_itinerary(env, plain):
    async with hello_worker(env) as queue:
        workflow_id = wid("itinerary")
        handle = await plain.start_workflow(
            "ItineraryWorkflow", {"stops": ["SFO", "JFK", "LHR"]}, id=workflow_id, task_queue=queue, result_type=list
        )
        assert await handle.result() == [
            "Your trip: San Francisco (SFO) to New York (JFK).",
            "Your trip: New York (JFK) to London (LHR).",
        ]
        history = await handle.fetch_history()
        children = [
            e.start_child_workflow_execution_initiated_event_attributes
            for e in history.events
            if e.HasField("start_child_workflow_execution_initiated_event_attributes")
        ]
        assert [(c.workflow_type.name, c.workflow_id) for c in children] == [
            ("HelloTripWorkflow", f"{workflow_id}-leg-1"),
            ("HelloTripWorkflow", f"{workflow_id}-leg-2"),
        ]


async def test_book_trip(env, plain):
    async with hello_worker(env) as queue:
        handle = await plain.start_workflow(
            "BookTripWorkflow",
            {"origin": "SFO", "destination": "JFK", "card": "4242"},
            id=wid("book"),
            task_queue=queue,
            result_type=str,
        )
        assert await handle.result() == "Booked FL-SFOJFK and HT-JFK, paid with the card ending 4242."
        assert await activities_run(handle) == ["reserve_flight", "reserve_hotel", "charge_card"]


async def test_a_declined_card_cancels_newest_first(env, plain):
    async with hello_worker(env) as queue:
        handle = await plain.start_workflow(
            "BookTripWorkflow",
            {"origin": "SFO", "destination": "JFK", "card": "0000"},
            id=wid("book"),
            task_queue=queue,
            result_type=str,
        )
        with pytest.raises(WorkflowFailureError) as failed:
            await handle.result()
        cause = failed.value.cause
        assert isinstance(cause, ActivityError) and isinstance(cause.cause, ApplicationError)
        assert cause.cause.type == "CardDeclined" and cause.cause.non_retryable
        assert await activities_run(handle) == [
            "reserve_flight",
            "reserve_hotel",
            "charge_card",
            "cancel_hotel",
            "cancel_flight",
        ]


async def test_an_expired_card_waits_for_a_new_one(env, plain):
    async with hello_worker(env) as queue:
        handle = await plain.start_workflow(
            "BookTripWorkflow",
            {"origin": "SFO", "destination": "JFK", "card": "1111"},
            id=wid("book"),
            task_queue=queue,
            result_type=str,
        )

        async def waiting():
            return (await handle.query("status", result_type=dict))["waiting"]

        await until(waiting)
        assert set(await handle.query("status", result_type=dict)) == {"card", "waiting"}
        with pytest.raises(WorkflowUpdateFailedError):
            await handle.execute_update("new_card", {"card": "1111"}, result_type=str)
        answer = await handle.execute_update("new_card", {"card": "4242"}, result_type=str)
        assert answer == "Charging the card ending 4242."
        assert await handle.result() == "Booked FL-SFOJFK and HT-JFK, paid with the card ending 4242."
