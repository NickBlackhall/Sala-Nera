import 'server-only';

import type { GeoPoint } from '@/lib/distance';

/**
 * Turns a street address into a coordinate, via Google's Geocoding API.
 *
 * Same shape as lib/storage.ts on purpose: hasGeocoding() is an honest
 * boolean, and geocodeAddress() only ever returns a real result or null,
 * never a guess. Until GOOGLE_MAPS_API_KEY is set, every address is honestly
 * ungeocoded — the travel line on the booking form simply does not appear,
 * rather than showing a distance that was never computed.
 *
 * Written and wired in before the key exists, same as R2 was — a 403 or
 * REQUEST_DENIED on the first real call is almost certainly the key or its
 * restrictions, not this code.
 */

export function hasGeocoding(): boolean {
  return !!process.env.GOOGLE_MAPS_API_KEY;
}

// Keeps a repeated lookup — an agent editing one character in the address
// field, or the server re-checking what the browser already resolved — from
// spending a second geocode call on a string already seen this run. Cleared
// on redeploy; that's fine, a cache miss just costs one more request.
const cache = new Map<string, GeoPoint | null>();
const MAX_CACHE_ENTRIES = 500;

/**
 * Loosely the DFW metro — biases Google's match toward "Dallas" the city
 * rather than a same-named street somewhere else in the country. Not a hard
 * boundary; Google can still return a point outside it.
 */
const DFW_BOUNDS = '32.0,-97.6|33.4,-96.0';

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const trimmed = address.trim();
  if (!trimmed) return null;

  if (cache.has(trimmed)) return cache.get(trimmed) ?? null;

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', trimmed);
  url.searchParams.set('key', key);
  url.searchParams.set('region', 'us');
  url.searchParams.set('bounds', DFW_BOUNDS);

  let point: GeoPoint | null = null;
  /**
   * Only a definitive answer from Google gets remembered — a located address,
   * or an honest ZERO_RESULTS. A timeout, a 500, or a refused key must NOT be
   * cached: doing so meant one bad second permanently marked that address
   * unpriceable for the life of the instance, long after Google recovered,
   * with nothing in the logs to explain why one property never got a travel
   * line. A transient failure should cost one retry, not the address.
   */
  let definitive = false;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
        const { lat, lng } = data.results[0].geometry.location;
        point = { lat, lng };
        definitive = true;
      } else if (data.status === 'ZERO_RESULTS') {
        definitive = true; // Google looked and there is genuinely nothing there.
      } else {
        // REQUEST_DENIED, OVER_QUERY_LIMIT, INVALID_REQUEST — configuration or
        // quota, not the address. Worth seeing in logs, not worth remembering.
        console.error('geocode: Google answered', data.status, data.error_message ?? '');
      }
    } else {
      console.error('geocode: HTTP', res.status);
    }
  } catch (err) {
    console.error('geocode: request failed', err);
  }

  if (definitive) {
    if (cache.size >= MAX_CACHE_ENTRIES) cache.clear(); // crude, cheap, fine at this volume
    cache.set(trimmed, point);
  }
  return point;
}
