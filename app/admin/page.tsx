import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { getAdminListings } from '@/lib/admin-queries';
import { toggleLockAction } from './actions';
import { isRemoteStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const formatDate = (date: Date | null) =>
  date
    ? new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();

  const [{ saved }, rows] = await Promise.all([searchParams, getAdminListings()]);

  const locked = rows.filter((r) => r.listing.downloadLocked).length;

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="kicker">Listings</span>
          <h1>
            {rows.length} {rows.length === 1 ? 'listing' : 'listings'}
            {locked > 0 && <span className="admin-title-sub"> · {locked} locked</span>}
          </h1>
        </div>
        <Link className="btn btn-primary" href="/admin/listings/new">
          New listing
        </Link>
      </div>

      {saved && <p className="admin-flash">Saved.</p>}

      {rows.length === 0 ? (
        <p className="admin-empty">
          No listings yet. <Link href="/admin/listings/new">Add the first one.</Link>
        </p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Client</th>
                <th>Shoot</th>
                <th>Media</th>
                <th>Downloads</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ listing, client, mediaCount }) => (
                <tr key={listing.id}>
                  <td>
                    <Link className="admin-strong" href={`/admin/listings/${listing.id}`}>
                      {listing.address}
                    </Link>
                    <span className="admin-muted">/portal/{listing.slug}</span>
                  </td>
                  <td>
                    {client ? (
                      <Link href={`/admin/clients/${client.id}`}>
                        {client.company || client.name || client.email}
                      </Link>
                    ) : (
                      <span className="admin-muted">Unassigned</span>
                    )}
                  </td>
                  <td>{formatDate(listing.shootDate)}</td>
                  <td>{mediaCount}</td>
                  <td>
                    {/* The gate itself, one click. Stripe will drive this later. */}
                    <form action={toggleLockAction}>
                      <input type="hidden" name="id" value={listing.id} />
                      <input
                        type="hidden"
                        name="locked"
                        value={listing.downloadLocked ? 'false' : 'true'}
                      />
                      <button
                        className={listing.downloadLocked ? 'admin-lock' : 'admin-unlock'}
                        type="submit"
                      >
                        {listing.downloadLocked ? 'Locked' : 'Unlocked'}
                      </button>
                    </form>
                  </td>
                  <td className="admin-row-end">
                    <Link href={`/portal/${listing.slug}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Two different truths depending on where the bytes live, and the
          difference matters enough to say out loud rather than average over. */}
      <p className="admin-note">
        Locked means watermarked previews and no download buttons, and the
        download route enforces it server-side — ownership and lock are both
        re-checked there, so hiding the buttons is not what stops anyone.
        {!isRemoteStorage() && (
          <>
            {' '}
            <strong>But media is not on R2 yet.</strong> The files are still
            plain URLs anyone can fetch without going through that route, so
            the lock is not yet protection. Connect R2 before real clients.
          </>
        )}
      </p>
    </>
  );
}
