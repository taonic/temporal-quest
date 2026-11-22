// The activities: the one place these workflows touch the outside world. A real lookup would call
// an airport database over the network, which can be slow or fail: with FLAKY=1 this one fails four
// attempts out of five, so you can watch Temporal retry it. The booking activities stand in for an
// airline, a hotel and a card network: they only log what they'd do.
import { activityInfo, ApplicationFailure, log } from '@temporalio/activity';
import type { Airport, Booking, HoldRequest } from './shared';

const AIRPORTS: Record<string, Airport> = {
  SFO: { code: 'SFO', name: 'San Francisco International', city: 'San Francisco' },
  JFK: { code: 'JFK', name: 'John F. Kennedy International', city: 'New York' },
  LAX: { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles' },
  ORD: { code: 'ORD', name: "O'Hare International", city: 'Chicago' },
  SEA: { code: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle' },
  LHR: { code: 'LHR', name: 'Heathrow', city: 'London' },
};

// With FLAKY=1, attempts 1 to 4 fail and attempt 5 gets through. The checks set FLAKY_FAILURES=1.
const FLAKY_FAILURES = Number(process.env.FLAKY_FAILURES ?? 4);

// The activity's name is the wire contract's (lookup_airport), so it's this function's name too:
// TypeScript names an activity after the function the worker registers.
export async function lookup_airport(code: string): Promise<Airport> {
  const { attempt } = activityInfo();
  log.info(`Looking up ${code} (attempt ${attempt})`);
  if (process.env.FLAKY === '1' && attempt <= FLAKY_FAILURES) {
    throw new Error(`503: the airport database is overloaded (${code}, attempt ${attempt}, FLAKY=1)`);
  }
  const airport = AIRPORTS[code.toUpperCase()];
  if (!airport) throw new Error(`unknown airport ${code}`);
  return airport;
}

export async function send_hold_email(hold: HoldRequest): Promise<void> {
  log.info(`Emailed the traveller: seat ${hold.seat} is held for ${hold.seconds ?? 60}s`);
}

// --- The booking saga: reserve a flight and a hotel, then charge the card ---------------------

// A card that always declines, so you can watch the saga undo what it already did.
export const DECLINED_CARD = '0000';
// A card that has expired, so you can watch the booking wait for the traveller's new one.
export const EXPIRED_CARD = '1111';

export async function reserve_flight(booking: Booking): Promise<string> {
  const reservation = `FL-${booking.origin}${booking.destination}`;
  log.info(`Reserved flight ${reservation}`);
  return reservation;
}

export async function reserve_hotel(booking: Booking): Promise<string> {
  const reservation = `HT-${booking.destination}`;
  log.info(`Reserved hotel ${reservation}`);
  return reservation;
}

export async function charge_card(booking: Booking): Promise<string> {
  if (booking.card === DECLINED_CARD) {
    // Retrying won't change the bank's mind: a non-retryable failure fails the activity at once,
    // instead of the retry policy trying it again.
    throw ApplicationFailure.nonRetryable(`card ending ${booking.card} was declined`, 'CardDeclined');
  }
  if (booking.card === EXPIRED_CARD) {
    // Final too: no retry brings an expired card back. But the traveller can give another one.
    throw ApplicationFailure.nonRetryable(`card ending ${booking.card} has expired`, 'CardExpired');
  }
  log.info(`Charged the card ending ${booking.card}`);
  return `PAY-${booking.card}`;
}

export async function cancel_flight(reservation: string): Promise<void> {
  log.info(`Cancelled flight ${reservation}`);
}

export async function cancel_hotel(reservation: string): Promise<void> {
  log.info(`Cancelled hotel ${reservation}`);
}
