import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Gallery from '@/app/components/Gallery';
import { DEMO_CLIENT, DEMO_LISTINGS, DEMO_MEDIA, IS_DEMO } from '@/lib/demo';

export const metadata: Metadata = {
  robots: { index: false, follow: false }, // client galleries stay out of search
};

async function getListing(slug: string) {
  if (IS_DEMO) {
    const listing = DEMO_LISTINGS.find((l) => l.slug === slug);
    return listing ? { listing, media: DEMO_MEDIA, client: DEMO_CLIENT } : null;
  }
  // Real lookup lands here once DATABASE_URL exists.
  return null;
}

export default async function PortalListing({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getListing(slug);
  if (!data) notFound();

  const { listing, media, client } = data;
  const locked = listing.downloadLocked;

  return (
    <div className="portal">
      {IS_DEMO && (
        <div className="demo-flag">
          Demo data — no database connected yet. Sample images, not a real listing.
        </div>
      )}

      <header className="pcover" style={{ backgroundImage: `url(${listing.coverKey})` }}>
        <div className="pcover-scrim" />
        <div className="pcover-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pcover-logo"
            src="/brand/sala nera logo cropped dark.svg"
            alt="Sala Nera"
            width={1669}
            height={1070}
          />
          <h1>{listing.address}</h1>
          <p>
            {[listing.city, client?.name].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      <Gallery media={media} locked={locked} invoiceUrl={locked ? '#' : '#'} />

      <footer className="pfoot">
        <div className="wrap">
          <span>Sala Nera — a Blackhall Media Group collection</span>
          <a href="mailto:nick@blackhallmediagroup.com">nick@blackhallmediagroup.com</a>
        </div>
      </footer>
    </div>
  );
}
