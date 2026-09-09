import { SERVICES, type Service, type Tier } from '@/lib/rates';

/**
 * Turns "this square footage, these services" into a priced estimate.
 *
 * Used in two places that must never disagree: the booking form prices live in
 * the browser as an agent types, and the booking route re-prices the same
 * submission on the server before it reaches an email that becomes an invoice.
 * The server's number is the one that counts — a form can be edited in a
 * devtools console, and the estimate is a number Nick may be held to.
 */

export type QuoteLine = {
  id: string;
  name: string;
  /** null when the item is real but cannot be priced from a form. */
  amount: number | null;
  note?: string;
};

export type Quote = {
  lines: QuoteLine[];
  /** Sum of the priced lines only. Quoted-after items are excluded by design. */
  total: number;
  /** True when at least one chosen item still needs a human number. */
  hasQuotedItems: boolean;
  /** Human label for the square-footage band, or null if none applies. */
  tierLabel: string | null;
};

const byId = new Map(SERVICES.map((s) => [s.id, s]));

/** The first tier whose ceiling the property fits under; the last tier catches the rest. */
function tierFor(tiers: Tier[], sqft: number): Tier {
  return tiers.find((t) => t.maxSqft === null || sqft <= t.maxSqft) ?? tiers[tiers.length - 1];
}

function describeTier(tiers: Tier[], sqft: number): string {
  const index = tiers.findIndex((t) => t.maxSqft === null || sqft <= t.maxSqft);
  const tier = tiers[index === -1 ? tiers.length - 1 : index];
  const floor = index > 0 ? (tiers[index - 1].maxSqft ?? 0) + 1 : 0;
  return tier.maxSqft === null
    ? `${floor.toLocaleString('en-US')}+ sq ft`
    : `${floor.toLocaleString('en-US')}–${tier.maxSqft.toLocaleString('en-US')} sq ft`;
}

function priceOne(service: Service, sqft: number | null): QuoteLine {
  const base = { id: service.id, name: service.name };

  switch (service.pricing.kind) {
    case 'flat':
      return { ...base, amount: service.pricing.price };

    case 'quoted':
      return { ...base, amount: null, note: service.pricing.note };

    case 'tiered': {
      // Without a square footage there is no tier, so this is honestly unpriced
      // rather than guessed at the cheapest band.
      if (sqft === null || !Number.isFinite(sqft) || sqft <= 0) {
        return { ...base, amount: null, note: 'Add square footage for a price' };
      }
      const tier = tierFor(service.pricing.tiers, sqft);
      return tier.price === null
        ? { ...base, amount: null, note: 'Quoted after a walkthrough call' }
        : { ...base, amount: tier.price };
    }
  }
}

export function quote(sqft: number | null, serviceIds: string[]): Quote {
  // Iterate SERVICES rather than serviceIds so the order on an invoice always
  // matches the order on the form, and unknown ids submitted by hand are
  // dropped instead of trusted.
  const chosen = SERVICES.filter((s) => serviceIds.includes(s.id));
  const lines = chosen.map((s) => priceOne(s, sqft));

  const tiered = chosen.find((s) => s.pricing.kind === 'tiered');
  const tierLabel =
    tiered && tiered.pricing.kind === 'tiered' && sqft && sqft > 0
      ? describeTier(tiered.pricing.tiers, sqft)
      : null;

  return {
    lines,
    total: lines.reduce((sum, l) => sum + (l.amount ?? 0), 0),
    hasQuotedItems: lines.some((l) => l.amount === null),
    tierLabel,
  };
}

export const money = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export { byId as serviceById };
