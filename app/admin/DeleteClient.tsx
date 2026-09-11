'use client';

import { deleteClientAction } from './actions';

/**
 * Deleting a client does not touch their listings or bookings — each one's
 * clientId just becomes null, same as deleting a listing does to its media.
 * The confirm is here rather than in the action because a server action
 * cannot ask.
 */
export default function DeleteClient({
  id,
  email,
  listingCount,
}: {
  id: number;
  email: string;
  listingCount: number;
}) {
  return (
    <section className="admin-danger">
      <h2>Delete client</h2>
      <p>
        Removes {email} from the client list — they can no longer sign in.
        {listingCount > 0 && (
          <>
            {' '}
            Their {listingCount} {listingCount === 1 ? 'listing keeps' : 'listings keep'} existing
            but {listingCount === 1 ? "won't" : "won't"} have an owner until you set a new one.
          </>
        )}{' '}
        This cannot be undone.
      </p>
      <form
        action={deleteClientAction}
        onSubmit={(e) => {
          if (!confirm(`Delete ${email}? This cannot be undone.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button className="btn admin-danger-btn" type="submit">
          Delete client
        </button>
      </form>
    </section>
  );
}
