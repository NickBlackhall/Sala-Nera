/**
 * Renders lib/rates.ts into rates.md.
 *
 * Two things need the rate card and they read it differently: the website
 * prices a booking live from the typed data, and the invoicing automation
 * ("The Invoicing System" in reference/) reads plain English from rates.md.
 * Keeping two hand-maintained copies is how a price ends up right on the site
 * and wrong on an invoice, so this generates one from the other.
 *
 * Edit lib/rates.ts, then run:  npm run rates:doc
 */

import { writeFileSync } from 'node:fs';
import { SERVICES, RATE_NOTES, RATES_ARE_PLACEHOLDER, TRAVEL_BANDS, BASE_LOCATION } from '../lib/rates.ts';

const money = (n) => `$${n.toLocaleString('en-US')}`;

function tierRows(tiers) {
  const lines = [];
  let floor = 0;
  for (const tier of tiers) {
    const band =
      tier.maxSqft === null
        ? `${floor.toLocaleString('en-US')}+ sq ft`
        : `${floor.toLocaleString('en-US')}–${tier.maxSqft.toLocaleString('en-US')} sq ft`;
    lines.push(`| ${band} | ${tier.price === null ? 'Quoted after a walkthrough' : money(tier.price)} |`);
    if (tier.maxSqft === null) break;
    floor = tier.maxSqft + 1;
  }
  return lines;
}

function section(service) {
  const out = [`### ${service.name}`, '', service.blurb, ''];

  if (service.pricing.kind === 'flat') {
    out.push(`**${money(service.pricing.price)}**, flat.`, '');
  } else if (service.pricing.kind === 'quoted') {
    out.push(`**Quoted after.** ${service.pricing.note}`, '');
  } else {
    out.push('| Property size | Price |', '|---|---|', ...tierRows(service.pricing.tiers), '');
  }

  return out;
}

const core = SERVICES.filter((s) => s.group === 'core');
const addons = SERVICES.filter((s) => s.group === 'addon');

// Phrased against the previous band's ceiling, not an incremented floor —
// miles are continuous, so "31–60" silently leaves 30.4 in a gap the table
// never names. Matches describeTravelPolicy() in lib/rates.ts.
function travelRows() {
  const lines = [];
  let previousCeiling = null;
  for (const band of TRAVEL_BANDS) {
    const range =
      previousCeiling === null
        ? `Up to ${band.maxMiles} miles`
        : band.maxMiles === null
          ? `Over ${previousCeiling} miles`
          : `Over ${previousCeiling}, up to ${band.maxMiles} miles`;
    const price = band.outOfArea
      ? 'Outside the service area — ask'
      : band.surcharge === null
        ? 'Quoted after contact'
        : band.surcharge === 0
          ? 'Included'
          : money(band.surcharge);
    lines.push(`| ${range} | ${price} |`);
    if (band.maxMiles !== null) previousCeiling = band.maxMiles;
  }
  return lines;
}

const doc = [
  '# Rate card — Sala Nera',
  '',
  '<!-- GENERATED FILE. Do not edit by hand.',
  '     Source of truth is lib/rates.ts; regenerate with `npm run rates:doc`.',
  '     Editing this file directly means the website and your invoices disagree. -->',
  '',
  ...(RATES_ARE_PLACEHOLDER
    ? [
        '> ⚠️ **The shoot and add-on prices below are placeholders, not real pricing.**',
        '> Replace the values in `lib/rates.ts`, set `RATES_ARE_PLACEHOLDER` to',
        '> `false`, and regenerate this file. Until then the booking form shows a',
        '> visible "indicative only" notice and every booking email says so too.',
        '>',
        "> **The Travel section is exempt — those are Nick's real trip charges.**",
        '> Bill them as written. The placeholder flag is one global switch and does',
        '> not distinguish, which is why this note has to.',
        '',
      ]
    : []),
  'Every price the site quotes and every invoice line comes from here.',
  '',
  '## The shoot',
  '',
  ...core.flatMap(section),
  '## Add-ons',
  '',
  ...addons.flatMap(section),
  '## Travel',
  '',
  `Straight-line distance from ${BASE_LOCATION.label}.`,
  '',
  '| Distance | Surcharge |',
  '|---|---|',
  ...travelRows(),
  '',
  '## Rules',
  '',
  ...RATE_NOTES.map((n) => `- ${n}`),
  '',
  '## For the invoicing automation',
  '',
  '- Never guess a price. If an item is not listed above, stop and ask.',
  '- One line item per service or add-on, named exactly as written above.',
  '- The invoice memo always starts with the property address, then the shoot',
  '  date — e.g. `4200 Preston Hollow Lane, Dallas — shoot 8/14`. The client',
  '  portal matches invoices to listings on that address, so a memo without one',
  '  will never unlock a gallery.',
  '- Create as a draft. A human presses Send.',
  '',
].join('\n');

writeFileSync(new URL('../rates.md', import.meta.url), doc);
console.log(
  `rates.md written — ${core.length} core services, ${addons.length} add-ons${
    RATES_ARE_PLACEHOLDER ? ' (PLACEHOLDER PRICING)' : ''
  }`,
);
