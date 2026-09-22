import 'server-only';

export const PORTAL_MIGRATION_ID = '0008_archives';

/**
 * Kept as discrete statements so Neon can execute the migration atomically.
 * Every statement is idempotent; the endpoint is safe to retry after a timeout.
 */
export const PORTAL_MIGRATION_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "clients" (
    "id" serial PRIMARY KEY NOT NULL,
    "email" text NOT NULL,
    "name" text,
    "company" text,
    "phone" text,
    "stripe_customer_id" text,
    "team" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "clients_email_key" ON "clients" USING btree ("email")`,
  `CREATE INDEX IF NOT EXISTS "clients_team_idx" ON "clients" USING btree ("team")`,
  `CREATE TABLE IF NOT EXISTS "listings" (
    "id" serial PRIMARY KEY NOT NULL,
    "client_id" integer,
    "address" text NOT NULL,
    "slug" text NOT NULL,
    "city" text,
    "shoot_date" timestamp with time zone,
    "cover_key" text,
    "download_locked" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "listings_client_id_clients_id_fk"
      FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id")
      ON DELETE set null ON UPDATE no action
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "listings_slug_key" ON "listings" USING btree ("slug")`,
  `CREATE INDEX IF NOT EXISTS "listings_client_idx" ON "listings" USING btree ("client_id")`,
  `CREATE TABLE IF NOT EXISTS "media" (
    "id" serial PRIMARY KEY NOT NULL,
    "listing_id" integer NOT NULL,
    "kind" text NOT NULL,
    "r2_key" text NOT NULL,
    "filename" text NOT NULL,
    "bytes" bigint,
    "width" integer,
    "height" integer,
    "sort" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "media_listing_id_listings_id_fk"
      FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id")
      ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE INDEX IF NOT EXISTS "media_listing_idx" ON "media" USING btree ("listing_id", "sort")`,
  `CREATE TABLE IF NOT EXISTS "invoices" (
    "stripe_invoice_id" text PRIMARY KEY NOT NULL,
    "listing_id" integer,
    "client_email" text,
    "property_address" text,
    "status" text,
    "amount_due" integer,
    "hosted_invoice_url" text,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "invoices_listing_id_listings_id_fk"
      FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id")
      ON DELETE set null ON UPDATE no action
  )`,
  `CREATE INDEX IF NOT EXISTS "invoices_listing_idx" ON "invoices" USING btree ("listing_id")`,
  `CREATE TABLE IF NOT EXISTS "downloads" (
    "id" serial PRIMARY KEY NOT NULL,
    "media_id" integer,
    "listing_id" integer,
    "client_email" text,
    "filename" text,
    "at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "downloads_media_id_media_id_fk"
      FOREIGN KEY ("media_id") REFERENCES "public"."media"("id")
      ON DELETE set null ON UPDATE no action,
    CONSTRAINT "downloads_listing_id_listings_id_fk"
      FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id")
      ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE INDEX IF NOT EXISTS "downloads_listing_idx" ON "downloads" USING btree ("listing_id")`,
  `CREATE INDEX IF NOT EXISTS "downloads_at_idx" ON "downloads" USING btree ("at")`,
  // Diagnostics. No foreign keys on purpose: an event must outlive whatever it
  // describes, and must be writable when the thing being reported is that a
  // record could not be created at all.
  `CREATE TABLE IF NOT EXISTS "events" (
    "id" serial PRIMARY KEY NOT NULL,
    "at" timestamp with time zone DEFAULT now() NOT NULL,
    "kind" text NOT NULL,
    "outcome" text NOT NULL,
    "reason" text,
    "detail" text,
    "email" text,
    "request_id" text
  )`,
  `CREATE INDEX IF NOT EXISTS "events_at_idx" ON "events" USING btree ("at")`,
  `CREATE INDEX IF NOT EXISTS "events_kind_idx" ON "events" USING btree ("kind", "at")`,
  // The rate card, versioned: one row per save, newest row is live. No "active"
  // flag, because two rows both claiming to be active is a bug that cannot
  // happen if "newest wins" is the only rule. The card is one jsonb document
  // rather than relational rows because it is edited as a whole — a half-saved
  // card is a state the editor should be structurally unable to produce.
  `CREATE TABLE IF NOT EXISTS "rate_cards" (
    "id" serial PRIMARY KEY NOT NULL,
    "data" jsonb NOT NULL,
    "note" text,
    "edited_by" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "rate_cards_created_idx" ON "rate_cards" USING btree ("created_at")`,
  // Bookings keep the priced lines they were quoted, so a later rate change
  // never rewrites an old quote. request_id is unique so a retry lands once.
  `CREATE TABLE IF NOT EXISTS "bookings" (
    "id" serial PRIMARY KEY NOT NULL,
    "client_id" integer,
    "email" text NOT NULL,
    "name" text NOT NULL,
    "phone" text,
    "brokerage" text,
    "address" text NOT NULL,
    "sqft" integer,
    "desired_date" text,
    "details" jsonb NOT NULL,
    "access_notes" text,
    "notes" text,
    "lines" jsonb NOT NULL,
    "total" integer NOT NULL,
    "rates_are_placeholder" boolean NOT NULL,
    "rate_card_version" integer,
    "request_id" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "bookings_client_id_clients_id_fk"
      FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id")
      ON DELETE set null ON UPDATE no action
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "bookings_request_id_key" ON "bookings" USING btree ("request_id")`,
  `CREATE INDEX IF NOT EXISTS "bookings_client_idx" ON "bookings" USING btree ("client_id")`,
  `CREATE INDEX IF NOT EXISTS "bookings_created_idx" ON "bookings" USING btree ("created_at")`,

  /**
   * 0004 — the confirmed slot behind instant booking.
   *
   * Additive on purpose. Existing rows are requests that were emailed to Nick
   * and confirmed by hand, so the default below describes them accurately
   * rather than retrofitting a promise nobody made. desired_date stays exactly
   * as it is: what a client asked for is a different fact from what they got,
   * and overwriting one with the other would lose the first.
   */
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'requested' NOT NULL`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "starts_at" timestamp with time zone`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "ends_at" timestamp with time zone`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "shoot_date" text`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "calendar_event_id" text`,
  /**
   * One confirmed Sala Nera booking per day, enforced here rather than in
   * application code — see the long note on this index in lib/schema.ts. It is
   * the entire defence against two clients confirming the same slot in the
   * same second, so it must not be relaxed to a plain index.
   */
  `CREATE UNIQUE INDEX IF NOT EXISTS "bookings_one_confirmed_per_day"
    ON "bookings" USING btree ("shoot_date") WHERE "status" = 'confirmed'`,
  `CREATE INDEX IF NOT EXISTS "bookings_starts_at_idx" ON "bookings" USING btree ("starts_at")`,

  /**
   * 0005 — smaller copies of each photo, made on the server after upload.
   *
   * All nullable, and null means "not made yet": every reader falls back to
   * the original r2_key, so rows uploaded before this existed keep rendering
   * exactly as they did until their copies are made. high_key is only ever set
   * when the original itself is no good as a download (over the MLS size cap,
   * or not a JPEG); for everything else the original is the high-res file.
   */
  `ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "grid_key" text`,
  `ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "large_key" text`,
  `ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "high_key" text`,
  /** 'high' or 'low'. Null on rows written before the choice existed, all of which were originals. */
  `ALTER TABLE "downloads" ADD COLUMN IF NOT EXISTS "resolution" text`,

  /**
   * 0006 — every booking makes its own listing, and this is the link back.
   *
   * On the listing, not the booking, because a listing Nick makes by hand has
   * no booking at all. Unique, so a booking retried with the same requestId
   * can never make a second listing. SET NULL rather than cascade: a
   * listing with photos in it outlives anything that happens to its booking.
   */
  `ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "booking_id" integer
    REFERENCES "bookings"("id") ON DELETE set null`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "listings_booking_id_key" ON "listings" USING btree ("booking_id")`,

  /**
   * 0007 — every "your photos are ready" email Nick sends from a listing, so
   * the listing can say what went out, to whom, and when. Goes with the
   * listing: the history of a deleted listing's emails is of no use to anyone.
   */
  `CREATE TABLE IF NOT EXISTS "delivery_emails" (
    "id" serial PRIMARY KEY NOT NULL,
    "listing_id" integer NOT NULL,
    "sent_to" text NOT NULL,
    "kind" text NOT NULL,
    "at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "delivery_emails_listing_id_listings_id_fk"
      FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id")
      ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE INDEX IF NOT EXISTS "delivery_emails_listing_idx" ON "delivery_emails" USING btree ("listing_id", "at")`,

  /**
   * 0008 — the "Download all photos" zips, one row per build (lib/archives.ts).
   * The unique index is the lock: two requests to build the same zip at the
   * same moment cannot both win it. Goes with the listing; the zip files
   * themselves are deleted by the code that deletes the listing.
   */
  `CREATE TABLE IF NOT EXISTS "archives" (
    "id" serial PRIMARY KEY NOT NULL,
    "listing_id" integer NOT NULL,
    "resolution" text NOT NULL,
    "version" text NOT NULL,
    "r2_key" text NOT NULL,
    "status" text NOT NULL,
    "photos" integer NOT NULL,
    "bytes" bigint,
    "error" text,
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "finished_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    CONSTRAINT "archives_listing_id_listings_id_fk"
      FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id")
      ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "archives_listing_version_key"
    ON "archives" USING btree ("listing_id", "resolution", "version")`,
] as const;
