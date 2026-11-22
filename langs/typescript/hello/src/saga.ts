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

  // The new_card update: it clears the flag the charge loop waits on. Its validator runs first,
  // and a card it turns away is never written to the history.
  setHandler(
    newCard,
    (payment) => {
      card = payment.card;
      waitingForNewCard = false;
      return `Charging the card ending ${payment.card}.`;
    },
    {
      validator: (payment) => {
        if (!waitingForNewCard) throw new Error("this booking isn't waiting for a new card");
        if (!/^\d{4}$/.test(payment.card)) throw new Error(`give the card's last four digits, not '${payment.card}'`);
        if (payment.card === card) throw new Error(`the card ending ${payment.card} is the one that expired`);
      },
    },
  );

  // What to run to undo each step that succeeded, newest first.
  const undo: Array<() => Promise<void>> = [];
  let flight = '';
  let hotel = '';
  try {
    flight = await reserve_flight(booking);
    undo.unshift(() => cancel_flight(flight));
    hotel = await reserve_hotel(booking);
    undo.unshift(() => cancel_hotel(hotel));
    // Charge the card. An expired one isn't the end: wait for the traveller's new card, for as
    // long as it takes, then charge that. Anything else goes on to the undo below.
    for (;;) {
      try {
        await charge_card(booking);
        break;
      } catch (err) {
        if (!(err instanceof ActivityFailure && err.cause instanceof ApplicationFailure && err.cause.type === 'CardExpired')) throw err;
        waitingForNewCard = true;
        await condition(() => !waitingForNewCard);
        booking = { ...booking, card };
      }
    }
  } catch (err) {
    if (!(err instanceof ActivityFailure)) throw err;
    // A step failed: undo the ones that succeeded, newest first, then fail the booking.
    // The undo steps are activities too, so they're retried, and survive a crash.
    for (const compensate of undo) await compensate();
    throw err;
  }
  return `Booked ${flight} and ${hotel}, paid with the card ending ${booking.card}.`;
}
