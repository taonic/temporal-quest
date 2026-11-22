// The workflows: durable functions. Workflow code must be deterministic: Temporal may replay it
// from its history at any time, on any worker. So it never touches the outside world itself. It
// asks for that through activities, and Temporal records each result.
//
// The worker loads this file's exports as its workflows: the trip below, the boarding counter, the
// fare hold, the itinerary and the booking saga.
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';
import type { Airport, TripRequest } from './shared';

export { BoardingWorkflow } from './board';
export { FareHoldWorkflow } from './hold';
export { ItineraryWorkflow } from './itinerary';
export { BookTripWorkflow } from './saga';

// A trip: look up two airports, and describe it.
export async function HelloTripWorkflow(trip: TripRequest): Promise<string> {
  const origin = await airport(trip.origin);
  const destination = await airport(trip.destination);
  return `Your trip: ${origin.city} (${origin.code}) to ${destination.city} (${destination.code}).`;
}

async function airport(code: string): Promise<Airport> {
  // TODO(ch01): call the lookup_airport activity, with a 10-second startToCloseTimeout and a retry
  // policy: wait 2 seconds after a failure, twice as long each time, at most 6 seconds.
  throw new Error(`TODO(ch01): call the lookup_airport activity (${code})`);
}
