// What the workflows, activities, worker and starter share. The field names are the wire
// contract's (hello/CONTRACT.md): a Python client starts these workflows, and the checks read them.

export interface TripRequest {
  origin: string;
  destination: string;
}

export interface Airport {
  code: string;
  name: string;
  city: string;
}

export interface BoardingRequest {
  origin: string;
  destination: string;
  seats?: number;
  // Seconds between passengers boarding.
  pace?: number;
}

export interface BoardingStatus {
  flight: string;
  boarded: number;
  seats: number;
}
