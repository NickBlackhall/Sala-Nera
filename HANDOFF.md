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
| Production build | Clean, 22 routes | `npm run build` |
| Mobile layout | All 7 portal/admin pages fit 390px, no sideways scroll | Playwright measurement |
| Download authorisation | Enforced server-side, 8 cases probed | Live requests, see below |
| Media bytes | Still world-readable local paths | Not yet on R2 |
| Booking form `/book` | Built; 5 steps, live estimate | Measured at 390px and 1280px |
| Booking rates | **Placeholders**, flag still true | `lib/rates.ts` |
| Booking validation | 9 rejection paths probed | Live requests |

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

**The signed-download server side**, which has its own section immediately
below because its half-done state is easy to misread.

---

## Signed downloads — server side done, storage not yet swapped

**Read this carefully, the state is genuinely half-and-half.**

What is now real: every download goes through a route that checks the session,
checks team-aware ownership, checks the payment lock, and writes a `downloads`
row. `lib/downloads.ts` is the only place any of those decisions are made —
routes must not re-check ownership themselves, because the rules are subtle and
a second implementation is a second chance to get one wrong.

What is still not real: **the bytes are still world-readable.** Media rows point
at `/demo/*.jpg` under `public/`, so anyone with a path can fetch a file without
passing the route at all. The route is the enforcement point, and it works, but
it only starts protecting anything once the files move behind a private bucket.
Until then, do not describe the portal as protecting files.

### What shipped

- `lib/sigv4.ts` — AWS SigV4 query presigning, hand-written rather than pulling
  in `@aws-sdk/s3-request-presigner` (one function versus twenty-odd packages).
  It takes every input as an argument, clock included, which is what lets
  `npm run check:sigv4` verify it against AWS's published reference vector.
  **It passes.** So if R2 answers 403 on the first real request, suspect the
  credentials or the bucket name, not the signature.
- `lib/storage.ts` — the policy layer that holds the credentials. Two modes,
  chosen by whether all four `R2_*` vars are set: presigned URLs, or local paths
  passed through unchanged. A *partial* R2 config is treated as unconfigured —
  deliberately, so a half-finished deployment fails loudly instead of quietly
  serving unsigned paths behind working previews.
- `lib/downloads.ts` — `authorizeListing()` and `recordDownloads()`.
- `GET /api/portal/download/[id]` — one file, 302 to a signed URL. A redirect
  rather than a proxy: streaming bytes through a serverless function would bill
  for every gigabyte and undo the reason R2 was chosen.
- `POST /api/portal/download` — `{ slug, ids? }` returns one signed URL per
  file. Not a zip: zipping means buffering or streaming gigabytes through a
  function. A real zip belongs in a job that writes the archive to R2 once.
- The Gallery buttons, which were previously inert, now work. The lightbox
  "Download" link points at the route, not at the image, so it cannot skip the
  lock check or the logging.
- Previews are signed too (`withPreviewUrls`, `previewUrl`). There is no
  "public thumbnail, private original" split — a private bucket means every
  `<img>` needs a signed URL, and all five render sites were updated.

### Verified, not assumed

Probed against the real Neon database with minted session cookies:

| Case | Result |
|---|---|
| No session | 404 |
| Signed in, not your listing | 404 |
| Owner, unlocked listing | 302 to the file, row logged |
| Owner, locked listing | 403 with a reason |
| Admin, locked listing | 403 — admins do not bypass the lock by default |
| Same-team client | 302 — team sharing works |
| Two clients both with `team = null` | 404 — the null-vs-null trap holds |
| Batch naming another listing's media ids | Those ids dropped, not leaked |

The admin "Download activity" panel, empty since the day it was built, fills in.
The probe rows were deleted afterwards; the database is back to seed state
(1 client, 2 listings, 0 downloads).

### What is left

1. **Cloudflare R2** — still needs Nick present, still a real billing signup.
   Step-by-step instructions are in the appendix at the bottom of this file.
2. **Browser upload**, replacing `scripts/seed-portal.mjs`. Still no upload UI.
3. **Stripe** — `invoice.paid` should call the same `setListingLock()` the admin
   button calls. Still needs Nick present; it touches his live invoicing.
4. **MLS-size exports.** The button is now visibly disabled with an explanation
   rather than pretending. It needs derivative generation, which belongs with
   the upload pipeline, not with storage.
5. **A real zip** for "Download All", if firing N downloads proves annoying in
   practice. Worth waiting to see whether it actually does.

Smaller, optional: on a phone the listings table scrolls sideways inside its
own container, so the lock button sits off-screen. Stacking rows into cards
under ~640px would fix it. Nick was told about it and did not ask for it yet.

Also stale: `npm run lint` calls `next lint`, which Next 16 removed. It errors
out. Either drop the script or point it at ESLint directly.

