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
5. Re-check Neon's Tables view afterward — `clients`, `listings`, `media`,
   `invoices`, `downloads` should now exist (empty, no rows — that's
   correct, no real client data should exist yet).

That's the only thing blocking full Neon/Vercel wiring. Everything else
(the integration itself, the deploy pipeline, the migration endpoint's
code) is already done and working.

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
