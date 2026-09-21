import { NextResponse, after } from 'next/server';
import { sendEmail } from '@/lib/email';
import { getClientByEmail } from '@/lib/portal-queries';
import { isAdminEmail, safePortalPath, signLoginToken } from '@/lib/session';

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
  let next: string | null = null;
  let adminOnly = false;
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    next = safePortalPath(body?.next);
    adminOnly = body?.admin === true;
  } catch {
    // fall through to the validation error below
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  // From the admin's sign-in page only an admin address gets a link: an agent
  // who wandered in would just be emailed a link to the client portal, and the
  // answer they see is the same either way.
  const known = adminOnly
    ? isAdminEmail(email)
    : isAdminEmail(email) || (await getClientByEmail(email)) !== null;

  if (known) {
    const base = process.env.PORTAL_URL ?? new URL(request.url).origin;
    const token = await signLoginToken(email);
    const link = `${base}/api/portal/verify?token=${encodeURIComponent(token)}${
      next ? `&next=${encodeURIComponent(next)}` : ''
    }${adminOnly ? '&from=admin' : ''}`;

    after(sendEmail({
      to: email,
      subject: adminOnly ? 'Your Sala Nera admin sign-in link' : 'Your Sala Nera sign-in link',
      text: [
        adminOnly
          ? 'Here is your sign-in link for the Sala Nera admin:'
          : 'Here is your sign-in link for the Sala Nera client portal:',
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
