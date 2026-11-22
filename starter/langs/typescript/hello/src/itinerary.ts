// An itinerary: a trip of several legs, each its own workflow.   npm run itinerary -- SFO JFK LHR
//
// SFO JFK LHR is two legs, SFO→JFK and JFK→LHR. The itinerary starts a child workflow for each,
// all at once, and puts their answers together. Each child is a HelloTripWorkflow, with a history
// of its own.
import { executeChild, workflowInfo } from '@temporalio/workflow';
import type { Itinerary } from './shared';
import type { HelloTripWorkflow } from './workflows';

export async function ItineraryWorkflow(itinerary: Itinerary): Promise<string[]> {
  const legs = itinerary.stops.slice(1).map((destination, i) => [itinerary.stops[i], destination]);
  // Every leg at once: Promise.all waits for them all, and keeps their order.
  return await Promise.all(legs.map(([origin, destination], i) => leg(i + 1, origin, destination)));
}

async function leg(n: number, origin: string, destination: string): Promise<string> {
  // TODO(ch06): run this leg as a child HelloTripWorkflow, and return its answer:
  //   return await executeChild<typeof HelloTripWorkflow>('HelloTripWorkflow', { args: [...], workflowId: ... });
  // Give it an id made of this workflow's id (workflowInfo().workflowId) and the leg's number.
  throw new Error(`TODO(ch06): run the leg as a child workflow (${n}: ${origin} to ${destination})`);
}
