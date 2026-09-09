import { NextResponse } from 'next/server';
import { milesBetween } from '@/lib/distance';
import { geocodeAddress, hasGeocoding } from '@/lib/geocode';
import { BASE_LOCATION } from '@/lib/rates';

/**
 * Resolves an address to a distance, in miles from BASE_LOCATION — nothing
 * more. Pricing that distance is deliberately left to the caller: lib/quote.ts
 * is shared, isomorphic code the booking form already imports directly for
 * sqft and services, so the form calls quote(sqft, services, miles) itself
 * once this returns rather than trusting a second, server-computed price.
 * This route exists only because a geocode needs a key that must stay
 * server-only — the one thing here that genuinely cannot happen client-side.
 *
 * Called debounced as the address field is typed, well before the rest of a
 * booking exists.
 *
 * No telemetry here on purpose: lib/telemetry.ts records terminal outcomes
 * for leads, downloads and auth — a preview an agent may retype five times
 * before landing on a real address is not one of those.
 */

const MAX_BODY_BYTES = 2_000;

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

  // Same-origin only. This route costs a real Google API call per request
  // once a key exists, so it is worth keeping off someone else's page even
  // though nothing it returns is sensitive.
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
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const address = String(body.address ?? '').trim().slice(0, 240);

  // "Not available yet" is the honest answer in both of these cases, and the
  // same shape either way — the form should treat an unconfigured key and an
  // address Google can't place identically: show nothing, guess nothing.
  if (!address || !hasGeocoding()) {
    return json({ unavailable: true });
  }

  const point = await geocodeAddress(address);
  if (!point) return json({ unavailable: true });

  const miles = milesBetween(BASE_LOCATION, point);

  return json({ unavailable: false, miles: Math.round(miles * 10) / 10 });
}