## The booking form — built, priced with placeholders

`/book` is live in the codebase: a five-step form that prices the shoot as an
agent fills it in, then emails Nick a complete, machine-readable brief.

**The one thing outstanding is the rates.** Every price in `lib/rates.ts` is
`999`, on purpose: a uniform absurd number cannot be mistaken for real pricing,
where a plausible one could. `RATES_ARE_PLACEHOLDER = true` alongside it, so the
form carries a "placeholder pricing — not our rates" notice and every booking
email gets a warning line. Replace the numbers, flip the flag to false, run
`npm run rates:doc`, and all of that disappears on its own.

Nick asked for it this way after being told the site was about to go public with
invented prices on it; he is not worried about traffic yet, since nobody knows
the site exists.

One cost to be aware of: while every tier costs the same, the tier-boundary
checks in `scripts/check-rates.mjs` cannot fail — every band agrees, so they
pass without proving anything. The script prints a note saying so on every run.
Real numbers restore its teeth, and it has been confirmed to catch an off-by-one
once the bands differ.

### Where the guide was followed, and where it was not

`reference/The Booking Form System.pdf` specifies **Formspree**, on the
reasoning that you have "no server, no database". That has not been true of this
project for a while. The form posts to `app/api/booking/route.ts` instead —
Nick's own endpoint, carrying the same hardening as the inquiry route (honeypot,
timing gate, origin check, size caps, idempotency key). It still emails him, so
the Gmail-label automations the guide describes work unchanged; it just does not
hand a third party the front door, and it leaves the option of talking to the
database open. Everything else follows the guide: five steps in the order it
gives, sqft driving the tier, add-ons as one-tap cards, per-image work marked
"quoted after", and the desired date labelled a request rather than a booking.

### One source of truth for pricing

`lib/rates.ts` is it. Two things read it and they must never disagree:

- The **browser** prices live as the agent types.
- The **server** re-prices the submission in `app/api/booking/route.ts` before
  the email goes out, and *its* number is the one sent. The browser's figure is
  treated as a claim — a form can be edited in a devtools console, and this
  number becomes an invoice. When they differ the email says so rather than
  rejecting the booking, because the usual cause is the rate card changing while
  someone had the form open.

`rates.md` is **generated** from `lib/rates.ts` by `npm run rates:doc`. It exists
because the invoicing automation reads plain English while the site needs typed
data — and two hand-maintained copies is exactly how a price ends up right on
the site and wrong on an invoice. Do not edit `rates.md` by hand.

### Verified

- `npm run check:rates` checks every tier boundary — the square foot either side
  of each band edge, plus flat items, quoted-after items, unknown ids and
  duplicates. It reads the edges out of the rate card rather than hard-coding
  dollars, so it keeps working once Nick's real numbers land. It was confirmed
  to have teeth by breaking `<=` to `<` and watching six checks fail.
- Every rejection path probed live: missing name, bad email, missing address, no
  services, wrong content-type, foreign origin, honeypot filled, submitted
  instantly, and a three-hour-old tab. The three bot cases answer `200 {ok:true}`
  so a bot believes it worked and does not retry.
- A submission naming **only** service ids that do not exist used to pass the
  "at least one service" check and arrive as a booking for nothing at $0. It is
  now checked against the *priced* lines, not the submitted array.
- Measured in a real browser at 390px and 1280px: no horizontal overflow on any
  of the five steps, and the live estimate computes correctly end to end
  ($350 photography at 3,200 sq ft + $175 aerial = $525, tier label right).

### Still to do here

- **Nick's real rates**, as above.
- **No end-to-end email test has been run** — see the gotcha below about why
  that cannot be done locally. Worth one real submission from production once
  the rates are in, which is also step 1 of the guide's own test procedure.
- The guide's two Claude scheduled tasks (booking → calendar hold, booking →
  draft Stripe invoice) are not set up. The email format is already shaped for
  them: stable field labels, `New Booking Request` in the subject, and the
  address first so the invoice memo can start with it.

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

## What links to what

Worth knowing before adding a page, because two have already been built with no
way in:

- **`/book`** — the nav CTA, on every page.
- **`/portal`** — "Client Login" in the footer, both the full and the compact
  variant, so it is reachable from any page. Logged-out visitors get a 307 to
  `/portal/login`, which is the right landing.
- **`/films` is orphaned.** It builds, it renders, and nothing anywhere links to
  it. Either add it to the footer's Collection column next to Selected Work, or
  delete it — but it should not stay as it is. Nick has not been asked which yet.

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

**`NextResponse.redirect()` refuses relative URLs.** It throws `URL is
malformed`, as a 500, only on the code path that actually redirects — so it
survived a clean build and a clean typecheck and showed up only when the route
was called for real. `lib/storage.ts` returns bare local paths when R2 is not
configured, which is exactly such a URL. The route resolves them against the
incoming request now. Worth remembering the general shape: a clean build says
nothing about a route nobody has called.

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

