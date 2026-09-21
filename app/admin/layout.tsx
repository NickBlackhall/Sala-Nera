import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Admin — Sala Nera',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Not the gate: every page and every action runs requireAdmin() itself, and
  // sends anyone who is not the admin to /admin/login. This only decides
  // whether to draw the admin chrome, so the sign-in page, the one page in
  // here a visitor may see, is left bare.
  const session = await getSession();
  if (!session?.isAdmin) return <>{children}</>;

  return (
    <div className="admin">
      <header className="admin-head">
        <div className="wrap admin-head-inner">
          <Link className="admin-brand" href="/admin">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/sala nera logo cropped dark.svg"
              alt="Sala Nera"
              width={1669}
              height={1070}
            />
            <span className="kicker kicker--accent">Admin</span>
          </Link>
          <nav className="admin-nav">
            <Link href="/admin">Listings</Link>
            <Link href="/admin/bookings">Bookings</Link>
            <Link href="/admin/clients">Clients</Link>
            <Link href="/admin/activity">Activity</Link>
            <Link href="/portal">Client view</Link>
            <form action="/api/portal/logout" method="post">
              {/* Back to the admin's own sign-in, not the client portal's. */}
              <input type="hidden" name="to" value="admin" />
              <button type="submit">Sign out</button>
            </form>
          </nav>
        </div>
      </header>

      <main className="wrap admin-main">{children}</main>
    </div>
  );
}
