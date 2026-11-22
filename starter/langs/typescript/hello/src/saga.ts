// A booking, as a saga: reserve a flight and a hotel, then charge the card.
//
//   npm run book -- SFO JFK 4242
//   npm run book -- SFO JFK 0000     (a card that's declined)
//   npm run book -- SFO JFK 1111     (a card that's expired)
//
// There's no transaction across an airline, a hotel and a bank. So each step that succeeds adds
// the step that undoes it, and when a later step fails, the saga runs those, newest first.
import {
  ActivityFailure,
  ApplicationFailure,
  condition,
  defineQuery,
  defineUpdate,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';
import type * as activities from './activities';
import type { Booking, BookingStatus, Payment } from './shared';

const { reserve_flight, reserve_hotel, charge_card, cancel_flight, cancel_hotel } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
});

// A query: which card it charges, and whether it's waiting for a new one.
export const status = defineQuery<BookingStatus>('status');
// An update: the traveller's new card.
export const newCard = defineUpdate<string, [Payment]>('new_card');

export async function BookTripWorkflow(booking: Booking): Promise<string> {
  // The card it charges: the traveller's new one, once they give it.
  let card = booking.card;
  // True while the card has expired and the booking waits for a new one.
  let waitingForNewCard = false;
  setHandler(status, () => ({ card, waiting: waitingForNewCard }));

  // TODO(ch06): handle the new_card update, with a validator. The update takes a Payment, sets card
  // to its card, clears waitingForNewCard, and returns "Charging the card ending ....". The validator
  // turns away a card while the booking isn't waiting for one, a card that isn't four digits, and
  // the card that expired.

  // What to run to undo each step that succeeded, newest first.
  const undo: Array<() => Promise<void>> = [];
  let flight = '';
  let hotel = '';
  try {
    flight = await reserve_flight(booking);
    undo.unshift(() => cancel_flight(flight));
    hotel = await reserve_hotel(booking);
    undo.unshift(() => cancel_hotel(hotel));
    // TODO(ch06): an expired card shouldn't undo the trip. Charge the card in a loop: when
    // charge_card fails with a CardExpired error, set waitingForNewCard, wait until the new_card
    // update clears it, and charge the new card. Throw any other error again.
    await charge_card(booking);
  } catch (err) {
    if (!(err instanceof ActivityFailure)) throw err;
    // TODO(ch06): a step failed. Undo the steps that succeeded: call each function in `undo`, in
    // order (newest first), then throw the error again.
    throw err;
  }
  return `Booked ${flight} and ${hotel}, paid with the card ending ${booking.card}.`;
}
