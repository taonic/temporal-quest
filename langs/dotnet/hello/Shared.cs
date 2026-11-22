namespace Hello;

// What the workflows, activities, worker and starter share. On the wire their fields are the
// contract's lowercase names (origin, not Origin): Config.Converter's web defaults map them. A
// field that may be left out is nullable.
public record TripRequest(string Origin, string Destination);

public record Airport(string Code, string Name, string City);

// Seats defaults to 40, and Pace (seconds between passengers) to 2.
public record BoardingRequest(string Origin, string Destination, int? Seats = null, double? Pace = null);

public record BoardingStatus(string Flight, int Boarded, int Seats);

// Seconds: how long the hold lasts, 60 by default.
public record HoldRequest(string Seat, double? Seconds = null);

// Remaining: seconds until the hold runs out.
public record HoldStatus(string Seat, bool Paid, int Remaining);

// The card's last four digits: all a hold needs to show it's paid.
public record Payment(string Card);

// Airport codes, in order: SFO JFK LHR is two legs, SFO→JFK and JFK→LHR.
public record Itinerary(List<string> Stops);

public record Booking(string Origin, string Destination, string Card);

// The card it charges, and whether it's waiting for a new one because that card has expired.
public record BookingStatus(string Card, bool Waiting);
