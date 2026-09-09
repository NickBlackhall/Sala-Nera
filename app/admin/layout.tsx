import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

export const metadata: Metadata = {
  title: 'Admin — Sala Nera',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The gate runs here for the chrome, and again inside every page and every
  // action — a layout check alone protects neither.
  await requireAdmin();

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
            <Link href="/admin/clients">Clients</Link>
            <Link href="/admin/activity">Activity</Link>
            <Link href="/portal">Client view</Link>
            <form action="/api/portal/logout" method="post">
              <button type="submit">Sign out</button>
            </form>
          </nav>
        </div>
      </header>

      <main className="wrap admin-main">{children}</main>
    </div>
  );
}
