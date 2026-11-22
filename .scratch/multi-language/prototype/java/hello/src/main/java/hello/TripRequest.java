package hello;

/** What a trip workflow is started with. The field names are the wire contract's. */
public record TripRequest(String origin, String destination) {}
