import 'server-only';

import { asc, eq } from 'drizzle-orm';
import { getDatabase } from '@/lib/db';
import { clients, listings, media } from '@/lib/schema';
import type { Client, Listing, Media } from '@/lib/schema';

/**
 * What a portal page needs to render one listing. Shaped to match the demo
 * fallback in lib/demo.ts so the page body is identical either way.
 */
export type ListingBundle = {
  listing: Listing;
  media: Media[];
  client: Client | null;
};

/**
 * Three small queries rather than one join: a listing has at most a few dozen
 * media rows, and joining would repeat every listing and client column across
 * all of them. The client is fetched only when the listing has one — clientId
 * is nullable and SET NULL on client deletion.
 *
 * No ownership check happens here. The portal is currently unauthenticated;
 * when sessions land, the team-aware check described in lib/schema.ts belongs
 * at the call site, not buried in this function.
 */
export async function getListingBySlug(slug: string): Promise<ListingBundle | null> {
  const db = getDatabase();

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.slug, slug))
    .limit(1);

  if (!listing) return null;

  // Ordered to match the media_listing_idx index on (listing_id, sort). The id
  // tiebreak keeps rendering stable when several rows share a sort value.
  const items = await db
    .select()
    .from(media)
    .where(eq(media.listingId, listing.id))
    .orderBy(asc(media.sort), asc(media.id));

  let client: Client | null = null;
  if (listing.clientId !== null) {
    const [row] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, listing.clientId))
      .limit(1);
    client = row ?? null;
  }

  return { listing, media: items, client };
}
