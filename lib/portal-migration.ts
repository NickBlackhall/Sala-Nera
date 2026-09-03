import 'server-only';

export const PORTAL_MIGRATION_ID = '0001_portal_foundation';

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
] as const;
