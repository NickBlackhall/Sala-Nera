import 'server-only';

import { and, asc, count, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { getDatabase } from '@/lib/db';
import { bookings, clients, deliveryEmails, downloads, events, listings, media } from '@/lib/schema';
import type { Booking, DeliveryEmail, Event } from '@/lib/schema';
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
  delivered: DeliveryEmail[];
  /**
   * The booking that made this listing, or null on one Nick made by hand. Read
   * here so a first invoice can start from what the agent actually ordered
   * rather than an empty page — see seedLines() in lib/invoices.ts.
   */
  booking: Booking | null;
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

  // One row per file, and a zip is one row per photo in it, so this reads
  // far enough back for the page to group them into its last 20 downloads.
  const activity = await db
    .select()
    .from(downloads)
    .where(eq(downloads.listingId, listing.id))
    .orderBy(desc(downloads.at), desc(downloads.id))
    .limit(1000);

  let owner: Client | null = null;
  if (listing.clientId !== null) {
    const [row] = await db.select().from(clients).where(eq(clients.id, listing.clientId)).limit(1);
    owner = row ?? null;
  }

  const delivered = await db
    .select()
    .from(deliveryEmails)
    .where(eq(deliveryEmails.listingId, listing.id))
    .orderBy(desc(deliveryEmails.at))
    .limit(10);

  let booking: Booking | null = null;
  if (listing.bookingId !== null) {
    const [row] = await db.select().from(bookings).where(eq(bookings.id, listing.bookingId)).limit(1);
    booking = row ?? null;
  }

  return { listing, client: owner, media: items, activity, delivered, booking };
}

/** Records one "your photos are ready" email, after it has actually gone. */
export async function insertDeliveryEmail(input: typeof deliveryEmails.$inferInsert): Promise<void> {
  await getDatabase().insert(deliveryEmails).values(input);
}

export async function getClientById(id: number): Promise<Client | null> {
  const db = getDatabase();
  const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return row ?? null;
}

/** For the delete-client warning: how many listings would be left without an owner. */
export async function countListingsForClient(id: number): Promise<number> {
  const db = getDatabase();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(eq(listings.clientId, id));
  return row?.n ?? 0;
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

/** No coverKey: setListingCover is the only writer, so a listing save cannot stomp it. */
export type ListingInput = {
  address: string;
  slug: string;
  city: string | null;
  clientId: number | null;
  shootDate: Date | null;
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

export async function setListingCover(id: number, coverKey: string | null): Promise<void> {
  const db = getDatabase();
  await db.update(listings).set({ coverKey }).where(eq(listings.id, id));
}

export type MediaInput = {
  listingId: number;
  kind: 'photo' | 'video';
  r2Key: string;
  filename: string;
  bytes: number | null;
  width: number | null;
  height: number | null;
};

/**
 * New uploads sort after everything already there. The ::int cast matches the
 * count() calls above: this driver hands back some aggregates as strings, and
 * a string here would make the next sort "51" instead of 6.
 */
export async function nextMediaSort(listingId: number): Promise<number> {
  const db = getDatabase();
  const [row] = await db
    .select({ max: sql<number | null>`max(${media.sort})::int` })
    .from(media)
    .where(eq(media.listingId, listingId));
  return (row?.max ?? -1) + 1;
}

export async function insertMediaRow(input: MediaInput): Promise<Media> {
  const db = getDatabase();
  const sort = await nextMediaSort(input.listingId);
  const [row] = await db.insert(media).values({ ...input, sort }).returning();
  return row;
}

/** One media row plus the cover key of the listing it belongs to. */
export async function getMediaRow(
  id: number,
): Promise<{ media: Media; listingCoverKey: string | null } | null> {
  const db = getDatabase();
  const [row] = await db
    .select({ media, listingCoverKey: listings.coverKey })
    .from(media)
    .innerJoin(listings, eq(media.listingId, listings.id))
    .where(eq(media.id, id));

  return row ?? null;
}

export type MediaCopiesInput = {
  gridKey: string;
  largeKey: string;
  highKey: string | null;
  width: number;
  height: number;
};

/**
 * Record a photo's copies, and its real dimensions while at it — read on the
 * server from the file itself, so they are right even when the browser's
 * guess was not.
 *
 * Returns false when the row has gone: the photo was deleted while its copies
 * were being made. The caller then owns cleaning those copies up, since no row
 * will ever record them.
 */
export async function setMediaCopies(id: number, input: MediaCopiesInput): Promise<boolean> {
  const db = getDatabase();
  const rows = await db
    .update(media)
    .set(input)
    .where(eq(media.id, id))
    .returning({ id: media.id });
  return rows.length > 0;
}

export async function deleteMediaRow(id: number): Promise<void> {
  const db = getDatabase();
  await db.delete(media).where(eq(media.id, id));
}

/**
 * Write a new running order, position by position.
 *
 * Ids are filtered against the listing before anything is written, so a stale
 * page holding ids that have since moved or been deleted reorders only what is
 * genuinely still there rather than stamping sort values onto another
 * listing's rows.
 */
export async function reorderMedia(listingId: number, orderedIds: number[]): Promise<void> {
  const db = getDatabase();

  const owned = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.listingId, listingId), inArray(media.id, orderedIds)));

  const ownedIds = new Set(owned.map((r) => r.id));
  const toWrite = orderedIds.filter((id) => ownedIds.has(id));

  await Promise.all(
    toWrite.map((id, index) =>
      db.update(media).set({ sort: index }).where(eq(media.id, id)),
    ),
  );
}

