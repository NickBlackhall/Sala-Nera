import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getAllListings,
  getClientByEmail,
  getCoverRows,
  getListingsForViewer,
  listingsWithMedia,
} from '@/lib/portal-queries';
import { getSession } from '@/lib/session';
import { coverUrl } from '@/lib/storage';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PortalIndex({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  // Where an agent lands after cancelling a booking: its listing went with it.
  const session = await getSession();
  if (!session) redirect('/portal/login');

  // Admins see the whole library; clients see their own plus their team's.
  const viewer = await getClientByEmail(session.email);
  if (!viewer && !session.isAdmin) redirect('/portal/login');

  const { cancelled } = await searchParams;

  const listings = session.isAdmin
    ? await getAllListings()
    : await getListingsForViewer(viewer!);

  const coverRows = await getCoverRows(
    listings.flatMap((l) => (l.coverKey ? [l.coverKey] : [])),
  );
  const delivered = await listingsWithMedia(listings.map((l) => l.id));

  return (
    <div className="pindex">
      <header className="pindex-head">
        <div className="wrap pindex-head-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pindex-logo"
            src="/brand/sala nera logo cropped dark.svg"
            alt="Sala Nera"
            width={1669}
            height={1070}
          />
          <form action="/api/portal/logout" method="post">
            <button className="btn-outline" type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <main className="wrap pindex-main">
        <span className="kicker kicker--accent">
          {session.isAdmin ? 'All listings' : 'Your listings'}
        </span>
        <h1>{viewer?.company || viewer?.name || session.email}</h1>

        {cancelled === '1' && (
          <p className="pindex-flash" role="status">
            Your booking is cancelled, and the time has been released. We&rsquo;ve emailed you to confirm.
          </p>
        )}

        {listings.length === 0 ? (
          <p className="pindex-empty">
            No listings here yet. Once a shoot is delivered it will appear on
            this page.
          </p>
        ) : (
          <ul className="pindex-list">
            {listings.map((l) => (
              <li key={l.id}>
                <Link href={`/portal/${l.slug}`} className="pindex-card">
                  {l.coverKey && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl(l.coverKey, coverRows, 'grid')} alt="" loading="lazy" />
                  )}
                  <div className="pindex-card-body">
                    <h2>{l.address}</h2>
                    <p>
                      {[
                        l.city,
                        l.shootDate
                          ? new Date(l.shootDate).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {!delivered.has(l.id) ? (
                      <span className="pindex-booked">Shoot booked</span>
                    ) : (
                      l.downloadLocked && <span className="pindex-lock">Downloads locked</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
