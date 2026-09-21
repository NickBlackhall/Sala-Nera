import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { getRecentBookings, type AdminBookingRow } from '@/lib/admin-queries';
import { money } from '@/lib/quote';
import { TIME_ZONE } from '@/lib/scheduling';
import CancelBooking from '../CancelBooking';

export const dynamic = 'force-dynamic';

/** Always in Nick's time zone — it is his day being blocked out, not the viewer's. */
const shootWhen = (d: Date | string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(d));

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
          Every booking the form delivered, priced as it was quoted. Cancelling a confirmed
          shoot puts that day back on the market.{' '}
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
                <th>Shoot</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ booking, client, listing }) => (
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
                    {listing && (
                      <>
                        <br />
                        <Link href={`/admin/listings/${listing.id}`}>Listing →</Link>
                      </>
                    )}
                  </td>
                  <td>{booking.lines.filter((l) => !l.automatic).map((l) => l.name).join(', ')}</td>
                  <td>
                    {money(booking.total)}
                    {booking.ratesArePlaceholder && <span className="ev-dim"> placeholder</span>}
                  </td>
                  <td>
                    {booking.startsAt ? (
                      <>
                        {shootWhen(booking.startsAt)}
                        <br />
                        <span className={booking.status === 'cancelled' ? 'ev-dim' : 'admin-confirmed'}>
                          {booking.status === 'cancelled' ? 'cancelled' : 'confirmed'}
                        </span>
                        {/*
                          The booking is real and the day is blocked either way —
                          this only says Nick's calendar did not get the memo, which
                          is otherwise invisible until he fails to turn up.
                        */}
                        {booking.status === 'confirmed' && !booking.calendarEventId && (
                          <>
                            <br />
                            <span className="admin-warn">not on your calendar</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="ev-dim">{booking.desiredDate ? `${booking.desiredDate} wanted` : '—'}</span>
                    )}
                  </td>
                  <td>
                    {booking.status === 'confirmed' && booking.startsAt && (
                      <CancelBooking
                        id={booking.id}
                        when={shootWhen(booking.startsAt)}
                        address={booking.address}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
