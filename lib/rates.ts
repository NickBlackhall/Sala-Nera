/**
 * The rate card. One source of truth for every price the site quotes.
 *
 * ⚠️ EVERY PRICE BELOW IS 999. That is deliberate, not a typo and not a real
 * rate — a uniform absurd number cannot be mistaken for pricing, which a
 * plausible-looking one could. Nick has not supplied real rates yet.
 *
 * Replace them, then set RATES_ARE_PLACEHOLDER to false — until you do, the
 * booking form says so on the page and every booking email carries a warning
 * line, so a placeholder can never quietly become a quote someone holds you to.
 *
 * One side effect to know about: while every tier costs the same, the boundary
 * checks in scripts/check-rates.mjs cannot fail, because every band agrees.
 * The script says so when it runs. Real numbers restore its teeth.
 *
 * Deliberately not `server-only`: the booking form prices the shoot live in the
 * browser from exactly the same data the server re-prices it from. Two rate
 * cards would be two chances to disagree, and the one that reaches the invoice
 * would be the wrong one.
 *
 * `scripts/rates-doc.mjs` renders this file into rates.md, which is what the
 * invoicing automation reads (see "The Invoicing System" in reference/). Run
 * `npm run rates:doc` after editing so the two cannot drift.
 */

import type { GeoPoint } from '@/lib/distance';

export const RATES_ARE_PLACEHOLDER = true;

/** Currency is USD throughout; amounts are whole dollars. */
export type Tier = {
  /** Inclusive upper bound in square feet. null means "no ceiling". */
  maxSqft: number | null;
  /** null means this tier is quoted individually rather than priced. */
  price: number | null;
};

export type Pricing =
  | { kind: 'tiered'; tiers: Tier[] }
  | { kind: 'flat'; price: number }
  /** Per-image or per-job work that cannot honestly be priced from a form. */
  | { kind: 'quoted'; note: string };

export type Service = {
  id: string;
  name: string;
  blurb: string;
  /** Core services are the shoot itself; add-ons attach to it. */
  group: 'core' | 'addon';
  pricing: Pricing;
};

export const SERVICES: Service[] = [
  {
    id: 'photography',
    name: 'Interior & exterior photography',
    blurb: 'The full set, edited and delivered in MLS and full resolution.',
    group: 'core',
    pricing: {
      kind: 'tiered',
      tiers: [
        { maxSqft: 1999, price: 999 },
        { maxSqft: 3499, price: 999 },
        { maxSqft: 4999, price: 999 },
        { maxSqft: 7499, price: 999 },
        { maxSqft: null, price: null }, // 7,500+ is quoted after a walkthrough
      ],
    },
  },
  {
    id: 'film',
    name: 'Cinematic property film',
    blurb: 'A 60–90 second film, scored and colour graded.',
    group: 'core',
    pricing: {
      kind: 'tiered',
      tiers: [
        { maxSqft: 3499, price: 999 },
        { maxSqft: 6999, price: 999 },
        { maxSqft: null, price: null },
      ],
    },
  },
  {
    id: 'drone-stills',
    name: 'Aerial stills',
    blurb: 'Licensed drone coverage of the property and its setting.',
    group: 'addon',
    pricing: { kind: 'flat', price: 999 },
  },
  {
    id: 'drone-video',
    name: 'Aerial video',
    blurb: 'Moving aerial footage, cut into the film or delivered on its own.',
    group: 'addon',
    pricing: { kind: 'flat', price: 999 },
  },
  {
    id: 'twilight',
    name: 'Twilight session',
    blurb: 'A second visit at dusk — the shot that sells the listing.',
    group: 'addon',
    pricing: { kind: 'flat', price: 999 },
  },
  {
    id: 'floorplan',
    name: 'Floor plan',
    blurb: 'Measured 2D plan, MLS ready.',
    group: 'addon',
    pricing: { kind: 'flat', price: 999 },
  },
  {
    id: 'tour-3d',
    name: '3D walkthrough tour',
    blurb: 'Navigable tour, hosted and linkable.',
    group: 'addon',
    pricing: { kind: 'flat', price: 999 },
  },
  {
    id: 'community',
    name: 'Community & lifestyle',
    blurb: 'The neighbourhood, amenities, and what living there looks like.',
    group: 'addon',
    pricing: { kind: 'flat', price: 999 },
  },
  {
    id: 'virtual-staging',
    name: 'Virtual staging',
    blurb: 'Furnished digitally, per image.',
    group: 'addon',
    // Per-image work: the count is not known until the shoot exists, so the
    // form must not pretend to price it. The guide is explicit about this.
    pricing: { kind: 'quoted', note: 'Priced per image once the set is chosen.' },
  },
  {
    id: 'rush',
    name: 'Next-morning delivery',
    blurb: 'Everything delivered by 9am the day after the shoot.',
    group: 'addon',
    pricing: { kind: 'flat', price: 999 },
  },
];

