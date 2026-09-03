import { NextResponse } from 'next/server';

const MAX = { name: 120, email: 200, phone: 40, property: 200, details: 4000 } as const;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_BODY_BYTES = 12_000;

const clean = (v: unknown, limit: number) => String(v ?? '').trim().slice(0, limit);
const cleanInline = (v: unknown, limit: number) => clean(v, limit).replace(/[\u0000-\u001F\u007F]+/g, ' ');
const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const contentType = (req.headers.get('content-type') ?? '').split(';')[0].trim();
  if (contentType !== 'application/json' && contentType !== 'application/x-www-form-urlencoded') {
    return json({ error: 'Unsupported media type' }, 415);
  }

  const statedLength = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(statedLength) && statedLength > MAX_BODY_BYTES) {
    return json({ error: 'Request too large' }, 413);
  }

  const origin = req.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) return json({ error: 'Origin not allowed' }, 403);
    } catch {
      return json({ error: 'Origin not allowed' }, 403);
    }
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
    const text = new TextDecoder().decode(raw);
    body = contentType === 'application/json'
      ? JSON.parse(text)
      : Object.fromEntries(new URLSearchParams(text));
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  // Honeypot: respond 200 so the bot believes it succeeded.
  if (clean(body.company, 50)) return json({ ok: true });

  const startedAt = Number(body.startedAt ?? 0);
  if (startedAt) {
    const elapsed = Date.now() - startedAt;
    if (!Number.isFinite(elapsed) || elapsed < 1800 || elapsed > 7_200_000) {
      return json({ ok: true });
    }
  }

  const name = cleanInline(body.name, MAX.name);
  const email = clean(body.email, MAX.email);
  const phone = cleanInline(body.phone, MAX.phone);
  const property = cleanInline(body.property, MAX.property);
  const details = clean(body.details, MAX.details);
  const requestId = clean(body.requestId, 100).replace(/[^a-zA-Z0-9_-]/g, '');

  if (!name || !EMAIL_RE.test(email)) {
    return json({ error: 'A name and a valid email address are required.' }, 400);
  }

  const { RESEND_API_KEY, NOTIFY_EMAIL, FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !NOTIFY_EMAIL || !FROM_EMAIL) {
    console.error('inquiry: missing env vars', {
      hasKey: !!RESEND_API_KEY, hasNotify: !!NOTIFY_EMAIL, hasFrom: !!FROM_EMAIL,
    });
    return json({ error: 'not_configured' }, 500);
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
        ...(requestId ? { 'Idempotency-Key': `sala-nera-${requestId}` } : {}),
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
      return json({ error: 'send_failed' }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    console.error('inquiry: send threw', err);
    return json({ error: 'send_failed' }, 502);
  }
}