**Email cannot be tested locally, and the error blames the wrong thing.**
`vercel env pull` redacts anything marked sensitive, writing the literal string
`[SENSITIVE]` as the value. So `RESEND_API_KEY` locally *is* the text
`[SENSITIVE]`, and Resend answers `400 API key is invalid` — which reads exactly
like a real broken key and sent this session looking for a production outage
that did not exist. Production is fine; Vercel injects the true value at
runtime. Any email path can only be tested from a deployment.

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

---

## Appendix: connecting R2, step by step

Written down so this is a fifteen-minute job whenever Nick has fifteen minutes,
rather than a research task. Cloudflare moves its dashboard labels around, so
match on meaning rather than exact wording — what each step needs to *produce*
is what matters, and every value is named below.

### What you are collecting

Four values. Nothing else about the bucket is wired into the code.

| Env var | Where it comes from |
|---|---|
| `R2_ACCOUNT_ID` | The 32-hex-character id in the R2 endpoint URL, `https://<this>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | Whatever you name the bucket in step 2 |
| `R2_ACCESS_KEY_ID` | Shown once when you create the API token |
| `R2_SECRET_ACCESS_KEY` | Shown once when you create the API token |

The last two are shown **once**. Paste them into Vercel before closing the tab;
if you lose them, delete the token and make another — you cannot re-read one.

### Steps

1. **Sign up / sign in** at `dash.cloudflare.com`, then open **R2** in the
   sidebar. R2 asks for a payment method even to use the free tier. The free
   tier is 10 GB of storage and, importantly, **zero egress** — which is the
   whole reason R2 was chosen over Supabase Storage. Nick will exceed 10 GB of
   storage quickly at real listing volume; egress is what would actually have
   hurt, and that stays free.

2. **Create a bucket.** Name it something stable — `sala-nera-media` is fine.
   Location: automatic, or North America if offered. **Leave public access
   OFF.** A public bucket would defeat the entire signed-download system: the
   route would still check the lock, and anyone with a plain URL would still
   walk straight past it. Private is the point.

3. **Create an API token.** In R2, find API / "Manage R2 API Tokens" and create
   one with **Object Read & Write** permission, scoped to just this bucket
   rather than the whole account. Copy the Access Key ID and Secret Access Key.

4. **Note the account id** from the S3 endpoint shown on the bucket or API page:
   `https://<32 hex chars>.r2.cloudflarestorage.com`. That hex string is
   `R2_ACCOUNT_ID` — not the bucket name, and not the token id.

5. **Put all four into Vercel**, in **all three environments** (Production,
   Preview, Development). Either the dashboard, or:

   ```sh
   npx vercel env add R2_ACCOUNT_ID production
   # …repeat per variable per environment, or paste them in the dashboard
   ```

   Remember `lib/storage.ts` treats a *partial* config as no config, on purpose.
   Three of four set means the app quietly keeps serving unsigned local paths
   rather than half-working — so check all four landed.

6. **Pull them locally** so dev matches: `npx vercel env pull`. (See the
   `.env.local` gotcha above — it is a snapshot, not a live link.)

7. **Upload the media.** Until the upload UI exists, drag the ten files in
   `public/demo/` into the bucket through the Cloudflare dashboard. Keep the
   filenames. If you nest them under a prefix like `demo/`, the object keys
   become `demo/living-room.jpg` and step 8 has to match.

8. **Point the seed at object keys.** In `scripts/seed-portal.mjs`, the media
   rows and the two `coverKey` values currently say `/demo/aerial.jpg` and so
   on. Those leading slashes make them local public paths. Strip the slash (or
   set whatever prefix you used in step 7) so they are object keys, then
   `npm run db:seed`.

9. **Check it.** `npm run dev`, sign in, open a listing. Images should still
   render — but their URLs will now be long `r2.cloudflarestorage.com` links
   with an `X-Amz-Signature` on the end. Then confirm the lock is finally real:
   copy one of those image URLs, wait for it to expire (previews last an hour,
   downloads five minutes), and load it again. It should be refused.

10. **The notice disappears on its own.** The admin dashboard's "media is not on
    R2 yet" warning is conditional on `isRemoteStorage()`. When it stops
    appearing, the lock is genuinely protection and the portal can be described
    that way — not before.

### If R2 answers 403

The signing is already checked against AWS's published reference vector
(`npm run check:sigv4`, and it passes), so a 403 is almost certainly *not* the
signature. In rough order of likelihood: the account id is wrong (easy to grab
the token id by mistake), the token is not scoped to that bucket, the bucket
name has a typo, or the object key does not match what got uploaded — check for
a `demo/` prefix you did or did not include.