/**
 * Where "travel included" is measured from. Downtown Dallas, matching the
 * travel note this file already carried before any distance pricing existed
 * to enforce it — see HANDOFF.md. Straight-line distance, not drive time (see
 * lib/distance.ts for why). Point this at your actual studio or home address
 * instead if you'd rather anchor from there — it isn't wired to anything else.
 */
export const BASE_LOCATION: GeoPoint & { label: string } = {
  label: 'downtown Dallas',
  lat: 32.7767,
  lng: -96.797,
};

/** Distance is in miles, straight-line from BASE_LOCATION. */
export type DistanceBand = {
  /** Inclusive upper bound in miles. null means "no ceiling". */
  maxMiles: number | null;
  /** null means this band is quoted individually rather than priced. */
  surcharge: number | null;
};

/**
 * $0 for the first band is real, already-stated policy, not a placeholder —
 * it is the exact 30-mile figure this file used to carry as a sentence with
 * nothing behind it. The $999 band is a placeholder, same as everywhere else
 * in this file, and reads that way on the boundary check because 0 and 999
 * are not the same number — this pair of bands has teeth already, before any
 * real numbers land.
 */
export const TRAVEL_BANDS: DistanceBand[] = [
  { maxMiles: 30, surcharge: 0 },
  { maxMiles: 60, surcharge: 999 },
  { maxMiles: null, surcharge: null }, // 60+ miles is quoted after contact
];

/** Turns TRAVEL_BANDS into the sentence RATE_NOTES shows, so the two cannot drift apart. */
function describeTravelPolicy(): string {
  const sentences: string[] = [];

  /**
   * The previous band's ceiling, which is the number every sentence after the
   * first has to be phrased against. Miles are continuous, unlike square feet
   * — so "from 31 miles" is wrong where "over 30 miles" is right: a property
   * 30.4 miles out is past the included band, and the integer phrasing left
   * it in a gap the price list never named.
   */
  let previousCeiling: number | null = null;

  for (const band of TRAVEL_BANDS) {
    const from = previousCeiling;
    const fee = band.surcharge === null ? null : `$${band.surcharge.toLocaleString('en-US')}`;

    if (from === null && band.surcharge === 0 && band.maxMiles !== null) {
      sentences.push(`Travel is included within ${band.maxMiles} miles of ${BASE_LOCATION.label}.`);
    } else if (band.surcharge === null) {
      sentences.push(`Beyond ${from ?? 0} miles, travel is quoted before the shoot.`);
    } else if (band.maxMiles === null) {
      sentences.push(`Over ${from ?? 0} miles adds ${fee}.`);
    } else {
      sentences.push(`Over ${from ?? 0} and up to ${band.maxMiles} miles adds ${fee}.`);
    }

    if (band.maxMiles !== null) previousCeiling = band.maxMiles;
  }

  return sentences.join(' ');
}

/**
 * Rules that shape a quote but are not line items. Shown on the form so an
 * agent is never surprised by a number that was not on screen when they booked.
 */
export const RATE_NOTES: string[] = [
  describeTravelPolicy(),
  'Properties over 7,500 sq ft are quoted after a short walkthrough call.',
  'Estimates assume one visit. A twilight session is a second visit and is priced as such.',
];
