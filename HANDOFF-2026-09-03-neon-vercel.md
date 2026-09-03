# Sala Nera — Handoff (written by Claude, Sep 3 2026)

Written near a usage limit. The previous `HANDOFF.md` already committed on
`portal-build` (from the `launch-readiness` → `nextjs-portal-foundation` port
work) is **outdated** — Nick has moved past that. This note picks up from
where he actually is: connecting Neon + Vercel for the client portal.

## Where things stand, confirmed directly (not guessed)

**Branch:** `portal-build` is the active branch. Its last two commits:
- `6261c47` — "Add portal database migration foundation": added
  `drizzle.config.ts`, the generated migration
  (`drizzle/0000_familiar_jimmy_woo.sql`, creates `clients`, `listings`,
  `media`, `invoices`, `downloads`), and `app/api/portal/migrate/route.ts`
  (POST-only, token-authed, transactional, idempotent — returns
  `already_applied` on retry).
- `2e22f39` — "Trigger portal preview database", an intentional empty commit
  to kick a Vercel/Neon preview rebuild.

**Vercel deploy:** confirmed via GitHub commit status API
(`/repos/NickBlackhall/Sala-Nera/commits/2e22f39.../status`) —
`state: success`, "Deployment has completed". The build is fine, nothing
stuck.

**Neon ↔ Vercel integration:** confirmed connected, via the Neon dashboard
(BMG Sala Nera project → Integrations → Vercel → Manage). Production branch
mapping is set (Vercel `production` → Neon default branch), and a Neon
preview branch `preview/portal-build` exists, created Sep 3 2026 — same day
as the trigger commit, which is exactly what you'd expect from a live
integration reacting to that push.

**Database schema: NOT applied yet, on either branch.** Checked directly in
Neon's Tables view for both:
- `production` branch: Postgres Overview shows 0 CU-hrs compute, 0 kB
  storage, 0 kB history, all "since Sep 3, 2026" (branch creation) — no
  activity.
- `preview/portal-build` branch: Tables view says explicitly **"0 tables in
  public schema."**

So: the integration is real and working, the app deploys cleanly, but the
migration endpoint has never been successfully called. Nothing in the repo
or dashboards proves the initial "usage limit scare" corresponded to any
actual break — everything checked out clean.

## The one concrete remaining step

The schema has never actually been applied to either Neon branch (checked
directly — see above). Three ways to close this, in the order Nick was
working through them:

### Option A — hit the deployed endpoint (the original README path)

Per `README.md` section 4 ("Portal database foundation"):

