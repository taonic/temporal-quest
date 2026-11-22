"""A booking, as a saga: reserve a flight and a hotel, then charge the card.

    uv run hello-book SFO JFK 4242
    uv run hello-book SFO JFK 0000     (a card that's declined)
    uv run hello-book SFO JFK 1111     (a card that's expired)

There's no transaction across an airline, a hotel and a bank. So each step that succeeds adds
the step that undoes it, and when a later step fails, the saga runs those, newest first.
"""

from datetime import timedelta

from temporalio import workflow
from temporalio.exceptions import ActivityError, ApplicationError

with workflow.unsafe.imports_passed_through():
    from .activities import cancel_flight, cancel_hotel, charge_card, reserve_flight, reserve_hotel
    from .shared import Booking, BookingStatus, Payment

STEP = {"start_to_close_timeout": timedelta(seconds=10)}


@workflow.defn
class BookTripWorkflow:
    @workflow.init
    def __init__(self, booking: Booking) -> None:
        # The card it charges: the traveller's new one, once they give it.
        self.card = booking.card
        # True while the card has expired and the booking waits for a new one.
        self.waiting_for_new_card = False

    @workflow.run
    async def run(self, booking: Booking) -> str:
        # What to run to undo each step that succeeded, newest first.
        undo = []
        try:
            flight = await workflow.execute_activity(reserve_flight, booking, **STEP)
            undo.insert(0, (cancel_flight, flight))
            hotel = await workflow.execute_activity(reserve_hotel, booking, **STEP)
            undo.insert(0, (cancel_hotel, hotel))
            # TODO(ch06): an expired card shouldn't undo the trip. Charge the card in a loop: when
            # charge_card fails with a CardExpired error, set self.waiting_for_new_card, wait until
            # the new_card update clears it, and charge self.card. Re-raise any other error.
            await workflow.execute_activity(charge_card, booking, **STEP)
        except ActivityError:
            # TODO(ch06): a step failed. Undo the steps that succeeded: for each (activity, reservation)
            # in `undo`, run the activity with the reservation, then re-raise the error.
            raise
        return f"Booked {flight} and {hotel}, paid with the card ending {booking.card}."

    # TODO(ch06): the new_card update, and its validator. The update takes a Payment, sets
    # self.card to its card, clears self.waiting_for_new_card, and returns "Charging the card
    # ending ....". The validator turns away a card while the booking isn't waiting for one, a
    # card that isn't four digits, and the card that expired.

    # A query: which card it charges, and whether it's waiting for a new one.
    @workflow.query
    def status(self) -> BookingStatus:
        return BookingStatus(card=self.card, waiting_for_new_card=self.waiting_for_new_card)
