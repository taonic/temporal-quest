package hello;

import io.temporal.activity.ActivityInterface;
import io.temporal.activity.ActivityMethod;

/** The activities: the one place these workflows touch the outside world. */
@ActivityInterface
public interface Activities {
    // The activity's name is the wire contract's: Java would call it LookupAirport otherwise.
    @ActivityMethod(name = "lookup_airport")
    Airport lookupAirport(String code);
}
