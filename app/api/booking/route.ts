import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
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

  /**
   * Honeypot: answer 200 so the bot believes it succeeded and does not retry.
   * Logged, because every silent discard is indistinguishable from a lost lead
   * unless there is a trace of it somewhere.
   *
   * The field is `hp_ref`, not `company`. It was `company`, and browser autofill
   * filled it from the visitor's own saved profile — so a real agent with a
   * brokerage on file was quietly binned as a bot. Nick lost his own first two
   * bookings to it. Deliberately NOT still checking `company` as well: a page
   * cached from before this change posts an autofilled `company` and must now
   * sail through rather than be discarded.
   */
  if (clean(body.hp_ref, 50)) {
    console.warn('booking: discarded, honeypot filled');
    return json({ ok: true });
  }

  /**
   * A floor low enough that only a machine can be under it.
   *
   * This has now eaten real submissions twice. It began as "under 3 seconds or
   * over 2 hours". The upper bound threw away anyone who left the tab open; the
   * 3-second floor then threw away a fast run through the form, because with
   * autofill and a familiar form five steps really can take under three
   * seconds. Both failures looked identical to the sender: a success screen and
   * silence.
   *
   * 500ms is kept only to swat naive replay scripts that bother to send
   * startedAt at all. It is nearly worthless as a defence — a bot that omits
   * the field skips this entirely — so the honeypot and the origin check are
   * what actually stand here. If real spam ever arrives, the answer is rate
   * limiting, not a higher floor: every increase buys a little spam protection
   * and risks silently binning a paying client.
   */
  const startedAt = Number(body.startedAt ?? 0);
  if (startedAt) {
    const elapsed = Date.now() - startedAt;
    if (!Number.isFinite(elapsed) || elapsed < 500) {
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
  } catch (err) {
    console.error('booking: send threw', err);
    return json({ error: 'send_failed' }, 502);
  }

  /**
   * The agent's own copy, sent second and on purpose.
   *
   * Nick's notification above is the one that must not fail — it is the lead.
   * This one is reassurance. If it fails the booking is still real and still
   * in his inbox, so it must never turn a successful booking into an error on
   * screen. sendEmail() returns false rather than throwing for exactly this.
   */
  const confirmed = await sendEmail({
    to: email,
    replyTo: NOTIFY_EMAIL, // a reply reaches Nick, not the no-reply sender
    subject: `We've got your booking request — ${address}`,
    text: clientConfirmation({ name, address, desiredDate, priced }),
  });

  if (!confirmed) {
    // Worth knowing about: the agent is now waiting on a confirmation that
    // never arrived, even though Nick has the booking.
    console.error('booking: client confirmation failed to send to', email);
  }

  return json({ ok: true });
}

/**
 * What the person booking receives. Deliberately does not quote a total while
 * the rate card is placeholders — telling an agent their shoot costs $1,998
 * in writing, when that is an invented number, is how a made-up figure becomes
 * an argument later.
 */
function clientConfirmation({
  name, address, desiredDate, priced,
}: {
  name: string;
  address: string;
  desiredDate: string;
  priced: ReturnType<typeof quote>;
}): string {
  const firstName = name.split(/\s+/)[0] || 'there';

  return [
    `Thanks ${firstName} — we've got your request for ${address}.`,
    '',
    'What you asked for:',
    ...priced.lines.map((l) => `  - ${l.name}`),
    '',
    ...(desiredDate
      ? [
          `Requested date: ${desiredDate}`,
          "This date is not confirmed yet. We'll come back to you within one",
          'business day to confirm it, or offer the nearest alternatives.',
        ]
      : [
          "You didn't give us a preferred date, so we'll suggest a few when we",
          'reply — usually within one business day.',
        ]),
    '',
    ...(RATES_ARE_PLACEHOLDER
      ? [
          'The figures shown on the site are placeholders while our rate card is',
          "being finalised, so they are not a quote. We'll send real pricing for",
          'this property with our reply.',
        ]
      : [
          `Estimate: ${money(priced.total)}${
            priced.hasQuotedItems ? ', plus the items marked "quoted after"' : ''
          }`,
          'This is an estimate from the details you gave us, not a final invoice.',
        ]),
    '',
    'Nothing is booked until you hear back from us.',
    '',
    'Questions, or something to change? Just reply to this email.',
    '',
    '— Sala Nera',
    '  A Blackhall Media Group collection · Dallas–Fort Worth',
  ].join('\n');
}
