import { sql } from 'drizzle-orm';
import {
  pgTable, serial, text, integer, bigint, boolean, timestamp, index, uniqueIndex, jsonb,
} from 'drizzle-orm/pg-core';
import type { Details } from '@/lib/booking-details';
import type { QuoteLine } from '@/lib/quote';

/**
 * 'requested' is every booking written before instant booking existed, and any
 * that fails to claim a slot: an email to Nick, nothing promised. 'confirmed'
 * holds a real slot on a real calendar. 'cancelled' held one and gave it back —
 * kept rather than deleted so the history of a client's booking survives, and
 * so the day is released by the partial index below rather than by a delete.
 */
export type BookingStatus = 'requested' | 'confirmed' | 'cancelled';

/**
 * Five tables, per the portal spec.
 *
 * Note what is NOT here: no photo or video bytes. Media lives in R2; these rows
 * only carry the key that points at it. A property with a 2 GB film adds a few
 * kilobytes here.
 */

export const clients = pgTable(
  'clients',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    company: text('company'),
    phone: text('phone'),
    stripeCustomerId: text('stripe_customer_id'),
    // Agents work in teams and a listing is often shared across several
    // addresses at one brokerage. Clients sharing a team slug can see and
    // download each other's listings, so every ownership check must be
    // team-aware, not just email-equality.
    team: text('team'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('clients_email_key').on(t.email), index('clients_team_idx').on(t.team)],
);

export const listings = pgTable(
  'listings',
  {
    id: serial('id').primaryKey(),
    clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
    address: text('address').notNull(),
    slug: text('slug').notNull(),
    city: text('city'),
    shootDate: timestamp('shoot_date', { withTimezone: true }),
    coverKey: text('cover_key'),
    // The payment gate. True means previews are watermarked, video will not
    // play, and no signed download URL is ever minted.
    downloadLocked: boolean('download_locked').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('listings_slug_key').on(t.slug), index('listings_client_idx').on(t.clientId)],
);

export const media = pgTable(
  'media',
  {
    id: serial('id').primaryKey(),
    listingId: integer('listing_id')
      .references(() => listings.id, { onDelete: 'cascade' })
      .notNull(),
    kind: text('kind').notNull(), // 'photo' | 'video'
    r2Key: text('r2_key').notNull(),
    filename: text('filename').notNull(),
    bytes: bigint('bytes', { mode: 'number' }),
    width: integer('width'),
    height: integer('height'),
    sort: integer('sort').default(0).notNull(),
    // Smaller copies made after upload — see lib/media-copies.ts. Null until
    // made, and readers fall back to r2Key; highKey stays null for any
    // original that is already fine to hand out as the high-res download.
    gridKey: text('grid_key'),
    largeKey: text('large_key'),
    highKey: text('high_key'),
  },
  (t) => [index('media_listing_idx').on(t.listingId, t.sort)],
);

