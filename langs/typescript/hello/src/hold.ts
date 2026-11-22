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

  // An update: a message that changes the workflow, and gets an answer back. Its validator runs
  // first, and a payment it rejects is never written to the history.
  setHandler(
    pay,
    (payment) => {
      paidWith = payment.card;
      return `Paid for seat ${hold.seat}.`;
    },
    {
      validator: (payment) => {
        if (!/^\d{4}$/.test(payment.card)) throw new Error(`give the card's last four digits, not '${payment.card}'`);
        if (paidWith !== undefined) throw new Error(`seat ${hold.seat} is already paid for`);
      },
    },
  );

  // A step added while holds were already running. patched() is true for a run that reaches this
  // line on the new code, and false when replaying a run that got past it without the step: so an
  // old hold carries on as it was, and every new one sends the email.
  if (patched('email-the-hold')) {
    await send_hold_email(hold);
  }

  // Wait until the seat is paid for, or until the hold runs out, whichever comes first.
  // The timeout is a durable timer: Temporal keeps it, so it fires even with no worker running.
  const paid = await condition(() => paidWith !== undefined, seconds * 1000);
  if (!paid) return `Seat ${hold.seat}: the hold expired, and the seat is back on sale.`;
  return `Seat ${hold.seat}: paid with the card ending ${paidWith}. It's yours.`;
}
