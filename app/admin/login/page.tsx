import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LoginForm from '@/app/portal/login/LoginForm';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Admin sign in — Sala Nera',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Nick's way into his own CMS: /admin sends anyone who is not signed in as the
 * admin here. The same emailed-link sign-in as the client portal underneath,
 * but its own page, so the owner never has to go through something labelled
 * for clients. The link it emails lands on /admin.
 */
export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session?.isAdmin) redirect('/admin');
  const { error } = await searchParams;

  return (
    <div className="plogin">
      <div className="plogin-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="plogin-logo"
          src="/brand/sala nera logo cropped dark.svg"
          alt="Sala Nera"
          width={1669}
          height={1070}
        />
        <h1>Admin</h1>
        <p className="plogin-intro">
          Enter your admin email address. No password — we&rsquo;ll email you a
          sign-in link that opens the admin.
        </p>
        {session && (
          // Usually Nick, still signed in as the agent on a test listing.
          <p className="plogin-intro">
            You&rsquo;re signed in as {session.email}, which is a client account.
            Signing in here switches you to the admin.
          </p>
        )}
        <LoginForm
          expired={error === 'expired'}
          next={null}
          admin
          placeholder="you@blackhallmediagroup.com"
        />
      </div>
    </div>
  );
}
