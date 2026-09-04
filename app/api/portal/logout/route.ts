import { NextResponse } from 'next/server';
import { endSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  await endSession();
  const base = process.env.PORTAL_URL ?? new URL(request.url).origin;
  return NextResponse.redirect(new URL('/portal/login', base), { status: 303 });
}
