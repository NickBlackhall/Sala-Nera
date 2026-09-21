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
import UploadMedia from '../../UploadMedia';

export const dynamic = 'force-dynamic';

// Server actions on this page make photo copies — a few photos per call, a
// second or two each. Set explicitly so it never depends on the plan default.
export const maxDuration = 60;

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

  const { listing, client, media, activity } = detail;

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
            {activity.map((row) => (
              <li key={row.id}>
                <span>
                  {row.filename ?? 'file'}
                  {/* Rows from before the switch have none: all full-size originals. */}
                  {row.resolution === 'low' && <span className="admin-muted"> · low res</span>}
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
