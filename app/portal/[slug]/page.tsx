import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Gallery from '@/app/components/Gallery';
import PropertyLinks from '@/app/components/PropertyLinks';
import { DEMO_BOOKING, DEMO_CLIENT, DEMO_LISTINGS, IS_DEMO, demoMediaFor } from '@/lib/demo';
import {
  getBookingSummary,
  getClientByEmail,
  getListingBySlug,
  ownsListing,
  type BookingSummary,
  type ListingBundle,
} from '@/lib/portal-queries';
import { canChangeBooking, CHANGE_CUTOFF_HOURS, shootWhen } from '@/lib/booking-changes';
import ManageBooking from './ManageBooking';
import Invoice from './Invoice';
import { getInvoice, invoiceIsReady } from '@/lib/invoices';
import type { Invoice as InvoiceRow } from '@/lib/schema';
import { TIME_ZONE } from '@/lib/scheduling';
import { getSession } from '@/lib/session';
import { coverUrl, withPreviewUrls } from '@/lib/storage';
import { planArchives } from '@/lib/archives';

export const metadata: Metadata = {
  robots: { index: false, follow: false }, // client galleries stay out of search
};

// Every render reads the database, so there is nothing to prerender at build
// time — and once sessions gate this page, a cached copy would be wrong anyway.
export const dynamic = 'force-dynamic';

async function getListing(slug: string): Promise<ListingBundle | null> {
  if (IS_DEMO) {
    const listing = DEMO_LISTINGS.find((l) => l.slug === slug);
    return listing ? { listing, media: demoMediaFor(listing), client: DEMO_CLIENT } : null;
  }
  return getListingBySlug(slug);
}

/** Midday UTC, as shoot dates are stored, so read back in UTC to keep the day. */
const shootDay = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
/** A booking's real start, shown as Nick's local day and time. */
const bookedDay = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TIME_ZONE });
const bookedTime = (d: Date | string) =>
  new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TIME_ZONE });

/**
 * The booking behind a listing that has nothing delivered yet — the only
 * state in which the agent can move or cancel it. Null for a listing Nick made
 * by hand, or once anything is uploaded.
 */
async function bookingFor(data: ListingBundle): Promise<BookingSummary | null> {
  const { listing, media } = data;
  if (media.length > 0 || !listing.bookingId) return null;
  if (IS_DEMO) return listing.bookingId === DEMO_BOOKING.id ? DEMO_BOOKING : null;
  return getBookingSummary(listing.bookingId);
}

/**
 * The listing's invoice, when there is one worth showing. An invoice Nick has
 * opened but not priced is treated as absent: "$0.00 due" reads as a promise,
 * and is worse than saying nothing. Demo mode has no database.
 */
async function invoiceFor({ listing }: ListingBundle): Promise<InvoiceRow | null> {
  if (IS_DEMO) return null;
  try {
    const invoice = await getInvoice(listing.id);
    return invoiceIsReady(invoice) ? invoice : null;
  } catch (error) {
    // The gallery matters more than the invoice; never lose the page over it.
    console.error('portal: could not read the invoice', error);
    return null;
  }
}

type ZipSizes = { high: number | null; low: number | null };
const NO_SIZES: ZipSizes = { high: null, low: null };

/**
 * The size of each "Download all photos" zip that has been made, shown beside
 * the High res / Low res switch. Unknown until made. A failure to read them
 * costs the sizes, never the page.
 */
async function zipSizesFor({ listing, media }: ListingBundle): Promise<ZipSizes> {
  if (IS_DEMO || listing.downloadLocked || !media.some((m) => m.kind === 'photo')) return NO_SIZES;
  try {
    const plans = await planArchives(listing, media);
    const size = (p: typeof plans.high) => (p.state === 'ready' ? p.row?.bytes ?? null : null);
    return { high: size(plans.high), low: size(plans.low) };
  } catch (error) {
    console.error('portal: could not read the download zips', error);
    return NO_SIZES;
  }
}

