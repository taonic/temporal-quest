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

export interface HoldRequest {
  seat: string;
  // How long the hold lasts, in seconds.
  seconds?: number;
}

export interface HoldStatus {
  seat: string;
  paid: boolean;
  // Seconds until the hold runs out.
  remaining: number;
}

export interface Payment {
  // The card's last four digits: all a hold needs to show it's paid.
  card: string;
}

export interface Itinerary {
  // Airport codes, in order: SFO JFK LHR is two legs, SFO→JFK and JFK→LHR.
  stops: string[];
}

export interface Booking {
  origin: string;
  destination: string;
  card: string;
}

export interface BookingStatus {
  // The card it charges, and whether it's waiting for a new one because that card has expired.
  card: string;
  waiting: boolean;
}
