'use client';

import { cancelBookingAction } from './actions';

/**
 * Releasing a confirmed shoot's day.
 *
 * The confirm dialog lives here because a server action cannot ask one — same
 * reason as DeleteClient. It names the date deliberately: the one mistake
 * worth guarding against is cancelling the wrong row in a list where several
 * bookings look alike.
 */
export default function CancelBooking({ id, when, address }: { id: number; when: string; address: string }) {
  return (
    <form
      action={cancelBookingAction}
      onSubmit={(e) => {
        if (!confirm(`Cancel the shoot at ${address} on ${when}?\n\nThe day goes back on the market and can be booked by someone else. Its listing is removed too, unless you have uploaded anything to it.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="admin-linkbtn" type="submit">
        Cancel
      </button>
    </form>
  );
}
