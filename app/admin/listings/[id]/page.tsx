import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { getAdminListing, getClientOptions } from '@/lib/admin-queries';
import DeleteListing from '../../DeleteListing';
import ListingForm from '../../ListingForm';
import { setCoverAction, updateListingAction } from '../../actions';
import { previewUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

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

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="kicker">Listing</span>
          <h1>{listing.address}</h1>
          <p className="admin-muted">
            <Link href={`/portal/${listing.slug}`}>/portal/{listing.slug}</Link>
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
        {media.length === 0 ? (
          <p className="admin-empty">
            No media yet. These rows come from the upload script, not from this
            page — there is no browser upload until R2 is wired up.
          </p>
        ) : (
          <ul className="admin-media">
            {media.map((item) => (
              <li key={item.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl(item.r2Key)} alt="" loading="lazy" />
                <div>
                  <span className="admin-strong">{item.filename}</span>
                  <span className="admin-muted">
                    {item.kind}
                    {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                  </span>
                  {listing.coverKey === item.r2Key ? (
                    <span className="admin-cover-flag">Cover</span>
                  ) : (
                    <form action={setCoverAction}>
                      <input type="hidden" name="id" value={listing.id} />
                      <input type="hidden" name="coverKey" value={item.r2Key} />
                      <button type="submit">Use as cover</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
                <span>{row.filename ?? 'file'}</span>
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
