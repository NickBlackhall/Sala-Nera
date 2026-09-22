import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { getAdminListing, getClientOptions } from '@/lib/admin-queries';
import DeleteListing from '../../DeleteListing';
import ListingForm from '../../ListingForm';
import MediaGrid from '../../MediaGrid';
import { updateListingAction } from '../../actions';
import { isLocalKey, isRemoteStorage, withPreviewUrls } from '@/lib/storage';
import MakePreviews from '../../MakePreviews';
import SendDelivery, { type ZipStatus } from '../../SendDelivery';
import { planArchives } from '@/lib/archives';
import type { AdminListingDetail } from '@/lib/admin-queries';
import UploadMedia from '../../UploadMedia';
import { TIME_ZONE } from '@/lib/scheduling';

export const dynamic = 'force-dynamic';

// Server actions on this page make photo copies (a few photos per call, a
// second or two each) and the "Download all photos" zips, which can take a
// minute or two on a big gallery. 300s is the most the Hobby plan allows;
// set explicitly so it never depends on the plan default.
export const maxDuration = 300;

/**
 * Where each zip stands, for the delivery panel. Null while the listing is
 * locked or has no photos: nobody can download yet, so there is nothing to
 * report. A failure to read is shown as "not made yet" rather than breaking
 * the page Nick manages the listing from.
 */
async function zipStatus({ listing, media }: AdminListingDetail): Promise<ZipStatus[] | null> {
  if (listing.downloadLocked || !media.some((m) => m.kind === 'photo')) return null;
  try {
    const plans = await planArchives(listing, media);
    return [plans.high, plans.low].map((plan) => ({
      label: plan.resolution === 'high' ? 'High res' : 'Low res',
      state: plan.state === 'none' ? 'missing' : plan.state,
      bytes: plan.row?.bytes ?? null,
      error: plan.error,
    }));
  } catch (error) {
    console.error('admin: could not read the download zips', error);
    return null;
  }
}

type DownloadRow = AdminListingDetail['activity'][number];

/**
 * The download history, one line per download rather than per file. Every
 * file a single download handed out — a zip's photos — was written in one
 * statement, so the rows share their timestamp to the microsecond.
 */
function downloadsOnce(rows: DownloadRow[]) {
  const groups: { id: number; filename: string | null; count: number; low: boolean; clientEmail: string | null; at: Date }[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && last.at.getTime() === new Date(row.at).getTime() && last.clientEmail === row.clientEmail) {
      last.count++;
      last.low ||= row.resolution === 'low';
      continue;
    }
    groups.push({
      id: row.id, filename: row.filename, count: 1, low: row.resolution === 'low',
      clientEmail: row.clientEmail, at: new Date(row.at),
    });
  }
  return groups.slice(0, 20);
}

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId)) notFound();

  const [detail, clients] = await Promise.all([
    getAdminListing(listingId),
    getClientOptions(),
  ]);
  if (!detail) notFound();

  const { listing, client, media, activity, delivered } = detail;
  const zips = await zipStatus(detail);

  // Photos still served as full-size originals: uploaded before copies
  // existed, or whose copies failed. Demo rows are small files already.
  const missingPreviews = isRemoteStorage()
    ? media.filter((m) => m.kind === 'photo' && !m.gridKey && !isLocalKey(m.r2Key)).map((m) => m.id)
    : [];

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="kicker">Listing</span>
          <h1>{listing.address}</h1>
          <p className="admin-muted">
            <Link href={`/portal/${listing.slug}`}>/portal/{listing.slug}</Link>
            {!listing.downloadLocked && (
              <>
                {' · '}
                <a href={`/p/${listing.slug}`} target="_blank" rel="noopener">property website</a>
                {' · '}
                <a href={`/p/${listing.slug}/mls`} target="_blank" rel="noopener">MLS version</a>
              </>
            )}
            {client ? ` · ${client.email}` : ' · unassigned'}
          </p>
        </div>
        <Link className="btn btn-outline" href="/admin">
          Back
        </Link>
      </div>

      <SendDelivery
        id={listing.id}
        address={listing.address}
        to={client?.email ?? null}
        locked={listing.downloadLocked}
        mediaCount={media.length}
        zips={zips}
        history={delivered.map((row) => ({
          id: row.id,
          what: row.kind === 'preview' ? 'Preview email' : 'Delivery email',
          sentTo: row.sentTo,
          when: new Date(row.at).toLocaleString('en-US', {
            timeZone: TIME_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          }),
        }))}
      />

      <ListingForm
        action={updateListingAction}
        clients={clients}
        listing={listing}
        submitLabel="Save changes"
      />

      <section className="admin-section">
        <h2>Media ({media.length})</h2>
        {isRemoteStorage() ? (
          <>
            <UploadMedia listingId={listing.id} />
            <MakePreviews missingIds={missingPreviews} />
          </>
        ) : (
          <p className="admin-empty">
            Uploads are built but Cloudflare storage isn&apos;t connected yet, so
            there&apos;s nowhere for the files to go. This message disappears and
            the upload button appears the moment it is.
          </p>
        )}
        {media.length === 0 ? (
          <p className="admin-empty">No media yet.</p>
        ) : (
          <MediaGrid
            listingId={listing.id}
            coverKey={listing.coverKey}
            media={withPreviewUrls(media)}
          />
        )}
      </section>


      <section className="admin-section">
        <h2>Download activity</h2>
        {activity.length === 0 ? (
          <p className="admin-empty">
            Nothing recorded yet. Every download through the portal writes a
            row here, so this stays empty until a client actually takes files.
          </p>
        ) : (
          <ul className="admin-activity">
            {downloadsOnce(activity).map((row) => (
              <li key={row.id}>
                <span>
                  {row.count > 1 ? `${row.count} files at once` : row.filename ?? 'file'}
                  {/* Rows from before the switch have none: all full-size originals. */}
                  {row.low && <span className="ev-dim"> · low res</span>}
                </span>
                <span className="admin-muted">{row.clientEmail ?? 'unknown'}</span>
                <span className="admin-muted">
                  {new Date(row.at).toLocaleString('en-US')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DeleteListing id={listing.id} address={listing.address} mediaCount={media.length} />
    </>
  );
}
