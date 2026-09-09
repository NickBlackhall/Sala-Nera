import { NextResponse } from 'next/server';
import { record } from '@/lib/telemetry';

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

  // Honeypot: respond 200 so the bot believes it succeeded. Logged, because a
  // silent discard is indistinguishable from a lost lead without a trace.
  // Named `hp_ref`, not `company` — see the longer note in the booking route.
  // Browser autofill was filling the old field and binning real inquiries.
  const reqId = clean(body.requestId, 100).replace(/[^a-zA-Z0-9_-]/g, '');

  if (clean(body.hp_ref, 50)) {
    await record({
      kind: 'inquiry', outcome: 'discarded', reason: 'honeypot',
      detail: 'Hidden field was filled. If this is a real person, autofill is doing it.',
      email: clean(body.email, 200), requestId: reqId,
    });
    return json({ ok: true });
  }

  // Floor lowered to 500ms and the upper bound removed — see the longer note in
  // app/api/booking/route.ts. Both bounds were binning real people silently,
  // which for a form whose entire job is catching leads is the worst trade
  // available.
  const startedAt = Number(body.startedAt ?? 0);
  if (startedAt) {
    const elapsed = Date.now() - startedAt;
    if (!Number.isFinite(elapsed) || elapsed < 500) {
      await record({
        kind: 'inquiry', outcome: 'discarded', reason: 'too_fast',
        detail: `Submitted ${elapsed}ms after the form loaded; the floor is 500ms.`,
        email: clean(body.email, 200), requestId: reqId,
      });
      return json({ ok: true });
    }
  }

  const name = cleanInline(body.name, MAX.name);
  const email = clean(body.email, MAX.email);
  const phone = cleanInline(body.phone, MAX.phone);
  const property = cleanInline(body.property, MAX.property);
  const details = clean(body.details, MAX.details);
  const requestId = reqId;

  if (!name || !EMAIL_RE.test(email)) {
    await record({ kind: 'inquiry', outcome: 'rejected', reason: 'missing_name_or_email',
      email, requestId: reqId });
    return json({ error: 'A name and a valid email address are required.' }, 400);
  }

  const { RESEND_API_KEY, NOTIFY_EMAIL, FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !NOTIFY_EMAIL || !FROM_EMAIL) {
    console.error('inquiry: missing env vars', {
      hasKey: !!RESEND_API_KEY, hasNotify: !!NOTIFY_EMAIL, hasFrom: !!FROM_EMAIL,
    });
    await record({ kind: 'inquiry', outcome: 'failed', reason: 'not_configured',
      detail: 'RESEND_API_KEY, NOTIFY_EMAIL or FROM_EMAIL is missing from the environment.',
      email, requestId: reqId });
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
      const detail = await r.text();
      console.error('inquiry: resend rejected', r.status, detail);
      await record({ kind: 'inquiry', outcome: 'failed', reason: 'resend_rejected',
        detail: `Resend answered ${r.status}: ${detail.slice(0, 300)}`,
        email, requestId: reqId });
      return json({ error: 'send_failed' }, 502);
    }
    await record({ kind: 'inquiry', outcome: 'ok', reason: 'sent',
      detail: property || name, email, requestId: reqId });
    return json({ ok: true });
  } catch (err) {
    console.error('inquiry: send threw', err);
    await record({ kind: 'inquiry', outcome: 'failed', reason: 'send_threw',
      detail: String(err).slice(0, 300), email, requestId: reqId });
    return json({ error: 'send_failed' }, 502);
  }
}
