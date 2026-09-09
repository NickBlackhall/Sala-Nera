/**
 * The rate card. One source of truth for every price the site quotes.
 *
 * ⚠️ THE NUMBERS BELOW ARE PLACEHOLDERS. Nick has not supplied real rates yet.
 * Replace them, then set RATES_ARE_PLACEHOLDER to false — the booking form
 * shows a visible "indicative only" banner until you do, so a wrong number can
 * never quietly become a quote someone holds you to.
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
        { maxSqft: 1999, price: 275 },
        { maxSqft: 3499, price: 350 },
        { maxSqft: 4999, price: 450 },
        { maxSqft: 7499, price: 575 },
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
        { maxSqft: 3499, price: 650 },
        { maxSqft: 6999, price: 850 },
        { maxSqft: null, price: null },
      ],
    },
  },
  {
    id: 'drone-stills',
    name: 'Aerial stills',
    blurb: 'Licensed drone coverage of the property and its setting.',
    group: 'addon',
    pricing: { kind: 'flat', price: 175 },
  },
  {
    id: 'drone-video',
    name: 'Aerial video',
    blurb: 'Moving aerial footage, cut into the film or delivered on its own.',
    group: 'addon',
    pricing: { kind: 'flat', price: 250 },
  },
  {
    id: 'twilight',
    name: 'Twilight session',
    blurb: 'A second visit at dusk — the shot that sells the listing.',
    group: 'addon',
    pricing: { kind: 'flat', price: 225 },
  },
  {
    id: 'floorplan',
    name: 'Floor plan',
    blurb: 'Measured 2D plan, MLS ready.',
    group: 'addon',
    pricing: { kind: 'flat', price: 150 },
  },
  {
    id: 'tour-3d',
    name: '3D walkthrough tour',
    blurb: 'Navigable tour, hosted and linkable.',
    group: 'addon',
    pricing: { kind: 'flat', price: 275 },
  },
  {
    id: 'community',
    name: 'Community & lifestyle',
    blurb: 'The neighbourhood, amenities, and what living there looks like.',
    group: 'addon',
    pricing: { kind: 'flat', price: 200 },
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
    pricing: { kind: 'flat', price: 150 },
  },
];

/**
 * Rules that shape a quote but are not line items. Shown on the form so an
 * agent is never surprised by a number that was not on screen when they booked.
 */
export const RATE_NOTES: string[] = [
  'Travel is included within 30 miles of downtown Dallas. Beyond that it is quoted before the shoot.',
  'Properties over 7,500 sq ft are quoted after a short walkthrough call.',
  'Estimates assume one visit. A twilight session is a second visit and is priced as such.',
];

export const TRAVEL_RADIUS_MILES = 30;
