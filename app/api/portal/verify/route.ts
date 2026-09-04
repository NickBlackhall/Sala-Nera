import { NextResponse } from 'next/server';
import { isAdminEmail, startSession, verifyLoginToken } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Trades a valid login link for a session cookie, then sends them onward. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  const base = process.env.PORTAL_URL ?? new URL(request.url).origin;

  const email = token ? await verifyLoginToken(token) : null;
  if (!email) {
    return NextResponse.redirect(new URL('/portal/login?error=expired', base));
  }

  await startSession(email);
  return NextResponse.redirect(new URL(isAdminEmail(email) ? '/admin' : '/portal', base));
}
