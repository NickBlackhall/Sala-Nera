import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { getEventSummary, getRecentEvents } from '@/lib/admin-queries';

export const dynamic = 'force-dynamic';

/**
 * Diagnostics.
 *
 * This page exists because of a day when three separate anti-spam rules threw
 * away real bookings and every one of them showed the sender a success screen.
 * Nothing was broken in a way anyone could see. The fix is not cleverness, it
 * is a place where "we deliberately discarded this" is written down and can be
 * read without a terminal.
 *
 * Read the Discarded column first. Anything there is a submission somebody
 * believes they sent and Nick never received.
 */

const OUTCOME_LABEL: Record<string, string> = {
  ok: 'Delivered',
  discarded: 'Discarded',
  rejected: 'Refused',
  failed: 'Failed',
};

/** Plain-English translations of the machine reasons written by the routes. */
const REASON_LABEL: Record<string, string> = {
  sent: 'Sent',
  honeypot: 'Tripped the bot trap',
  too_fast: 'Submitted too fast',
  missing_name_or_email: 'No name or a bad email address',
  missing_address: 'No property address',
  no_valid_services: 'No recognised services',
  not_configured: 'Email is not configured on the server',
  resend_rejected: 'The email provider refused it',
  send_threw: 'The email request itself failed',
  confirmation_failed: 'Lead delivered, client confirmation failed',
  client_not_saved: 'Lead delivered, client account not created',
  booking_not_saved: 'Lead delivered, booking not saved',
  locked: 'Gallery is locked',
  missing: 'Not found, or not theirs',
  single: 'One file',
  selection: 'Selected files',
  whole_gallery: 'Whole gallery',
};

export default async function ActivityPage() {
  await requireAdmin();

  const [rows, summary] = await Promise.all([getRecentEvents(200), getEventSummary(24)]);

  const total = (outcome: string) =>
    summary.filter((s) => s.outcome === outcome).reduce((n, s) => n + Number(s.n), 0);

  const discarded = total('discarded');
  const failed = total('failed');

  return (
    <>
      <div className="admin-title">
        <h1>
          Activity
          <span className="admin-title-sub">last 24 hours</span>
        </h1>
        <p>
          Every submission and download, and what the server decided to do with it.{' '}
          <Link href="/admin">Back to listings</Link>
        </p>
      </div>

      <div className="admin-stats">
        <div className="admin-stat">
          <span className="admin-stat-n">{total('ok')}</span>
          <span className="admin-stat-k">Delivered</span>
        </div>
        <div className={`admin-stat${discarded > 0 ? ' admin-stat--warn' : ''}`}>
          <span className="admin-stat-n">{discarded}</span>
          <span className="admin-stat-k">Discarded</span>
        </div>
        <div className={`admin-stat${failed > 0 ? ' admin-stat--warn' : ''}`}>
          <span className="admin-stat-n">{failed}</span>
          <span className="admin-stat-k">Failed</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-n">{total('rejected')}</span>
          <span className="admin-stat-k">Refused</span>
        </div>
      </div>

      {discarded > 0 && (
        <p className="admin-flash">
          <strong>{discarded} submission{discarded === 1 ? ' was' : 's were'} discarded.</strong>{' '}
          Each one showed the sender a success message and never reached you. If any look
          like real people rather than bots, the anti-spam rules are too tight — that has
          happened before.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="admin-empty">
          Nothing recorded yet. Every booking, inquiry and download writes a line here.
        </p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table admin-events">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Outcome</th>
                <th>Why</th>
                <th>Who</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={`ev ev--${row.outcome}`}>
                  <td className="ev-dim">
                    {new Date(row.at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </td>
                  <td>{row.kind}</td>
                  <td>
                    <span className={`ev-badge ev-badge--${row.outcome}`}>
                      {OUTCOME_LABEL[row.outcome] ?? row.outcome}
                    </span>
                  </td>
                  <td>{row.reason ? REASON_LABEL[row.reason] ?? row.reason : '—'}</td>
                  <td className="ev-dim">{row.email ?? '—'}</td>
                  <td className="ev-dim admin-ev-detail">{row.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
