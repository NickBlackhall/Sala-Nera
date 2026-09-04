import { NextResponse, after } from 'next/server';
import { sendEmail } from '@/lib/email';
import { getClientByEmail } from '@/lib/portal-queries';
import { isAdminEmail, signLoginToken } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Always answers the same way, whether or not the address is a client. Any
 * difference in status, body or timing would turn this into a way to ask
 * "is this agent one of your clients?" — so there is exactly one reply, and
 * the mail goes out in after() so the known path does not take ~2s longer
 * than the unknown one and leak the answer by the clock.
 */
export async function POST(request: Request) {
  let email = '';
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    // fall through to the validation error below
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  const known = isAdminEmail(email) || (await getClientByEmail(email)) !== null;

  if (known) {
    const base = process.env.PORTAL_URL ?? new URL(request.url).origin;
    const token = await signLoginToken(email);
    const link = `${base}/api/portal/verify?token=${encodeURIComponent(token)}`;

    after(sendEmail({
      to: email,
      subject: 'Your Sala Nera sign-in link',
      text: [
        'Here is your sign-in link for the Sala Nera client portal:',
        '',
        link,
        '',
        'It expires in 15 minutes. If you did not request it, you can ignore this email.',
        '',
        '— Sala Nera, a Blackhall Media Group collection',
      ].join('\n'),
    }));
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
