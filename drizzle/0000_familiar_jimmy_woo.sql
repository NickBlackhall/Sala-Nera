CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"company" text,
	"phone" text,
	"stripe_customer_id" text,
	"team" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downloads" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_id" integer,
	"listing_id" integer,
	"client_email" text,
	"filename" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"stripe_invoice_id" text PRIMARY KEY NOT NULL,
	"listing_id" integer,
	"client_email" text,
	"property_address" text,
	"status" text,
	"amount_due" integer,
	"hosted_invoice_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"address" text NOT NULL,
	"slug" text NOT NULL,
	"city" text,
	"shoot_date" timestamp with time zone,
	"cover_key" text,
	"download_locked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"kind" text NOT NULL,
	"r2_key" text NOT NULL,
	"filename" text NOT NULL,
	"bytes" bigint,
	"width" integer,
	"height" integer,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_email_key" ON "clients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "clients_team_idx" ON "clients" USING btree ("team");--> statement-breakpoint
CREATE INDEX "downloads_listing_idx" ON "downloads" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "downloads_at_idx" ON "downloads" USING btree ("at");--> statement-breakpoint
CREATE INDEX "invoices_listing_idx" ON "invoices" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_slug_key" ON "listings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "listings_client_idx" ON "listings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "media_listing_idx" ON "media" USING btree ("listing_id","sort");