1. Get the `MIGRATE_TOKEN` value from Vercel → Settings → Environment
   Variables (it should already be set there if `DATABASE_URL` is — check
   both exist for whichever environment, Production and/or the
   `portal-build` preview, you're targeting).
2. Get the actual deployment URL for that environment (production domain,
   or the specific preview URL from the Vercel deployment page —
   `https://vercel.com/bmg11/sala-nera/...` for the latest one).
3. Run:
   ```sh
   curl -X POST "https://YOUR-DEPLOYMENT-URL/api/portal/migrate" \
     -H "Authorization: Bearer YOUR_MIGRATE_TOKEN"
   ```
4. Success looks like a JSON response recording migration
   `0001_portal_foundation` applied (or `already_applied` if run twice).
   Failure (401/403/500) means either the token doesn't match what's set in
   Vercel, or `DATABASE_URL` isn't actually reaching that environment —
   check the env var is set for the right environment (Production /
   Preview / Development all need it set separately in Vercel).

### Option B — run it locally against the real database (Nick is trying this next, in a GitHub Codespace)

This exercises the actual endpoint code (transaction, `portal_migrations`
tracking table, idempotency) instead of hand-run SQL, and as a side effect
confirms whether `DATABASE_URL`/`MIGRATE_TOKEN` are correctly set in Vercel
at all — which Option C below cannot tell you.

```sh
git fetch origin
git checkout portal-build
git pull
npm install
npx vercel link          # first time only — links this checkout to the bmg/sala-nera Vercel project
npx vercel env pull .env.local     # pulls real DATABASE_URL / MIGRATE_TOKEN from Vercel
npm run dev               # runs the app locally, but pointed at the real Neon database
```
Then, in a second terminal:
```sh
curl -X POST http://localhost:3000/api/portal/migrate \
  -H "Authorization: Bearer $(grep MIGRATE_TOKEN .env.local | cut -d '=' -f2)"
```
Expect `{"ok":true,"status":"applied","migration":"0001_portal_foundation",...}`.
A 503 means the env vars didn't actually pull through — worth knowing either way.

### Option C — paste the raw SQL directly into Neon's SQL Editor (fastest, but skips verifying Vercel's env vars)

Neon dashboard → **Postgres database → SQL Editor**, on the branch you want
(`production` or `preview/portal-build`). The exact statements, copied from
`lib/portal-migration.ts` plus the same `portal_migrations` bookkeeping the
endpoint does (so calling the endpoint later still correctly reports
`already_applied` instead of erroring):

```sql
CREATE TABLE IF NOT EXISTS "portal_migrations" (
  "id" text PRIMARY KEY NOT NULL,
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "clients" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "company" text,
  "phone" text,
  "stripe_customer_id" text,
  "team" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "clients_email_key" ON "clients" USING btree ("email");
CREATE INDEX IF NOT EXISTS "clients_team_idx" ON "clients" USING btree ("team");

CREATE TABLE IF NOT EXISTS "listings" (
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
);
CREATE UNIQUE INDEX IF NOT EXISTS "listings_slug_key" ON "listings" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "listings_client_idx" ON "listings" USING btree ("client_id");

CREATE TABLE IF NOT EXISTS "media" (
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
);
CREATE INDEX IF NOT EXISTS "media_listing_idx" ON "media" USING btree ("listing_id", "sort");

CREATE TABLE IF NOT EXISTS "invoices" (
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
);
CREATE INDEX IF NOT EXISTS "invoices_listing_idx" ON "invoices" USING btree ("listing_id");

CREATE TABLE IF NOT EXISTS "downloads" (
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
);
CREATE INDEX IF NOT EXISTS "downloads_listing_idx" ON "downloads" USING btree ("listing_id");
CREATE INDEX IF NOT EXISTS "downloads_at_idx" ON "downloads" USING btree ("at");

INSERT INTO "portal_migrations" ("id") VALUES ('0001_portal_foundation')
ON CONFLICT ("id") DO NOTHING;
```

Every statement is `IF NOT EXISTS`, so it's safe to run more than once, and
safe to also run Option A/B afterward — the endpoint will just see
`already_applied`.

**After any of these:** re-check Neon's Tables view — `clients`, `listings`,
`media`, `invoices`, `downloads`, and `portal_migrations` should all exist
(empty, no rows — correct, no real client data should exist yet).

That's the only thing blocking full Neon/Vercel wiring. Everything else
(the integration itself, the deploy pipeline, the migration endpoint's
code) is already done and working.

**Status as of this update:** none of the three options above had been run
yet. Nick was about to try Option B from a GitHub Codespace when this note
was last updated — check Neon's Tables view first thing in a new session
to see whether that succeeded before re-explaining any of this.

## Notes for whoever picks this up

- **This sandbox cannot reach `*.vercel.app`** — outbound requests to it are
  blocked by network policy (confirmed via the proxy's own status
  endpoint: `connect_rejected`, "policy denial"). Checking live deploy
  URLs or hitting the migrate endpoint has to happen from Nick's own
  terminal or browser, not from here.
- **GitHub API calls (`api.github.com`) also don't work directly from a
  read-only repo attach** — that needs push-level credential attachment,
  which requires explicit user approval (an auto-permission classifier
  blocks it otherwise, since it grants write access even if only used to
  read). Nick ran the `curl .../status` checks himself instead, which
  worked fine.
- Do not create any new Neon/Vercel/Resend/Stripe accounts or resources
  without Nick present, per the standing rule from the earlier handoff —
  still applies.
- The earlier `HANDOFF.md` committed on this branch (about porting
  `launch-readiness` content into the Next.js structure) may still be
  relevant eventually, but is not the current task. Don't act on it without
  checking with Nick first — he may have already handled some or all of it
  through Codex separately.