function render(
  data: ListingBundle,
  booking: BookingSummary | null,
  zipSizes: ZipSizes,
  invoice: InvoiceRow | null,
) {
  const { listing, media, client } = data;
  // A confirmed booking with a real time is one the agent may manage here.
  const scheduled = booking?.status === 'confirmed' && booking.startsAt ? booking.startsAt : null;
  const locked = listing.downloadLocked;
  // Nothing uploaded yet: a booking made this listing and the shoot is still
  // to come (lib/booking-listing.ts). No gallery bar, no invoice button.
  const booked = media.length === 0;

  return (
    <div className="portal">
      {IS_DEMO && (
        <div className="demo-flag">
          Demo data — no database connected yet. Sample images, not a real listing.
        </div>
      )}

      <header
        className={`pcover${listing.coverKey ? '' : ' pcover--bare'}`}
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
          {client?.name && <p className="pcover-by">{booked ? 'Booked for' : 'Shot for'} {client.name}</p>}
          {client?.company && <p className="pcover-by">{client.company}</p>}
        </div>
      </header>

      {booked ? (
        <section className="pbooked wrap">
          <p className="kicker kicker--accent">Shoot booked</p>
          {scheduled ? (
            <>
              <p className="pbooked-date">{bookedDay(scheduled)}</p>
              <p className="pbooked-time">{bookedTime(scheduled)} · allow around six hours on site</p>
            </>
          ) : (
            listing.shootDate && <p className="pbooked-date">{shootDay(listing.shootDate)}</p>
          )}
          <p className="pbooked-note">
            Your photos and film will appear here as soon as they&rsquo;re ready.
          </p>
          {/*
            Before the shoot the same document answers a different question:
            what did I book, and what is it going to cost? An agent who booked
            six weeks ago should not have to email to find out.
          */}
          {invoice && <Invoice invoice={invoice} heading="Your order" />}
          {scheduled && (
            <ManageBooking
              slug={listing.slug}
              address={listing.address}
              when={shootWhen(scheduled)}
              canChange={canChangeBooking(booking!)}
              cutoffHours={CHANGE_CUTOFF_HOURS}
            />
          )}
        </section>
      ) : (
        <>
          {/* The public property website exists only once the listing is paid. */}
          {!locked && <PropertyLinks slug={listing.slug} />}

          {/*
            Above the photos while locked, because it is the thing standing
            between the agent and their downloads. Below them once paid, where
            it is a receipt rather than a demand.
          */}
          {invoice && locked && <Invoice invoice={invoice} heading="Amount due" />}

          <Gallery
            slug={listing.slug}
            media={withPreviewUrls(media)}
            locked={locked}
            /*
             * A Pay button in the gallery bar, only while there is something to
             * pay: locked, unpaid, and with a link on the invoice. Once paid it
             * goes, because the same prop renders "View Invoice" on an unlocked
             * gallery and a Stripe payment link is not an invoice to view.
             */
            invoiceUrl={locked && invoice && !invoice.paidAt ? invoice.paymentUrl : null}
            zipSizes={zipSizes}
          />

          {/* Under the photos once paid: a receipt they can come back for. */}
          {invoice && !locked && <Invoice invoice={invoice} heading="Your invoice" />}
        </>
      )}

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
    // Back to this listing after sign-in: delivery emails link straight here.
    if (!session) redirect(`/portal/login?next=${encodeURIComponent(`/portal/${slug}`)}`);

    if (!session.isAdmin) {
      const viewer = await getClientByEmail(session.email);
      const bundle = await getListingBySlug(slug);
      // A listing you may not see is reported as missing, not as forbidden —
      // otherwise the 403 itself confirms which addresses we have shot.
      if (!viewer || !bundle || !ownsListing(viewer, bundle.client)) notFound();
      return render(
        bundle,
        await bookingFor(bundle),
        await zipSizesFor(bundle),
        await invoiceFor(bundle),
      );
    }
  }

  const data = await getListing(slug);
  if (!data) notFound();

  return render(data, await bookingFor(data), await zipSizesFor(data), await invoiceFor(data));
}
