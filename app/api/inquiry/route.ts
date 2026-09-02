import { NextResponse } from 'next/server';

const MAX = { name: 120, email: 200, phone: 40, property: 200, details: 4000 } as const;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const clean = (v: unknown, limit: number) => String(v ?? '').trim().slice(0, limit);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Honeypot: respond 200 so the bot believes it succeeded.
  if (clean(body.company, 50)) return NextResponse.json({ ok: true });

  const name = clean(body.name, MAX.name);
  const email = clean(body.email, MAX.email);
  const phone = clean(body.phone, MAX.phone);
  const property = clean(body.property, MAX.property);
  const details = clean(body.details, MAX.details);

  if (!name || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: 'A name and a valid email address are required.' },
      { status: 400 },
    );
  }

  const { RESEND_API_KEY, NOTIFY_EMAIL, FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !NOTIFY_EMAIL || !FROM_EMAIL) {
    console.error('inquiry: missing env vars', {
      hasKey: !!RESEND_API_KEY, hasNotify: !!NOTIFY_EMAIL, hasFrom: !!FROM_EMAIL,
    });
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  const text = [
    'New Sala Nera inquiry',
    '',
    `Name:     ${name}`,
    `Email:    ${email}`,
    `Phone:    ${phone || '—'}`,
    `Property: ${property || '—'}`,
    '',
    'Details:',
    details || '—',
    '',
    '— sent from the Sala Nera site',
  ].join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [NOTIFY_EMAIL],
        reply_to: email, // hit Reply and it reaches the agent
        subject: `Sala Nera inquiry — ${property || name}`,
        text,
      }),
    });

    if (!r.ok) {
      console.error('inquiry: resend rejected', r.status, await r.text());
      return NextResponse.json({ error: 'send_failed' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('inquiry: send threw', err);
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }
}
