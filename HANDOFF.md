# Sala Nera — Handoff (Sep 9 2026)

This replaces two earlier handoff notes that had gone stale and actively
misled the start of this session. Both described work that was already done.
They are deleted; `git log` still has them if you want the archaeology.

**Read the "Verified state" table below before re-investigating anything.**
Every row in it was checked directly this session, not inferred.

---

## Where the project is

Sala Nera is Nick Blackhall's cinematic real-estate media brand (Blackhall
Media Group, Dallas–Fort Worth). One Next.js 16 app serves both the public
marketing site and a client delivery portal underneath it.

**There is only one branch that matters now: `main`.** Vercel's production
branch points at it, and it deploys to **salanera.com**. The old parallel-branch
confusion (Claude's Next.js branch vs. Codex's static-HTML branch) is over —
everything was ported and verified, see "Branches" below.

## Verified state

| Thing | State | How it was checked |
|---|---|---|
| Neon schema | Applied | Queried `information_schema` directly |
| Seed data | 1 client, 2 listings, 10 media rows each | Queried the tables |
| Magic-link sign-in | Working | Nick signed in and reached `/admin` |
| Owner admin `/admin` | Live in production | Committed `37e7f90`, deployed |
| `ADMIN_EMAILS` / `NOTIFY_EMAIL` on Vercel | `nblackhall@…`, correct in all 3 environments | `vercel env pull` |
| `DATABASE_URL` on Vercel | Set for Production, Preview, Development | `vercel env ls` |
| Production build | Clean, 20 routes | `npm run build` |
| Mobile layout | All 7 portal/admin pages fit 390px, no sideways scroll | Playwright measurement |

The two seeded listings are `/portal/preston-hollow-lane` (locked) and
`/portal/rockwall-shores-drive` (unlocked), both owned by the demo client
`agent@briggsfreeman.com`.

## What shipped this session

**`37e7f90` — the owner admin area.** `/admin` lists every listing with its
client, shoot date, media count and a one-click lock toggle; `/admin/clients`
manages client records; the per-listing page edits details, sets a cover image
from the media grid, shows download history, and deletes.

The security shape is worth not undoing: `requireAdmin()` in `lib/admin.ts`
runs in the layout, *again* in every page, and *again* at the top of every
server action. That is not redundant. A server action is its own POST endpoint
that anyone who knows its id can call directly, and it never renders through
the layout that would have stopped it. It answers 404 rather than 403, so the
owner area does not confirm its own existence to a stranger.

**`61e8399` — the stretched-logo fix.** Covered below under Gotchas, because
it is the kind of bug that will happen again.

---

## The next real task: signed downloads

**The lock is currently presentation only.** A locked listing hides the
download buttons and shows watermarked previews, but the images are still
plain URLs — anyone with a link can fetch the file regardless of lock state.
The dashboard says so on the page rather than letting the button imply
protection it does not provide. Do not describe the portal as protecting
anything until this is done.

Closing it needs, roughly in order:

1. **Cloudflare R2** for media storage. Chosen over Supabase Storage because
   Supabase's free tier pauses projects after inactivity and needs a manual
   restore — a bad failure mode for a live client gallery link. R2 has zero
   egress fees, which matters because clients download gigabytes.
2. **A signed-download route** that checks ownership server-side, mints a
   short-lived signed URL, and writes a `downloads` row. The admin page's
   "Download activity" section is already built and empty, waiting for this.
3. **Browser upload**, replacing `scripts/seed-portal.mjs` as the way media
   gets in. There is no upload UI today, by design.
4. **Stripe** — Nick already invoices through Stripe, so `invoice.paid` should
   call the same `setListingLock()` the admin button calls, and unlock
   automatically.

Do **not** create R2 or Stripe accounts without Nick present. Each is a real
signup with billing and, for Stripe, a webhook touching his live invoicing.

Smaller, optional: on a phone the listings table scrolls sideways inside its
own container, so the lock button sits off-screen. Stacking rows into cards
under ~640px would fix it. Nick was told about it and did not ask for it yet.

---

## Branches — one command still outstanding

`main` is current. The other three on GitHub are dead:

