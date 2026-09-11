import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { getRecentBookings, type AdminBookingRow } from '@/lib/admin-queries';
import { money } from '@/lib/quote';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  await requireAdmin();

  // A message rather than a crash in the gap between a deploy and the
  // migration that creates the table.
  let rows: AdminBookingRow[] | null = null;
  try {
    rows = await getRecentBookings();
  } catch (error) {
    console.error('admin/bookings: could not load bookings', error);
  }

  return (
    <>
      <div className="admin-title">
        <h1>Bookings</h1>
        <p>
          Every booking the form delivered, priced as it was quoted.{' '}
          <Link href="/admin">Back to listings</Link>
        </p>
      </div>

      {rows === null ? (
        <p className="admin-flash">
          The bookings table isn&rsquo;t in the database yet. Run the migration (see HANDOFF.md),
          then reload. Bookings still reach your inbox in the meantime.
        </p>
      ) : rows.length === 0 ? (
        <p className="admin-empty">
          No bookings saved yet. Each one the form delivers lands here, as well as in your inbox.
        </p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Property</th>
                <th>Services</th>
                <th>Estimate</th>
                <th>Date wanted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ booking, client }) => (
                <tr key={booking.id}>
                  <td className="ev-dim">
                    {new Date(booking.createdAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </td>
                  <td>
                    {client ? <Link href={`/admin/clients/${client.id}`}>{booking.name}</Link> : booking.name}
                    <br />
                    <span className="ev-dim">{booking.email}</span>
                  </td>
                  <td>
                    {booking.address}
                    {booking.sqft ? <span className="ev-dim"> · {booking.sqft.toLocaleString('en-US')} sq ft</span> : null}
                  </td>
                  <td>{booking.lines.filter((l) => !l.automatic).map((l) => l.name).join(', ')}</td>
                  <td>
                    {money(booking.total)}
                    {booking.ratesArePlaceholder && <span className="ev-dim"> placeholder</span>}
                  </td>
                  <td className="ev-dim">{booking.desiredDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
