/**
 * Straight-line distance between two points, in miles.
 *
 * Deliberately not drive time. Two reasons: it needs nothing beyond a
 * geocode (no separate routing API, no per-request routing cost), and this
 * one function is meant to answer two different questions in the booking
 * system — how far a property is from the studio (the travel surcharge in
 * lib/rates.ts) and how much gap to leave between two consecutive shoots
 * (the scheduling buffer). One distance calculation, two callers, rather
 * than two that could quietly disagree.
 *
 * It overstates real drive time on anything but a direct route — DFW's
 * freeways are not straight lines — which is fine for placing a property in
 * a distance band, not fine for billing a mile rate. If a real drive-time
 * number is ever needed, it is a routing API call, not a change to this file.
 */

export type GeoPoint = { lat: number; lng: number };

const EARTH_RADIUS_MILES = 3958.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** The haversine formula. Pure, synchronous, no network — safe to call on every keystroke. */
export function milesBetween(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  // Clamped: floating-point can push h fractionally past 1, which would make
  // asin return NaN for two points that are, for this purpose, the same spot.
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}
