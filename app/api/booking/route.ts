import { NextResponse } from 'next/server';
import { money, quote } from '@/lib/quote';
import { RATES_ARE_PLACEHOLDER } from '@/lib/rates';

/**
 * Booking submissions.
 *
 * The same shape as app/api/inquiry/route.ts — honeypot, timing check, origin
 * check, size caps, idempotency key — because that route's hardening was worked
 * out once and a second, softer front door would just be the one bots use.
 *
 * The one addition that matters: **the estimate is recomputed here.** The
 * browser's number arrives in the payload, but it is treated as a claim, not a
 * fact. A form can be edited in a devtools console, and this number becomes an
 * email that becomes a draft invoice — so the server prices the submission
 * again from lib/rates.ts and sends its own figure. A disagreement is reported
 * in the email rather than rejected, because the honest explanation is usually
 * that the rate card changed while someone had the form open.
 */

const MAX = {
  name: 120, email: 200, phone: 40, brokerage: 160,
  address: 240, accessNotes: 2000, notes: 4000, date: 40,
} as const;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_BODY_BYTES = 20_000;
const MAX_SERVICES = 40;

const clean = (v: unknown, limit: number) => String(v ?? '').trim().slice(0, limit);
const cleanInline = (v: unknown, limit: number) =>
  clean(v, limit).replace(/[\u0000-\u001F\u007F]+/g, ' ');
const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const contentType = (req.headers.get('content-type') ?? '').split(';')[0].trim();
  if (contentType !== 'application/json') {
    return json({ error: 'Unsupported media type' }, 415);
  }

  const statedLength = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(statedLength) && statedLength > MAX_BODY_BYTES) {
    return json({ error: 'Request too large' }, 413);
  }

  const origin = req.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) {
        return json({ error: 'Origin not allowed' }, 403);
      }
    } catch {
      return json({ error: 'Origin not allowed' }, 403);
    }
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  // Honeypot: answer 200 so the bot believes it succeeded and does not retry.
  // Logged, because every silent discard is indistinguishable from a lost lead
  // unless there is a trace of it somewhere.
  if (clean(body.company, 50)) {
    console.warn('booking: discarded, honeypot filled');
    return json({ ok: true });
  }

  /**
   * Only the "impossibly fast" half of this is a bot signal.
   *
   * There is deliberately no upper bound. An agent can open the form, get
   * pulled into a showing, and come back three hours later — and throwing that
   * away behind a success screen loses a real booking in the most invisible way
   * possible. This route previously did exactly that above two hours.
   *
   * The bound that remains is weak on its own, and so was the one removed: a
   * bot that omits startedAt skips this check entirely. It is one signal
   * alongside the honeypot and the origin check, not the gate.
   */
  const startedAt = Number(body.startedAt ?? 0);
  if (startedAt) {
    const elapsed = Date.now() - startedAt;
    if (!Number.isFinite(elapsed) || elapsed < 3000) {
      console.warn('booking: discarded, submitted in %sms', elapsed);
      return json({ ok: true });
    }
  }

  const name = cleanInline(body.name, MAX.name);
  const email = clean(body.email, MAX.email);
  const phone = cleanInline(body.phone, MAX.phone);
  const brokerage = cleanInline(body.brokerage, MAX.brokerage);
  const address = cleanInline(body.address, MAX.address);
  const accessNotes = clean(body.accessNotes, MAX.accessNotes);
  const notes = clean(body.notes, MAX.notes);
  const desiredDate = cleanInline(body.desiredDate, MAX.date);
  const requestId = clean(body.requestId, 100).replace(/[^a-zA-Z0-9_-]/g, '');

  const sqftRaw = Number(body.sqft);
  const sqft =
    Number.isFinite(sqftRaw) && sqftRaw > 0 ? Math.min(Math.round(sqftRaw), 100_000) : null;

  const services = Array.isArray(body.services)
    ? body.services.slice(0, MAX_SERVICES).map((s) => clean(s, 60))
    : [];

  if (!name || !EMAIL_RE.test(email)) {
    return json({ error: 'A name and a valid email address are required.' }, 400);
  }
  if (!address) {
    return json({ error: 'A property address is required.' }, 400);
  }
  // The authoritative price. Unknown service ids are dropped inside quote().
  const priced = quote(sqft, services);

  // Checked against the *priced* lines rather than the submitted array: a
  // payload naming only ids that do not exist would otherwise pass a
  // length check and arrive as a booking for nothing, estimated at zero.
  if (priced.lines.length === 0) {
    return json({ error: 'Choose at least one service.' }, 400);
  }

  const claimed = Number(body.estimate);
  const disagrees = Number.isFinite(claimed) && Math.round(claimed) !== priced.total;

  const { RESEND_API_KEY, NOTIFY_EMAIL, FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !NOTIFY_EMAIL || !FROM_EMAIL) {
    console.error('booking: missing env vars', {
      hasKey: !!RESEND_API_KEY, hasNotify: !!NOTIFY_EMAIL, hasFrom: !!FROM_EMAIL,
    });
    return json({ error: 'not_configured' }, 500);
  }

  // Laid out as labelled lines on purpose: this email is the record the Gmail
  // automations read, so the field names need to stay stable and greppable.
  const text = [
    'New Booking Request',
    '',
    `Address:      ${address}`,
    `Sqft:         ${sqft ? sqft.toLocaleString('en-US') : '—'}${priced.tierLabel ? `  (${priced.tierLabel})` : ''}`,
    `Desired date: ${desiredDate || '—'}   [REQUESTED — not confirmed]`,
    '',
    `Name:         ${name}`,
    `Email:        ${email}`,
    `Phone:        ${phone || '—'}`,
    `Brokerage:    ${brokerage || '—'}`,
    '',
    'Services:',
    ...priced.lines.map(
      (l) =>
        `  - ${l.name}: ${
          l.amount === null ? `quoted after — ${l.note ?? ''}`.trim() : money(l.amount)
        }`,
    ),
    '',
    `Estimate:     ${money(priced.total)}${priced.hasQuotedItems ? ' + items quoted after' : ''}`,
    ...(disagrees
      ? [
          '',
          `! The browser showed ${money(Math.round(claimed))}. This email uses the server price.`,
          '  Usually means the rate card changed while the form was open — worth a look.',
        ]
      : []),
    ...(RATES_ARE_PLACEHOLDER
      ? ['', '! RATES ARE STILL PLACEHOLDERS — this estimate is not your real pricing.']
      : []),
    '',
    'Access notes:',
    accessNotes || '—',
    '',
    'Anything else:',
    notes || '—',
    '',
    '— sent from the Sala Nera booking form',
  ].join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(requestId ? { 'Idempotency-Key': `sala-nera-booking-${requestId}` } : {}),
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [NOTIFY_EMAIL],
        reply_to: email, // hit Reply and it reaches the agent
        subject: `New Booking Request — ${address}`,
        text,
      }),
    });

    if (!r.ok) {
      console.error('booking: resend rejected', r.status, await r.text());
      return json({ error: 'send_failed' }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    console.error('booking: send threw', err);
    return json({ error: 'send_failed' }, 502);
  }
}
