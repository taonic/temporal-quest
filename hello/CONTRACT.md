# The hello wire contract

Fundamentals runs in Python, TypeScript, Java and .NET. Every language's `hello` puts the **same names and the same JSON** on the wire, so one Python test suite checks them all, one scenario runs each challenge, and a client in any language can start a workflow in any other. This file is that list. [ADR 0002](../docs/adr/0002-one-wire-contract-python-checks.md) says why.

`tests/test_contract.py` drives every workflow below by these names, with plain JSON and no shared models, and checks the answers and the history. A change here is a change in every language.

## Workers

- **Task queue:** `hello`.
- **Payloads:** JSON (`json/plain`). Field names are exactly as below: single lowercase words, so no language needs to rename one. .NET's converter uses camelCase (`JsonSerializerDefaults.Web`) to get them.
- **Worker settings** (the other languages; Python's checks call `build_worker(client, queue)` instead):
  - `HELLO_TASK_QUEUE`: the queue, `hello` by default. Not `TASK_QUEUE`, which `.env` sets for the travel agent.
  - `WORKER_MODE`: `all` (default), `workflows` or `activities`. The checks and challenges run the learner's workflows with Python's activities.
  - `TEMPORAL_ADDRESS` (`localhost:7233`) and `TEMPORAL_NAMESPACE` (`default`).
  - `FLAKY=1`: `lookup_airport` fails its first `FLAKY_FAILURES` attempts (default 4).
- **Replay** (the other languages): a `replay --history FILE` command replays a history file on the workflow code, and exits 0 when it replays, 1 when the code no longer matches it (nondeterminism), and anything else for anything else, such as an open TODO. With `--provided`, it replays with the SDK's replayer instead of the learner's own (F13's TODO): F12's check does that, so it needs only F12 solved, and F13's checks replay with theirs. How each language runs its worker and its replay is in `tests/langs.py`.

## Payloads

| Type | Fields |
|---|---|
| `TripRequest` | `origin`: string, `destination`: string (airport codes) |
| `Airport` | `code`, `name`, `city`: strings |
| `BoardingRequest` | `origin`, `destination`: strings; `seats`: int, default 40; `pace`: number, seconds between passengers, default 2 |
| `BoardingStatus` | `flight`: string (`SFO→JFK`); `boarded`, `seats`: ints |
| `HoldRequest` | `seat`: string; `seconds`: number, how long the hold lasts, default 60 |
| `HoldStatus` | `seat`: string; `paid`: bool; `remaining`: int, seconds until the hold runs out |
| `Payment` | `card`: string, the card's last four digits |
| `Itinerary` | `stops`: list of airport codes; `SFO JFK LHR` is two legs |
| `Booking` | `origin`, `destination`, `card`: strings |
| `BookingStatus` | `card`: string; `waiting`: bool, waiting for a new card because this one expired |

## Workflows

| Workflow type | Input | Result | Messages |
|---|---|---|---|
| `HelloTripWorkflow` | `TripRequest` | `"Your trip: San Francisco (SFO) to New York (JFK)."` | |
| `BoardingWorkflow` | `BoardingRequest` | `"Flight SFO→JFK: 40 passengers boarded."` | query `boarded` → `BoardingStatus` |
| `FareHoldWorkflow` | `HoldRequest` | `"Seat 12A: paid with the card ending 4242. It's yours."`, or `"Seat 12A: the hold expired, and the seat is back on sale."` | update `pay(Payment)` → `"Paid for seat 12A."`, rejected by its validator when the card isn't four digits or the seat is paid for; query `status` → `HoldStatus` |
| `ItineraryWorkflow` | `Itinerary` | a list of each leg's `HelloTripWorkflow` result, in order | |
| `BookTripWorkflow` | `Booking` | `"Booked FL-SFOJFK and HT-JFK, paid with the card ending 4242."` | update `new_card(Payment)` → `"Charging the card ending 4242."`, rejected unless the booking is waiting, the card is four digits and isn't the expired one; query `status` → `BookingStatus` |

- **`ItineraryWorkflow`** starts a child `HelloTripWorkflow` for each leg, all at once, with the id `<its own id>-leg-<n>`, from 1.
- **`FareHoldWorkflow`**'s email step (F12) is behind the patch `email-the-hold`. Java's `Workflow.getVersion` writes a different marker from the Core-based SDKs' `patched`, so recorded histories are kept per language (`tests/histories/<lang>/`).
- **`BookTripWorkflow`** runs `reserve_flight`, `reserve_hotel`, then `charge_card`. When the charge fails, it cancels what it reserved, newest first (`cancel_hotel`, then `cancel_flight`), and fails. When the error is `CardExpired`, it waits for a `new_card` and charges that instead.

## Activities

| Activity | Input | Result |
|---|---|---|
| `lookup_airport` | an airport code | `Airport`; fails for an unknown code, and with `FLAKY=1` (above) |
| `send_hold_email` | `HoldRequest` | nothing |
| `reserve_flight` | `Booking` | `"FL-<origin><destination>"` |
| `reserve_hotel` | `Booking` | `"HT-<destination>"` |
| `charge_card` | `Booking` | `"PAY-<card>"`. Card `0000` fails with a non-retryable `CardDeclined` error, and card `1111` with a non-retryable `CardExpired` |
| `cancel_flight` | a reservation (`FL-…`) | nothing |
| `cancel_hotel` | a reservation (`HT-…`) | nothing |

Activity names are snake_case, as Python names them. Java and .NET set the name on the activity (`@ActivityMethod(name = "lookup_airport")`, `[Activity("lookup_airport")]`), so learners' code calls `lookupAirport` or `LookupAirportAsync`. TypeScript names an activity after its function, so its functions keep the snake_case name.
