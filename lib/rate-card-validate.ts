import type { DistanceBand, RateCard, Service, Tier } from '@/lib/rates';

/**
 * Everything TypeScript used to guarantee for free.
 *
 * While the rate card was typed code, a gapped tier or a negative price could
 * not survive a build. Once Nick can edit it in a browser, the compiler is out
 * of the loop and this is what stands in its place — so it runs *before* a row
 * is written, never after. lib/rate-card.ts falls back to the built-in card on
 * anything it cannot read, which means an invalid card that reached the
 * database would fail silently rather than loudly. The only safe place to
 * catch it is the save.
 *
 * Deliberately not `server-only`: scripts/check-rates.mjs runs the same checks
 * against the built-in card, so the rules cannot drift between what the editor
 * enforces and what the codebase ships.
 */

export type Problem = { where: string; message: string };

const isWholeMoney = (v: unknown): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && Number.isInteger(v);

function checkTiers(tiers: Tier[], where: string, problems: Problem[]): void {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    problems.push({ where, message: 'Needs at least one size band.' });
    return;
  }

  tiers.forEach((tier, i) => {
    const at = `${where}, band ${i + 1}`;
    const last = i === tiers.length - 1;

    if (tier.maxSqft === null) {
      // Only the final band may be open-ended. An open band in the middle
      // swallows every larger property, and the bands after it never price
      // anything — silently, because nothing throws.
      if (!last) problems.push({ where: at, message: 'Only the last band can be open-ended.' });
    } else if (!Number.isInteger(tier.maxSqft) || tier.maxSqft <= 0) {
      problems.push({ where: at, message: 'Upper limit must be a whole number above zero.' });
    } else if (last) {
      problems.push({
        where: at,
        message: 'The last band must be open-ended, or properties above it are priced as if they were smaller.',
      });
    }

    if (tier.price !== null && !isWholeMoney(tier.price)) {
      problems.push({ where: at, message: 'Price must be a whole dollar amount, or left as quoted-after.' });
    }

    const prev = tiers[i - 1];
    if (prev && prev.maxSqft !== null && tier.maxSqft !== null && tier.maxSqft <= prev.maxSqft) {
      problems.push({ where: at, message: 'Each band must be larger than the one before it.' });
    }
  });
}

function checkService(service: Service, index: number, problems: Problem[]): void {
  const where = service.name?.trim() || `Service ${index + 1}`;

  if (!service.id || !/^[a-z0-9-]+$/.test(service.id)) {
    problems.push({ where, message: 'Id must be lowercase letters, numbers and hyphens.' });
  }
  if (service.id === 'travel') {
    // quote() adds its own line under this id; a service sharing it would have
    // its price rendered in the other's place on the form.
    problems.push({ where, message: '"travel" is reserved — the travel line already uses it.' });
  }
  if (!service.name?.trim()) problems.push({ where, message: 'Needs a name.' });
  if (service.group !== 'core' && service.group !== 'addon') {
    problems.push({ where, message: 'Must be either a core service or an add-on.' });
  }

  const pricing = service.pricing;
  if (!pricing || typeof pricing !== 'object') {
    problems.push({ where, message: 'Needs a price.' });
    return;
  }

  if (pricing.kind === 'flat') {
    if (!isWholeMoney(pricing.price)) {
      problems.push({ where, message: 'Flat price must be a whole dollar amount.' });
    }
  } else if (pricing.kind === 'quoted') {
    if (!pricing.note?.trim()) {
      problems.push({ where, message: 'Quoted-after items need a note saying what decides the price.' });
    }
  } else if (pricing.kind === 'tiered') {
    checkTiers(pricing.tiers, where, problems);
  } else {
    problems.push({ where, message: 'Unrecognised pricing type.' });
  }
}