- `portal-build` and `nextjs-portal-foundation` — fully merged into `main`.
- `launch-readiness` — Codex's old static-HTML site. Git will never call it
  merged, because its content was ported by hand rather than merged. The port
  **is** complete and was verified: the pages exist as Next.js routes, and
  every hardening check from its `api/inquiry.js` is present in
  `app/api/inquiry/route.ts` (`startedAt` timing honeypot, `Idempotency-Key`,
  415/413 caps, Origin check, `cleanInline`). It is preserved as the tag
  `archive/launch-readiness`, already pushed.

Deleting them was blocked by the permission classifier, so it is still Nick's
to run:

```sh
git push origin --delete portal-build nextjs-portal-foundation launch-readiness
git remote prune origin && git branch -d portal-build
```

Safe: all three are either merged or preserved by the tag.

**Before deleting, note:** removing `portal-build` orphans its Preview env vars
in Vercel, one of which is `MIGRATE_TOKEN` — and that token exists *nowhere
else*, not in Production or Development. It does not matter today (the schema
is applied), but the next time `lib/schema.ts` changes,
`/api/portal/migrate` will not authenticate without it. Copy the value into
Production and Development before cleaning up.

---

## Gotchas — things that cost real time, do not rediscover them

**The `<img>` width/height trap.** This one produced a 1103px-tall header that
looked like a design choice rather than a bug. The logo `<img>` carries
`width="1669" height="1070"` for its intrinsic size. Those attributes are
presentational hints for **both** dimensions. The CSS set only `width: 96px`,
so the width hint was overridden and the *height hint was not* — giving a
96×1070 sliver. It does not read as a stretched logo, it reads as a lot of
empty header. **Any rule that sets an image's width must also set
`height: auto`.** It was wrong in three places (`.admin-brand img`,
`.plogin-logo`, `.pindex-logo`), i.e. everywhere the logo appears.

**Measure the page, do not reason about it.** The above was invisible to
inspection and obvious in one `getBoundingClientRect()`. Same session, same
method found the portal index overflowing an iPhone viewport by 86px because
it renders the viewer's email in an `<h1>` and long emails do not wrap.

**Playwright works here, but needs two steps** the default install does not do:

```sh
npx playwright install chromium
sudo /home/codespace/.npm/_npx/*/node_modules/.bin/playwright install-deps chromium
```

Without the second, Chromium dies on a missing `libatk-1.0.so.0`. Playwright is
not a project dependency, so a script importing it needs a temporary symlink
from `node_modules/` into the npx cache — remove it afterward. To reach
`/admin` in a headless browser, mint a session cookie directly with `jose`
using `AUTH_SECRET` and `ADMIN_EMAILS` rather than driving the email flow.

**`.env.local` goes stale.** It is a snapshot pulled from Vercel, not a live
link. It was pulled 19 minutes before the commit that fixed the dead mailbox,
so it kept pointing `ADMIN_EMAILS` at `nick@blackhallmediagroup.com` — an
address that does not exist — for five days while Vercel was correct the whole
time. If local behaviour disagrees with production, re-run `vercel env pull`
before assuming a code bug. Note `PORTAL_URL` is hand-set to
`http://localhost:3000` locally and only exists in Vercel's Production
environment.

**Deleting remote branches, and some `git ls-remote` calls, are blocked** by
the permission classifier in this setup. Don't route around it with `gh` —
hand the command to Nick.

**Brand colours.** `--oxblood` (#770606) is fills only; it fails contrast badly
as text. `--ember` (#D4552F) is the text and focus accent, 4.72:1 on the ink
background, clears WCAG AA. This distinction exists because an early draft used
one dark red for everything including body copy.

**Several brand/media files have literal spaces in their filenames**
(`sala nera logo cropped dark.svg`). This has caused percent-encoding and shell
quoting bugs before. Worth normalising to hyphens, but it has to be done with
every reference updated at once.

---

## Working notes

- Local dev: `npm run dev`. The Codespace sleeps; nothing is lost as long as
  work is committed, which is the lesson that prompted this file.
- `npm run db:seed` re-seeds the two demo listings; safe to re-run, it upserts.
- Vercel CLI is authenticated in this Codespace (`npx vercel ls`, `env ls`,
  `env pull` all work), which is the fastest way to check production truth.
- Nick is on Vercel's Hobby plan and knows it does not cover commercial use.
  He will upgrade before real clients are on the portal. Don't raise it again.
