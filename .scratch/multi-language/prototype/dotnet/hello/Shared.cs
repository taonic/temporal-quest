namespace Hello;

// What the workflow, activity, worker and starter share. On the wire their fields are camelCase
// (origin, destination), the contract's names: Program.cs's converter maps them.
public record TripRequest(string Origin, string Destination);

public record Airport(string Code, string Name, string City);
