'use client';

import { useActionState } from 'react';
import { formatSize } from '@/lib/media-view';
import {
  prepareDownloadsAction,
  sendDeliveryAction,
  type DeliveryState,
  type PrepareState,
} from './actions';

/**
 * Where one "Download all photos" zip stands — see lib/archives.ts. Spelled
 * out here rather than imported: lib/archives.ts is server-only.
 */
export type ZipStatus = {
  label: string;
  state: 'missing' | 'building' | 'ready' | 'failed';
  bytes: number | null;
  error: string | null;
};

function describe(zip: ZipStatus): string {
  switch (zip.state) {
    case 'ready':
      return zip.bytes ? `Ready · ${formatSize(zip.bytes)}` : 'Ready';
    case 'building':
      return 'Being made now…';
    case 'failed':
      return `Couldn't be made: ${zip.error ?? 'no reason recorded.'}`;
    default:
      return 'Not made yet';
  }
}

/**
 * The top of a listing: the "your photos are ready" email, and the download
 * zips it depends on. Which email goes out is decided by the payment lock
 * when it is pressed, and said here before the press, so Nick is never
 * surprised by which version an agent got.
 */
export default function SendDelivery({
  id,
  address,
  to,
  locked,
  mediaCount,
  zips,
  history,
}: {
  id: number;
  address: string;
  /** The agent's email, or null when the listing has no agent yet. */
  to: string | null;
  locked: boolean;
  mediaCount: number;
  /** Null while locked, or with no photos: there is nothing to zip for anyone yet. */
  zips: ZipStatus[] | null;
  /** Already formatted on the server, so the date cannot differ between server and browser. */
  history: { id: number; what: string; sentTo: string; when: string }[];
}) {
  const [state, formAction, pending] = useActionState(sendDeliveryAction, {} as DeliveryState);
  const [prep, prepareAction, preparing] = useActionState(prepareDownloadsAction, {} as PrepareState);

  const blocked = !to
    ? 'Assign an agent to this listing, below, before sending.'
    : mediaCount === 0
      ? 'Upload the photos first. The button appears once there is something to send.'
      : null;

  const needsWork = zips?.some((z) => z.state === 'missing' || z.state === 'failed') ?? false;
  const anyFailed = zips?.some((z) => z.state === 'failed') ?? false;

  return (
    <section className="admin-section admin-delivery">
      <h2>Delivery</h2>

      {zips && (
        <div className="admin-zips">
          <p className="admin-zips-title">Download all photos</p>
          <ul className="admin-activity">
            {zips.map((zip) => (
              <li key={zip.label}>
                <span>{zip.label}</span>
                <span className={zip.state === 'failed' ? 'admin-zip-failed' : 'admin-muted'}>{describe(zip)}</span>
              </li>
            ))}
          </ul>
          {needsWork && (
            <>
              <p className="admin-empty">
                They&apos;re made when you send the delivery email, or now with the button below.
                Until then, a client who presses Download all photos waits while it&apos;s made.
              </p>
              <form action={prepareAction}>
                <input type="hidden" name="id" value={id} />
                <button className="btn btn-outline admin-send" type="submit" disabled={preparing || pending}>
                  {preparing ? 'Preparing downloads…' : anyFailed ? 'Rebuild downloads' : 'Prepare downloads'}
                </button>
              </form>
            </>
          )}
          {prep.error && <p className="form-error" role="alert">{prep.error}</p>}
          {prep.prepared && !needsWork && <p className="admin-flash admin-sent" role="status">{prep.prepared}</p>}
        </div>
      )}

      {blocked ? (
        <p className="admin-empty">{blocked}</p>
      ) : (
        <>
          <p className="admin-empty">
            Emails {to} a link to this gallery.{' '}
            {locked
              ? "It's still locked, so the email says they can preview now and download once payment is received."
              : "It's paid, so the email says it's ready to download and includes the property website links. " +
                "Any download zip that isn't ready is made first, which can take a minute. If one can't be made, the email doesn't go."}
          </p>
          <form
            action={formAction}
            onSubmit={(e) => {
              const which = locked ? 'the preview email' : 'the delivery email';
              if (!confirm(`Send ${which} for ${address} to ${to}?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={id} />
            <button className="btn btn-primary admin-send" type="submit" disabled={pending || preparing}>
              {pending
                ? locked ? 'Sending…' : 'Preparing downloads and sending…'
                : locked ? 'Send preview email' : 'Send delivery email'}
            </button>
          </form>
          {state.error && <p className="form-error" role="alert">{state.error}</p>}
          {state.sent && <p className="admin-flash admin-sent" role="status">{state.sent}</p>}
        </>
      )}
      {history.length > 0 && (
        <ul className="admin-activity admin-sent-list">
          {history.map((row) => (
            <li key={row.id}>
              <span>{row.what}</span>
              <span className="admin-muted">{row.sentTo}</span>
              <span className="admin-muted">{row.when}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
