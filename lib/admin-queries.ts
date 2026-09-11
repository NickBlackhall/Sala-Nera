import 'server-only';

import { asc, count, desc, eq, gte, sql } from 'drizzle-orm';
import { getDatabase } from '@/lib/db';
import { bookings, clients, downloads, events, listings, media } from '@/lib/schema';
import type { Booking, Event } from '@/lib/schema';
import type { Client, Listing, Media } from '@/lib/schema';

/**
 * Reads and writes for the owner area only. Everything here assumes the caller
 * has already passed requireAdmin() — there is no ownership filtering in this
 * file, by design, because an admin sees the whole library.
 */

export type AdminListingRow = {
  listing: Listing;
  client: Client | null;
  mediaCount: number;
};

/** Every listing, with its client and media count, newest shoot first. */
export async function getAdminListings(): Promise<AdminListingRow[]> {
  const db = getDatabase();

  // One grouped query rather than a count per row: the dashboard shows every
  // listing, so per-row counts would be N+1 round trips to Neon over HTTP.
  return db
    .select({
      listing: listings,
      client: clients,
      mediaCount: sql<number>`count(${media.id})::int`,
    })
    .from(listings)
    .leftJoin(clients, eq(listings.clientId, clients.id))
    .leftJoin(media, eq(media.listingId, listings.id))
    .groupBy(listings.id, clients.id)
    .orderBy(desc(listings.shootDate), desc(listings.id));
}

export type AdminClientRow = { client: Client; listingCount: number };

/** Every client, with how many listings they own. */
export async function getAdminClients(): Promise<AdminClientRow[]> {
  const db = getDatabase();

  return db
    .select({
      client: clients,
      listingCount: sql<number>`count(${listings.id})::int`,
    })
    .from(clients)
    .leftJoin(listings, eq(listings.clientId, clients.id))
    .groupBy(clients.id)
    .orderBy(asc(clients.email));
}

export type AdminListingDetail = {
  listing: Listing;
  client: Client | null;
  media: Media[];
  activity: (typeof downloads.$inferSelect)[];
};

/** One listing, everything the edit page shows. */
export async function getAdminListing(id: number): Promise<AdminListingDetail | null> {
  const db = getDatabase();

  const [listing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!listing) return null;

  const items = await db
    .select()
    .from(media)
    .where(eq(media.listingId, listing.id))
    .orderBy(asc(media.sort), asc(media.id));

  // Empty until the signed-download route lands; the section is here so the
  // first real download shows up without another admin change.
  const activity = await db
    .select()
    .from(downloads)
    .where(eq(downloads.listingId, listing.id))
    .orderBy(desc(downloads.at))
    .limit(20);

  let owner: Client | null = null;
  if (listing.clientId !== null) {
    const [row] = await db.select().from(clients).where(eq(clients.id, listing.clientId)).limit(1);
    owner = row ?? null;
  }

  return { listing, client: owner, media: items, activity };
}

export async function getClientById(id: number): Promise<Client | null> {
  const db = getDatabase();
  const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return row ?? null;
}

/** Just id/email/company, for the owner dropdown on the listing form. */
export async function getClientOptions(): Promise<Pick<Client, 'id' | 'email' | 'company' | 'name'>[]> {
  const db = getDatabase();
  return db
    .select({ id: clients.id, email: clients.email, company: clients.company, name: clients.name })
    .from(clients)
    .orderBy(asc(clients.email));
}

// ---------------------------------------------------------------- writes

export type ClientInput = {
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  team: string | null;
};

export async function insertClient(input: ClientInput): Promise<Client> {
  const db = getDatabase();
  const [row] = await db.insert(clients).values(input).returning();
  return row;
}

export async function updateClientRow(id: number, input: ClientInput): Promise<void> {
  const db = getDatabase();
  await db.update(clients).set(input).where(eq(clients.id, id));
}

export type ListingInput = {
  address: string;
  slug: string;
  city: string | null;
  clientId: number | null;
  shootDate: Date | null;
  coverKey: string | null;
  downloadLocked: boolean;
};

export async function insertListing(input: ListingInput): Promise<Listing> {
  const db = getDatabase();
  const [row] = await db.insert(listings).values(input).returning();
  return row;
}

export async function updateListingRow(id: number, input: ListingInput): Promise<void> {
  const db = getDatabase();
  await db.update(listings).set(input).where(eq(listings.id, id));
}

/** The payment gate, flipped by hand. Stripe's webhook will call this later. */
export async function setListingLock(id: number, locked: boolean): Promise<void> {
  const db = getDatabase();
  await db.update(listings).set({ downloadLocked: locked }).where(eq(listings.id, id));
}

export async function setListingCover(id: number, coverKey: string): Promise<void> {
  const db = getDatabase();
  await db.update(listings).set({ coverKey }).where(eq(listings.id, id));
}

/** Media rows cascade; so do this listing's download records. */
export async function deleteListingRow(id: number): Promise<void> {
  const db = getDatabase();
  await db.delete(listings).where(eq(listings.id, id));
}

/** True when a slug is free, ignoring the listing being edited. */
export async function slugIsTaken(slug: string, exceptId?: number): Promise<boolean> {
  const db = getDatabase();
  const [row] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.slug, slug))
    .limit(1);
  return row !== undefined && row.id !== exceptId;
}

/** True when an email is already a client, ignoring the client being edited. */
export async function emailIsTaken(email: string, exceptId?: number): Promise<boolean> {
  const db = getDatabase();
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.email, email.toLowerCase()))
    .limit(1);
  return row !== undefined && row.id !== exceptId;
}

/**
 * The diagnostics feed. Newest first, capped — this is a "what just happened"
 * view for chasing a specific complaint, not an analytics warehouse.
 */
export async function getRecentEvents(limit = 200): Promise<Event[]> {
  const db = getDatabase();
  return db.select().from(events).orderBy(desc(events.at), desc(events.id)).limit(limit);
}

/** Counts per outcome over a window, so a bad day is visible at a glance. */
export async function getEventSummary(hours = 24): Promise<
  { outcome: string; kind: string; n: number }[]
> {
  const db = getDatabase();
  const since = new Date(Date.now() - hours * 3600_000);
  return db
    .select({ outcome: events.outcome, kind: events.kind, n: count() })
    .from(events)
    .where(gte(events.at, since))
    .groupBy(events.outcome, events.kind);
}

export type AdminBookingRow = { booking: Booking; client: Client | null };

/** Newest bookings first, with the client account each one landed in. */
export async function getRecentBookings(limit = 200): Promise<AdminBookingRow[]> {
  const db = getDatabase();
  return db
    .select({ booking: bookings, client: clients })
    .from(bookings)
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(limit);
}