/** Whatever now sorts first, for a listing that just lost its cover photo. */
export async function firstMediaKey(listingId: number): Promise<string | null> {
  const db = getDatabase();
  const [row] = await db
    .select({ r2Key: media.r2Key })
    .from(media)
    .where(eq(media.listingId, listingId))
    .orderBy(asc(media.sort), asc(media.id))
    .limit(1);

  return row?.r2Key ?? null;
}

/**
 * Every object key one listing owns, for deleting the bytes behind it.
 *
 * Must be read before deleteListingRow(): media rows cascade with the
 * listing, so afterwards there is nothing left to say which objects were
 * ever its.
 */
export async function getListingMediaKeys(listingId: number): Promise<string[]> {
  const db = getDatabase();
  const rows = await db
    .select({
      r2Key: media.r2Key,
      gridKey: media.gridKey,
      largeKey: media.largeKey,
      highKey: media.highKey,
    })
    .from(media)
    .where(eq(media.listingId, listingId));

  // Originals and their copies alike — a copy left behind is as orphaned as
  // an original would be.
  return rows.flatMap((r) =>
    [r.r2Key, r.gridKey, r.largeKey, r.highKey].filter((k): k is string => Boolean(k)),
  );
}

/** Media rows cascade; so do this listing's download records. */
export async function deleteListingRow(id: number): Promise<void> {
  const db = getDatabase();
  await db.delete(listings).where(eq(listings.id, id));
}

/** Their listings and bookings are not deleted — clientId on each just becomes null. */
export async function deleteClientRow(id: number): Promise<void> {
  const db = getDatabase();
  await db.delete(clients).where(eq(clients.id, id));
}

/** Just the slug, for building an upload's object key. Null if the listing is gone. */
export async function getListingSlug(id: number): Promise<string | null> {
  const db = getDatabase();
  const [row] = await db.select({ slug: listings.slug }).from(listings).where(eq(listings.id, id)).limit(1);
  return row?.slug ?? null;
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

export type AdminBookingRow = {
  booking: Booking;
  client: Client | null;
  listing: { id: number; slug: string } | null;
};

/** Newest bookings first, with the client account each landed in and the listing it made. */
export async function getRecentBookings(limit = 200): Promise<AdminBookingRow[]> {
  const db = getDatabase();
  return db
    .select({ booking: bookings, client: clients, listing: { id: listings.id, slug: listings.slug } })
    .from(bookings)
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .leftJoin(listings, eq(listings.bookingId, bookings.id))
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(limit);
}

/**
 * Releases a confirmed booking's day.
 *
 * Marks rather than deletes: the booking happened, the client was told it
 * happened, and that history is worth keeping. The partial unique index only
 * counts confirmed rows, so setting this is exactly what puts the day back on
 * the market — there is no second step, and no row to tidy up.
 *
 * Returns the calendar event id, if one was ever written, so the caller can
 * remove the event too. Nothing writes that column yet; it is here so the
 * cancel path does not have to be rebuilt when the calendar write lands.
 */
export async function cancelBookingRow(id: number): Promise<{ calendarEventId: string | null } | null> {
  const [row] = await getDatabase()
    .update(bookings)
    .set({ status: 'cancelled' })
    .where(and(eq(bookings.id, id), eq(bookings.status, 'confirmed')))
    .returning({ calendarEventId: bookings.calendarEventId });

  return row ?? null;
}
