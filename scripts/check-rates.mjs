/**
 * Checks the pricing engine against the rate card, with the emphasis on tier
 * boundaries — the square foot either side of a band edge is where a pricing
 * bug actually lives, and it is the kind that quietly undercharges for months.
 *
 * These assertions read tier edges out of lib/rates.ts rather than hard-coding
 * dollar amounts, so they keep working when Nick replaces the placeholder
 * numbers with his real ones.
 *
 *   npm run check:rates
 */

import { chosenLines, quote, travelLine } from '../lib/quote.ts';
import { SERVICES, SERVICE_AREA_MILES, TRAVEL_BANDS } from '../lib/rates.ts';

let failures = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return;
  console.error(`FAIL  ${label}\n        expected ${e}\n        actual   ${a}`);
  failures += 1;
}

const amountFor = (sqft, id) => quote(sqft, [id]).lines[0]?.amount ?? null;

for (const service of SERVICES) {
  if (service.pricing.kind !== 'tiered') continue;

  let floor = 0;
  for (const tier of service.pricing.tiers) {
    // The bottom of every band prices as that band.
    check(`${service.id} @ ${floor} (band floor)`, amountFor(floor || 1, service.id), tier.price);

    if (tier.maxSqft !== null) {
      // The exact ceiling belongs to this band...
      check(`${service.id} @ ${tier.maxSqft} (band ceiling)`, amountFor(tier.maxSqft, service.id), tier.price);
      // ...and one square foot more does not.
      const next = service.pricing.tiers.find(
        (t) => t.maxSqft === null || t.maxSqft > tier.maxSqft,
      );
      check(
        `${service.id} @ ${tier.maxSqft + 1} (over the edge)`,
        amountFor(tier.maxSqft + 1, service.id),
        next?.price ?? null,
      );
      floor = tier.maxSqft + 1;
    }
  }

  // No square footage means no tier, and an honest "unpriced" rather than a
  // guess at the cheapest band.
  check(`${service.id} with no sqft`, amountFor(null, service.id), null);
  check(`${service.id} with sqft 0`, amountFor(0, service.id), null);
}

for (const service of SERVICES) {
  if (service.pricing.kind === 'flat') {
    // Flat items ignore square footage entirely.
    check(`${service.id} flat @ 500`, amountFor(500, service.id), service.pricing.price);
    check(`${service.id} flat @ 50000`, amountFor(50_000, service.id), service.pricing.price);
    check(`${service.id} flat with no sqft`, amountFor(null, service.id), service.pricing.price);
  }
  if (service.pricing.kind === 'quoted') {
    check(`${service.id} is never priced`, amountFor(4000, service.id), null);
  }
}

// Totals exclude quoted-after items rather than treating them as free.
const quotedId = SERVICES.find((s) => s.pricing.kind === 'quoted')?.id;
const flat = SERVICES.find((s) => s.pricing.kind === 'flat');
if (quotedId && flat) {
  const q = quote(3000, [flat.id, quotedId]);
  check('total ignores quoted items', q.total, flat.pricing.price);
  check('quoted items are flagged', q.hasQuotedItems, true);
}

// Ids that do not exist are dropped, not trusted.
check('unknown ids drop out', quote(3000, ['not-a-service']).lines.length, 0);
check('duplicate ids count once', quote(3000, [flat.id, flat.id]).lines.length, 1);

// Same boundary logic as the sqft tiers above, for TRAVEL_BANDS. Unlike the
// sqft tiers, the free-vs-surcharge edge (0 vs 999) is real even while every
// dollar figure is a placeholder, so this block has teeth today.
{
  let floor = 0;
  for (const band of TRAVEL_BANDS) {
    check(`travel @ ${floor}mi (band floor)`, travelLine(floor)?.amount ?? null, band.surcharge);

    if (band.maxMiles !== null) {
      check(`travel @ ${band.maxMiles}mi (band ceiling)`, travelLine(band.maxMiles)?.amount ?? null, band.surcharge);
      const next = TRAVEL_BANDS.find((b) => b.maxMiles === null || b.maxMiles > band.maxMiles);
      check(
        `travel @ ${band.maxMiles + 1}mi (over the edge)`,
        travelLine(band.maxMiles + 1)?.amount ?? null,
        next?.surcharge ?? null,
      );
      floor = band.maxMiles + 1;
    }
  }
}
check('travel with no distance known', travelLine(null), null);
check('travel rejects a negative distance', travelLine(-1), null);

// The travel line rides in quote().lines alongside the services, under the id
// 'travel'. A service claiming that id would collide with it — the form looks
// its card price up by id, so one would quietly render the other's number.
check(
  "no service uses the reserved id 'travel'",
  SERVICES.some((s) => s.id === 'travel'),
  false,
);

/**
 * The booking route refuses a submission that names no real service, so a
 * booking for nothing cannot arrive priced at zero. Travel broke that once:
 * it is appended from the address, so a payload naming only junk ids still
 * produced one line and satisfied a plain lines.length check. chosenLines()
 * is what that guard must count, and this is the case that proves it.
 */
const junkWithTravel = quote(3000, ['not-a-service'], 40);
check('junk ids + a real address still price something', junkWithTravel.lines.length, 1);
check('...but nothing the customer chose', chosenLines(junkWithTravel).length, 0);
check('travel is marked automatic', travelLine(40)?.automatic, true);

// The service-area edge is a boundary, not a price. These two must not drift:
// SERVICE_AREA_MILES is what the form and both emails quote at people.
check('inside the service area', travelLine(SERVICE_AREA_MILES)?.outOfArea, false);
check('past the service area', travelLine(SERVICE_AREA_MILES + 1)?.outOfArea, true);
check('out of area carries no price', travelLine(SERVICE_AREA_MILES + 1)?.amount, null);
check('services are not', quote(3000, [flat.id]).lines[0].automatic, undefined);

/**
 * A boundary check can only catch a bug when the two bands either side of the
 * edge cost different amounts. While the rate card is all placeholders they do
 * not, so the checks above pass without proving anything — say so rather than
 * report a green run that means nothing.
 */
const tieredPrices = SERVICES.flatMap((s) =>
  s.pricing.kind === 'tiered' ? s.pricing.tiers.map((t) => t.price).filter((p) => p !== null) : [],
);
const vacuous = new Set(tieredPrices).size <= 1;

if (failures === 0) {
  console.log('Pricing matches the rate card, including every tier boundary.');
  if (vacuous) {
    console.log(
      '\nNote: every tier currently costs the same, so the boundary checks cannot\n' +
        'fail. They prove nothing until real rates land in lib/rates.ts.',
    );
  }
} else {
  console.error(`\n${failures} pricing check(s) failed.`);
  process.exit(1);
}