export const invoices = pgTable(
  'invoices',
  {
    stripeInvoiceId: text('stripe_invoice_id').primaryKey(),
    listingId: integer('listing_id').references(() => listings.id, { onDelete: 'set null' }),
    clientEmail: text('client_email'),
    propertyAddress: text('property_address'),
    status: text('status'),
    amountDue: integer('amount_due'),
    hostedInvoiceUrl: text('hosted_invoice_url'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('invoices_listing_idx').on(t.listingId)],
);

export const downloads = pgTable(
  'downloads',
  {
    id: serial('id').primaryKey(),
    // Nullable and SET NULL on purpose: re-uploading a listing's manifest
    // replaces media rows, and a hard FK would either block that or erase the
    // activity history. The filename below is denormalised for the same reason.
    mediaId: integer('media_id').references(() => media.id, { onDelete: 'set null' }),
    listingId: integer('listing_id').references(() => listings.id, { onDelete: 'cascade' }),
    clientEmail: text('client_email'),
    filename: text('filename'),
    // 'high' or 'low'. Null on rows from before the choice existed — all originals.
    resolution: text('resolution'),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('downloads_listing_idx').on(t.listingId), index('downloads_at_idx').on(t.at)],
);

/**
 * What happened, when, and why — the thing that was missing the day three
 * separate anti-spam rules threw away real bookings behind a success screen.
 *
 * Deliberately not foreign-keyed to anything. An event must survive the record
 * it describes being deleted, and must be writable when the thing it is
 * reporting on is precisely that a record could not be created.
 */
export const events = pgTable(
  'events',
  {
    id: serial('id').primaryKey(),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
    /** Which part of the system: 'booking' | 'inquiry' | 'download' | 'auth'. */
    kind: text('kind').notNull(),
    /** 'ok' | 'discarded' | 'rejected' | 'failed'. See lib/telemetry.ts. */
    outcome: text('outcome').notNull(),
    /** Short machine-readable cause, e.g. 'honeypot', 'too_fast', 'resend_rejected'. */
    reason: text('reason'),
    /** One line a human can read without decoding anything. */
    detail: text('detail'),
    /** Who it concerned, when there is a who. */
    email: text('email'),
    /** Ties an event to the browser request that caused it. */
    requestId: text('request_id'),
  },
  (t) => [index('events_at_idx').on(t.at), index('events_kind_idx').on(t.kind, t.at)],
);

/**
 * The rate card, versioned.
 *
 * One row per save, and the newest row is the live card — there is no "active"
 * flag, because two rows claiming to be active is a bug waiting to happen and
 * "newest wins" cannot be got wrong. Rolling back means saving an old card
 * again as a new version, which keeps the history honest: what was live, and
 * when, is never rewritten.
 *
 * The whole card is one jsonb document rather than relational rows because it
 * is edited as a whole. A half-saved rate card — services updated, travel
 * bands not — is a state no editor should be able to produce, and a single
 * document makes that structurally impossible rather than merely unlikely.
 *
 * An empty table is fine and expected: lib/rate-card.ts falls back to the
 * card defined in lib/rates.ts, so the site prices correctly before anyone
 * has ever opened the editor.
 */
export const rateCards = pgTable(
  'rate_cards',
  {
    id: serial('id').primaryKey(),
    /** A RateCard, as defined in lib/rates.ts. Validated before it ever lands here. */
    data: jsonb('data').notNull(),
    /** What changed, in Nick's words. Optional, but it is what makes history readable. */
    note: text('note'),
    editedBy: text('edited_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('rate_cards_created_idx').on(t.createdAt)],
);

/**
 * Every booking the form delivered. `lines` and `total` are a snapshot of the
 * quote, not a pointer to the rate card: a later price change must never
 * rewrite what someone was quoted. A null rate_card_version is the built-in card.
 */
export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),
    clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    brokerage: text('brokerage'),
    address: text('address').notNull(),
    sqft: integer('sqft'),
    desiredDate: text('desired_date'),
    details: jsonb('details').$type<Details>().notNull(),
    accessNotes: text('access_notes'),
    notes: text('notes'),
    lines: jsonb('lines').$type<QuoteLine[]>().notNull(),
    total: integer('total').notNull(),
    ratesArePlaceholder: boolean('rates_are_placeholder').notNull(),
    rateCardVersion: integer('rate_card_version'),
    // Unique, so a retried submission from the same open form lands once.
    requestId: text('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /**
     * The confirmed slot. Null on every row written before instant booking
     * existed — those are requests, where desired_date above is whatever the
     * client typed and nothing was ever promised. desired_date is deliberately
     * kept rather than migrated into these: it records what someone asked for,
     * which is not the same fact as what they were given.
     */
    status: text('status').$type<BookingStatus>().default('requested').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    /**
     * The local calendar day of the shoot, YYYY-MM-DD, as lib/scheduling.ts
     * reckons it. Stored rather than derived from starts_at because the
     * one-a-day rule is about Nick's day in Central time, and asking Postgres
     * which day an instant falls on means agreeing a time zone with it — one
     * more place for that to drift. Text here matches Slot.date exactly.
     */
    shootDate: text('shoot_date'),
    /** Google's id for the calendar event, so a cancellation can remove it. */
    calendarEventId: text('calendar_event_id'),
  },
  (t) => [
    uniqueIndex('bookings_request_id_key').on(t.requestId),
    index('bookings_client_idx').on(t.clientId),
    index('bookings_created_idx').on(t.createdAt),
    /**
     * The whole of the double-booking defence, and the reason it is a database
     * concern rather than an application one.
     *
     * Two agents can hold the form open, both be shown the same Thursday, and
     * both confirm within the same second. Checking availability and then
     * inserting cannot prevent that — between the check and the insert is
     * exactly where the second booking fits. Google cannot arbitrate it
     * either: its free/busy lags what has just been written. So the slot is
     * claimed here, in one all-or-nothing write, and whoever loses gets a
     * unique-violation to catch and turn into "that slot just went, here are
     * the next ones" rather than a confirmation screen for a shoot Nick cannot
     * do. Only the winner's booking is ever written to the calendar.
     *
     * Partial, so a cancelled booking releases the day rather than poisoning
     * it forever.
     */
    uniqueIndex('bookings_one_confirmed_per_day')
      .on(t.shootDate)
      .where(sql`${t.status} = 'confirmed'`),
  ],
);

export type Client = typeof clients.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Event = typeof events.$inferSelect;
export type RateCardRow = typeof rateCards.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
