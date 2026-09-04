import 'server-only';

import { and, asc, desc, eq, isNotNull, or } from 'drizzle-orm';
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

/** Look a viewer up by the email on their session. */
export async function getClientByEmail(email: string): Promise<Client | null> {
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

/**
 * Team-aware ownership, the rule lib/schema.ts warns about: a listing belongs
 * to a viewer if they are its client, or if both sit on the same non-null team.
 * A null team must never match another null team, or every unassigned client
 * would see every other unassigned client's work.
 */
export function ownsListing(viewer: Client, owner: Client | null): boolean {
  if (!owner) return false;
  if (owner.id === viewer.id) return true;
  return Boolean(viewer.team) && viewer.team === owner.team;
}

/** Every listing a viewer may see: their own plus their team's, newest first. */
export async function getListingsForViewer(viewer: Client): Promise<Listing[]> {
  const db = getDatabase();

  const scope = viewer.team
    ? or(eq(clients.id, viewer.id), and(isNotNull(clients.team), eq(clients.team, viewer.team)))
    : eq(clients.id, viewer.id);

  const rows = await db
    .select({ listing: listings })
    .from(listings)
    .innerJoin(clients, eq(listings.clientId, clients.id))
    .where(scope)
    .orderBy(desc(listings.shootDate), desc(listings.id));

  return rows.map((r) => r.listing);
}

/** Admins see everything. */
export async function getAllListings(): Promise<Listing[]> {
  const db = getDatabase();
  return db.select().from(listings).orderBy(desc(listings.shootDate), desc(listings.id));
}
