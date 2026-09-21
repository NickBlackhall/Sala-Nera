import { NextResponse } from 'next/server';
import { isAdminEmail, safePortalPath, startSession, verifyLoginToken } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Trades a valid login link for a session cookie, then sends them onward: to
 * the listing they were trying to open, when there was one, otherwise home.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get('token');
  const next = safePortalPath(params.get('next'));
  const base = process.env.PORTAL_URL ?? new URL(request.url).origin;

  const email = token ? await verifyLoginToken(token) : null;
  if (!email) {
    // An expired link still remembers where it was going.
    const retry = `/portal/login?error=expired${next ? `&next=${encodeURIComponent(next)}` : ''}`;
    return NextResponse.redirect(new URL(retry, base));
  }

  await startSession(email);
  return NextResponse.redirect(new URL(next ?? (isAdminEmail(email) ? '/admin' : '/portal'), base));
}
