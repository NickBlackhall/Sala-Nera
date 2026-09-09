import 'server-only';

import { desc } from 'drizzle-orm';
import { getDatabase, hasDatabase } from '@/lib/db';
import { DEFAULT_RATE_CARD, type RateCard } from '@/lib/rates';
import { rateCards } from '@/lib/schema';

/**
 * Where the live rate card comes from.
 *
 * The newest row in rate_cards wins. If there isn't one — no database, table
 * not created yet, nothing ever saved, or the query simply fails — the card
 * compiled into lib/rates.ts is used instead.
 *
 * That fallback is deliberately broad, and it is what makes this safe to ship
 * before the table exists: pricing is the one thing on this site that must
 * never fail to produce an answer, and "the rate card table is missing" is not
 * a reason to stop quoting a shoot. It is the same shape as lib/storage.ts and
 * lib/geocode.ts — a missing dependency degrades to something honest rather
 * than breaking the page.
 *
 * The consequence worth knowing: an editor save that somehow wrote an
 * unreadable card would silently serve the built-in one instead. Validation
 * therefore happens *before* a row is written, never on the way out.
 */

/** Shape check only — the real validation runs before a card is ever saved. */
function looksLikeRateCard(value: unknown): value is RateCard {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<RateCard>;
  return (
    Array.isArray(c.services) &&
    c.services.length > 0 &&
    Array.isArray(c.travelBands) &&
    c.travelBands.length > 0 &&
    typeof c.ratesArePlaceholder === 'boolean' &&
    !!c.baseLocation &&
    typeof c.baseLocation.lat === 'number' &&
    typeof c.baseLocation.lng === 'number'
  );
}

export type LoadedRateCard = {
  card: RateCard;
  /** The row this came from, or null when it is the built-in default. */
  version: number | null;
  /** True while the card is the one compiled into lib/rates.ts. */
  isDefault: boolean;
};

export async function loadRateCard(): Promise<LoadedRateCard> {
  const fallback: LoadedRateCard = { card: DEFAULT_RATE_CARD, version: null, isDefault: true };

  if (!hasDatabase()) return fallback;

  try {
    const [row] = await getDatabase()
      .select()
      .from(rateCards)
      .orderBy(desc(rateCards.id))
      .limit(1);

    if (!row || !looksLikeRateCard(row.data)) return fallback;

    return { card: row.data, version: row.id, isDefault: false };
  } catch (error) {
    // Includes "relation rate_cards does not exist", which is the expected
    // state between this deploying and the migration being run.
    console.warn('rate-card: falling back to the built-in card', error);
    return fallback;
  }
}
