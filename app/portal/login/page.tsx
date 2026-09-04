import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Client sign in — Sala Nera',
  robots: { index: false, follow: false },
};

export default async function PortalLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
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
        <h1>Client portal</h1>
        <p className="plogin-intro">
          Enter the email address your shoot was booked under. No password —
          we&rsquo;ll send you a sign-in link.
        </p>
        <LoginForm expired={error === 'expired'} />
      </div>
    </div>
  );
}
