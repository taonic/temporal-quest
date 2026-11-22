// What the workflow, activity, worker and starter share. The field names are the wire contract's:
// a Python client starts this workflow, and a Python check reads its result.

export interface TripRequest {
  origin: string;
  destination: string;
}

export interface Airport {
  code: string;
  name: string;
  city: string;
}
