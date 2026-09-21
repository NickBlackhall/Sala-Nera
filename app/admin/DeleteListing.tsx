'use client';

import { deleteListingAction } from './actions';

/**
 * Deleting a listing cascades its media rows and its download history, and
 * removes the uploaded files behind them. The confirm is here rather than in
 * the action because a server action cannot ask.
 */
export default function DeleteListing({
  id,
  address,
  mediaCount,
}: {
  id: number;
  address: string;
  mediaCount: number;
}) {
  return (
    <section className="admin-danger">
      <h2>Delete listing</h2>
      <p>
        Removes {address} from the portal, along with{' '}
        {mediaCount === 1 ? 'its 1 photo or video' : `all ${mediaCount} of its photos and videos`}{' '}
        and the uploaded files behind them. This cannot be undone.
      </p>
      <form
        action={deleteListingAction}
        onSubmit={(e) => {
          if (!confirm(`Delete ${address}? This cannot be undone.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button className="btn admin-danger-btn" type="submit">
          Delete listing
        </button>
      </form>
    </section>
  );
}
