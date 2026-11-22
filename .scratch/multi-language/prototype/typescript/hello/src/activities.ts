// The activities: the one place these workflows touch the outside world. With FLAKY=1 the lookup
// fails four attempts out of five, so you can watch Temporal retry it.
import { activityInfo, log } from '@temporalio/activity';
import type { Airport } from './shared';

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
