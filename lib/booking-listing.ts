import 'server-only';

import { and, eq, notExists } from 'drizzle-orm';
import { getDatabase } from '@/lib/db';
import { listings, media } from '@/lib/schema';
import { slugify } from '@/lib/slug';

/**
 * Every booking makes its own listing — locked, empty, and already in the
 * agent's account — so Nick never retypes an address, and the agent can see
 * the shoot is booked before there is anything to deliver. Nick's choice,
 * over a one-click "create listing" button, on Sep 21 2026.
 *
 * Cancelling the booking takes the listing away again, but only while it is
 * still empty. Once a photo is in it, the listing is delivery, not a booking,
 * and nothing about the booking may delete it.
 */

/**
 * "4840 Serenity Trail, McKinney, TX 75071, USA" → street and "McKinney, TX",
 * the shape a listing keeps them in. The booking form's address is free text,
 * so this only splits what it can split safely. Anything else stays whole in
 * the street, where Nick can tidy it in /admin.
 */
export function splitAddress(full: string): { street: string; city: string | null } {
  const parts = full
    .replace(/\s+/g, ' ')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1 && /^(usa|us|united states( of america)?)$/i.test(parts[parts.length - 1])) {
    parts.pop();
  }

  const stateZip = /^([A-Za-z]{2})(\s+\d{5}(-\d{4})?)?$/;
  const last = parts[parts.length - 1] ?? '';
  const state = last.match(stateZip)?.[1]?.toUpperCase();

  if (state && parts.length >= 3) {
    return { street: parts.slice(0, -2).join(', '), city: `${parts[parts.length - 2]}, ${state}` };
  }
  if (state && parts.length === 2) {
    // "14628 Flanders Ct Addison, TX 75001": the city is stuck to the street
    // with nothing to split on, so it stays there rather than being guessed.
    return { street: parts[0], city: null };
  }
  if (parts.length >= 2) {
    return { street: parts.slice(0, -1).join(', '), city: parts[parts.length - 1] };
  }
  return { street: parts[0] ?? full.trim(), city: null };
}

export type BookingListing = { id: number; slug: string; created: boolean };

/**
 * The listing for one booking, made if it does not exist yet.
 *
 * Safe to call twice for the same booking — a retried submission does — and
 * safe against another listing already holding the street's slug, which two
 * houses on one street will: it tries "serenity-trail", then
 * "serenity-trail-2", and so on. Each attempt is the insert itself, so two
 * bookings racing for one slug cannot both get it.
 */
export async function ensureBookingListing(input: {
  bookingId: number;
  address: string;
  clientId: number | null;
  /** The shoot's local day, YYYY-MM-DD, or null for a request with no slot. */
  shootDate: string | null;
}): Promise<BookingListing> {
  const db = getDatabase();
  const { street, city } = splitAddress(input.address);
  const base = slugify(street) || 'listing';

  for (let n = 1; n <= 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const [row] = await db
      .insert(listings)
      .values({
        bookingId: input.bookingId,
        address: street,
        city,
        slug,
        clientId: input.clientId,
        // Midday UTC, as the admin form stores it, so no time zone can move
        // the shoot onto the day before.
        shootDate: input.shootDate ? new Date(`${input.shootDate}T12:00:00Z`) : null,
        downloadLocked: true,
      })
      .onConflictDoNothing()
      .returning({ id: listings.id, slug: listings.slug });
    if (row) return { ...row, created: true };

    // Either the slug is taken, or this booking already has its listing.
    const [existing] = await db
      .select({ id: listings.id, slug: listings.slug })
      .from(listings)
      .where(eq(listings.bookingId, input.bookingId))
      .limit(1);
    if (existing) return { ...existing, created: false };
  }

  throw new Error(`no free slug for "${base}"`);
}

/**
 * What cancelling a booking does to its listing: removes it if nothing has
 * been uploaded to it, keeps it if anything has. The emptiness check is part
 * of the delete itself, so an upload landing mid-cancel wins.
 */
export async function releaseBookingListing(
  bookingId: number,
): Promise<'deleted' | 'kept' | 'none'> {
  const db = getDatabase();
  const [listing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.bookingId, bookingId))
    .limit(1);
  if (!listing) return 'none';

  const deleted = await db
    .delete(listings)
    .where(
      and(
        eq(listings.id, listing.id),
        notExists(db.select({ id: media.id }).from(media).where(eq(media.listingId, listing.id))),
      ),
    )
    .returning({ id: listings.id });

  return deleted.length > 0 ? 'deleted' : 'kept';
}
