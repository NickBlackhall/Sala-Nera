import {
  pgTable, serial, text, integer, bigint, boolean, timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core';

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
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('downloads_listing_idx').on(t.listingId), index('downloads_at_idx').on(t.at)],
);

export type Client = typeof clients.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type Media = typeof media.$inferSelect;
