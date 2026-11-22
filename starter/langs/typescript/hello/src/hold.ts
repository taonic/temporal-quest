// A fare hold: a seat kept for you for a while, then let go.
//
//   npm run hold -- 12A [SECONDS]
//   npm run pay -- 12A 4242
//
// The hold waits for whichever comes first: a payment, or the end of the hold. Its id is the seat
// (hold-12a-…), so there's one hold a seat, and `npm run pay` finds it by the seat.
import { condition, defineQuery, defineUpdate, patched, proxyActivities, setHandler, workflowInfo } from '@temporalio/workflow';
import type * as activities from './activities';
import type { HoldRequest, HoldStatus, Payment } from './shared';

const { send_hold_email } = proxyActivities<typeof activities>({ startToCloseTimeout: '10 seconds' });

// A query: read the hold's state, without changing it.
export const status = defineQuery<HoldStatus>('status');
// An update: pay for the seat, and get an answer back.
export const pay = defineUpdate<string, [Payment]>('pay');

export async function FareHoldWorkflow(hold: HoldRequest): Promise<string> {
  const seconds = hold.seconds ?? 60;
  // Date.now() in a workflow is the time in the history, not the machine's clock: the same on replay.
  const expiresAt = Date.now() + seconds * 1000;
  // The card it was paid with, once it is.
  let paidWith: string | undefined;
  setHandler(status, () => ({
    seat: hold.seat,
    paid: paidWith !== undefined,
    remaining: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  }));

  // TODO(ch06): handle the pay update: record the payment's card in paidWith, and return a
  // confirmation. Give it a validator that rejects a card that isn't four digits.

  // TODO(ch06): email the traveller that the seat is held, with the send_hold_email activity,
  // without breaking the holds that started before this step existed.

  // TODO(ch06): wait until the seat is paid for (paidWith), or the hold's seconds run out:
  //   const paid = await condition(() => ..., seconds * 1000);
  // condition() returns false when the time runs out: return that the hold expired. Otherwise,
  // return that the seat is paid for.
  throw new Error('TODO(ch06): wait for a payment, or for the hold to run out');
}
