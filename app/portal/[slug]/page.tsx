import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Gallery from '@/app/components/Gallery';
import PropertyLinks from '@/app/components/PropertyLinks';
import { DEMO_CLIENT, DEMO_LISTINGS, DEMO_MEDIA, IS_DEMO } from '@/lib/demo';
import {
  getClientByEmail,
  getListingBySlug,
  ownsListing,
  type ListingBundle,
} from '@/lib/portal-queries';
import { getSession } from '@/lib/session';
import { coverUrl, withPreviewUrls } from '@/lib/storage';

export const metadata: Metadata = {
  robots: { index: false, follow: false }, // client galleries stay out of search
};

// Every render reads the database, so there is nothing to prerender at build
// time — and once sessions gate this page, a cached copy would be wrong anyway.
export const dynamic = 'force-dynamic';

async function getListing(slug: string): Promise<ListingBundle | null> {
  if (IS_DEMO) {
    const listing = DEMO_LISTINGS.find((l) => l.slug === slug);
    return listing ? { listing, media: DEMO_MEDIA, client: DEMO_CLIENT } : null;
  }
  return getListingBySlug(slug);
}

function render(data: ListingBundle) {
  const { listing, media, client } = data;
  const locked = listing.downloadLocked;

  return (
    <div className="portal">
      {IS_DEMO && (
        <div className="demo-flag">
          Demo data — no database connected yet. Sample images, not a real listing.
        </div>
      )}

      <header
        className="pcover"
        style={
          listing.coverKey
            ? { backgroundImage: `url(${coverUrl(listing.coverKey, media, 'large')})` }
            : undefined
        }
      >
        <div className="pcover-scrim" />
        <div className="pcover-inner">
          {listing.city && <p className="pcover-kicker">{listing.city}</p>}
          <h1>{listing.address}</h1>
          {client?.name && <p className="pcover-by">Shot for {client.name}</p>}
          {client?.company && <p className="pcover-by">{client.company}</p>}
        </div>
      </header>

      {/* The public property website exists only once the listing is paid. */}
      {!locked && <PropertyLinks slug={listing.slug} />}

      <Gallery
        slug={listing.slug}
        media={withPreviewUrls(media)}
        locked={locked}
        invoiceUrl={locked ? '#' : '#'}
      />

      <footer className="pfoot">
        <div className="wrap">
          <span>Sala Nera — a Blackhall Media Group collection</span>
          <a href="mailto:nblackhall@blackhallmediagroup.com">nblackhall@blackhallmediagroup.com</a>
        </div>
      </footer>
    </div>
  );
}

export default async function PortalListing({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Demo mode stays open so the gallery can be reviewed with no database.
  // Everything else is gated: sign in, then prove the listing is yours.
  if (!IS_DEMO) {
    const session = await getSession();
    if (!session) redirect('/portal/login');

    if (!session.isAdmin) {
      const viewer = await getClientByEmail(session.email);
      const bundle = await getListingBySlug(slug);
      // A listing you may not see is reported as missing, not as forbidden —
      // otherwise the 403 itself confirms which addresses we have shot.
      if (!viewer || !bundle || !ownsListing(viewer, bundle.client)) notFound();
      return render(bundle);
    }
  }

  const data = await getListing(slug);
  if (!data) notFound();

  return render(data);
}