function checkTravelBands(bands: DistanceBand[], problems: Problem[]): void {
  const where = 'Travel';

  if (!Array.isArray(bands) || bands.length === 0) {
    problems.push({ where, message: 'Needs at least one distance band.' });
    return;
  }

  bands.forEach((band, i) => {
    const at = `${where}, band ${i + 1}`;
    const last = i === bands.length - 1;

    if (band.maxMiles === null) {
      if (!last) problems.push({ where: at, message: 'Only the last band can be open-ended.' });
    } else if (typeof band.maxMiles !== 'number' || band.maxMiles <= 0) {
      problems.push({ where: at, message: 'Distance must be above zero.' });
    } else if (last) {
      // Without an open final band, anything past the furthest ceiling falls
      // back to that band's price — so a 500-mile job would quietly bill as if
      // it were 75 miles, with no error anywhere.
      problems.push({
        where: at,
        message: 'The last band must be open-ended, or any distance past it is charged as if it were nearer.',
      });
    }

    if (band.surcharge !== null && !isWholeMoney(band.surcharge)) {
      problems.push({ where: at, message: 'Surcharge must be a whole dollar amount, or left unpriced.' });
    }
    if (band.outOfArea && band.surcharge !== null) {
      problems.push({ where: at, message: 'A band outside the service area cannot also carry a price.' });
    }

    const prev = bands[i - 1];
    if (prev && prev.maxMiles !== null && band.maxMiles !== null && band.maxMiles <= prev.maxMiles) {
      problems.push({ where: at, message: 'Each band must reach further than the one before it.' });
    }
  });
}

function checkAppliesTo(service: Service, cores: Service[], problems: Problem[]): void {
  if (service.appliesTo === undefined) return;
  const where = service.name?.trim() || service.id;

  if (service.group !== 'addon') {
    problems.push({ where, message: 'Only an add-on can be tied to another service.' });
  }
  if (!Array.isArray(service.appliesTo) || service.appliesTo.length === 0) {
    problems.push({ where, message: 'Pick at least one service it goes with, or make it always available.' });
    return;
  }

  const unknown = service.appliesTo.filter((id) => !cores.some((c) => c.id === id));
  for (const id of unknown) {
    problems.push({ where, message: `Tied to "${id}", which is not a core service.` });
  }
  // Every core it needs being retired hides it from the form with no error anywhere.
  if (
    unknown.length === 0 &&
    !service.archived &&
    service.appliesTo.every((id) => cores.find((c) => c.id === id)?.archived)
  ) {
    problems.push({ where, message: 'Every service it goes with is retired, so it can never be offered.' });
  }
}

export function validateRateCard(card: RateCard): Problem[] {
  const problems: Problem[] = [];

  if (!Array.isArray(card.services) || card.services.length === 0) {
    problems.push({ where: 'Services', message: 'Keep at least one service — the form cannot take a booking without one.' });
  } else {
    const live = card.services.filter((s) => !s.archived);
    if (live.length === 0) {
      problems.push({ where: 'Services', message: 'Everything is retired — the booking form would have nothing to offer.' });
    }

    const cores = card.services.filter((s) => s.group === 'core');
    const seen = new Set<string>();
    card.services.forEach((service, i) => {
      if (seen.has(service.id)) {
        problems.push({ where: service.name || service.id, message: `Two services share the id "${service.id}".` });
      }
      seen.add(service.id);
      checkService(service, i, problems);
      checkAppliesTo(service, cores, problems);
    });
  }

  checkTravelBands(card.travelBands, problems);

  const base = card.baseLocation;
  if (!base || typeof base.lat !== 'number' || typeof base.lng !== 'number') {
    problems.push({ where: 'Base location', message: 'Needs a latitude and longitude.' });
  } else if (Math.abs(base.lat) > 90 || Math.abs(base.lng) > 180) {
    problems.push({ where: 'Base location', message: 'That is not a point on Earth.' });
  } else if (!base.label?.trim()) {
    problems.push({ where: 'Base location', message: 'Needs a name — it is quoted in the travel policy text.' });
  }

  if (typeof card.ratesArePlaceholder !== 'boolean') {
    problems.push({ where: 'Placeholder flag', message: 'Must be on or off.' });
  }

  return problems;
}
