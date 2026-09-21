import { NextResponse } from 'next/server';
import { endSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  await endSession();
  const base = process.env.PORTAL_URL ?? new URL(request.url).origin;
  // The admin's sign-out form says so; everyone else goes back to the client portal.
  const form = await request.formData().catch(() => null);
  const to = form?.get('to') === 'admin' ? '/admin/login' : '/portal/login';
  return NextResponse.redirect(new URL(to, base), { status: 303 });
}
