# Sala Nera — Handoff (Sep 11 2026)

## Start here — state at the end of the Sep 11 session

**No code changed this session** — it was a scan-and-plan session after the
codespace slept, plus a direction-setting conversation with Nick. Working
tree clean, `main` matches `origin/main`, last commit still `6493c6e`. If you
are picking this up, the Sep 9 work below is still exactly where it was;
what's new is two things now confirmed done that the old list called open,
and a real scope decision on the booking rebuild.

**Corrections to the Sep 9 list — verified directly against production:**

- ~~Run the migration.~~ **Done.** `rate_cards` exists (`0002_rate_cards`
  applied 2026-09-09 22:29 UTC — five minutes after the Sep 9 handoff was
  written, so it never got marked). Table is empty, so the site still runs
  on the built-in card in `lib/rates.ts`, as designed.
- ~~Google Maps key.~~ **Done and confirmed working.** Live in Vercel
  Production since 21:24 UTC Sep 9, the current production deploy was built
  after that. Tested with a real geocode call this session — works.

**Open, in priority order — updated:**

1. **Nick's real rates.** Still `999` everywhere, still deliberately parked —
   Nick confirmed again this session it can wait. **New: his actual current
   rates already exist**, on his live Spiro booking page
   (`book.blackhallmediagroup.com/order/bmg/residential` — Silver $250 / Gold
   $400 / Platinum $820 packages, plus a full à la carte list). Don't port
   them without Nick asking, but when he's ready this is a five-minute look,
   not a research project.
2. **The booking rebuild — new decision, not started.** See "Booking
   direction, decided this session" below. Nick wants the form's step
   structure and how services/packages are offered rebuilt closer to how
   Spiro's real flow works (Packages → Listing Details → Additional Services
   → Contact Info → Questions → Schedule Appointment → Confirmation), and
   booking to go instantly onto his real calendar rather than emailing him a
   request — but the current site's **visual design should not change**.
   I asked Nick to confirm I've scoped that right; his answer wasn't captured
   before he stepped away, so **read the live conversation, don't assume**.
3. **Cloudflare R2.** Nick is doing this himself right now, using the
   appendix below. Don't duplicate the work — check with him before touching
   `lib/storage.ts` or `scripts/seed-portal.mjs`.
4. **A Google service account for the calendar** (Track B, Phase 3 of the
   plan) — same Google Cloud project as the Maps key. Blocks the scheduling
   build below.
5. **The scheduling build**, per the "Calendar, Distance & Stripe" plan
   published as an artifact. Next buildable piece is `lib/scheduling.ts`, and
   it needs real numbers from Nick before it can be written, not just the
   credential above: real shoot durations by sqft (only one anchor exists:
   3,329 sq ft = 90 min), his working days/hours, and whether he wants a
   fixed buffer between shoots on top of the travel-time buffer
   (`lib/distance.ts`, already built).
6. **Dropbox delivery pipeline — new, scoped, not started.** Creating a
   listing in `/admin` should auto-create a matching Dropbox folder pair,
   **Raw** and **Finished**, via the Dropbox API. Only **Finished**
   auto-imports to the site (through R2, once connected); **Raw** is
   handoff-to-editor only and never touches the delivery site. Folder name
   matches the address format already used for invoice memos. Needs a
   Dropbox app credential (Nick's step, not set up) and depends on R2 being
   connected first — there's nowhere for imported files to land otherwise.
7. Browser upload UI, then Stripe. Stripe is scoped as pay-to-download on the
   portal lock, **not** a booking-time charge — see the plan. Browser upload
   may end up superseded by the Dropbox pipeline above rather than needed as
   the primary path — worth deciding once Dropbox is real, not before.

**Do not re-investigate:** the three silent-discard bugs, the auto-submit bug,
or why local email fails. All diagnosed, fixed and written up below.

---

## Booking direction, decided this session (Sep 11) — nothing built yet

Nick opened with wanting to "rethink the booking portal." Two reference
sites came up and they answer different questions — don't conflate them:

- **jacobguthrie.com/book** — a competitor's booking page. It's a
  client-rendered app; a plain fetch only shows step 1 (service picker,
  sqft-driven price, "Step 1 of 7"). Steps 2–7 aren't visible without
  actually clicking through it in a browser, which wasn't done.
- **Spiro (spiro.media)** — the software actually running Nick's own current
  live booking page, `book.blackhallmediagroup.com/order/bmg/residential`.
  This one *was* inspected properly, with a headless Chromium (Playwright —
  already installed in this codespace from earlier admin-testing work, just
  needed symlinking into `node_modules/` to `require()` it; see the Gotchas
  section for the exact commands, remove the symlinks after). Its real flow:
  **Packages → Listing Details → Additional Services → Contact Info →
  Questions → Schedule Appointment → Order Confirmation**, with a running
  price sidebar throughout. It also offers "pay at close" ($0 due until the
  listing sells) as a payment option on every line — Nick has not asked for
  that, don't build it unprompted.

**What Nick actually asked for, put together:** keep Sala Nera's `/book`
looking and performing exactly as it does now — he likes it. Rebuild the
**step structure and how services/packages are presented** to work more like
Spiro's real flow above (package-first, add-ons, running total) rather than
today's custom step-by-step. Make the **booking mechanics** — a real
calendar, instant confirmation straight onto Nick's calendar, no
approve-by-hand step — work like Spiro does today. This was confirmed
explicitly earlier in the session: instant booking, not request-then-approve.

**What wasn't confirmed:** I reflected this understanding back to Nick and
asked whether pulling in Spiro's step structure (rather than sticking to
Guthrie's, which is what he literally named) was the right call, and whether
I'd overreached. He stepped away before answering — **check the
conversation for his reply before starting any of this build.**

None of this is buildable yet regardless of that answer: it needs the
Google Calendar credential and the duration/hours numbers listed above, and
it's behind R2 and the rates decision in practical priority since Nick is
mid-task on R2 right now.

---

## The booking form delivers — verified Sep 9, 20:07 UTC

A real submission from production, read back out of the `events` table:

```
2026-09-09 20:07:30  booking  Delivered  Sent
                     nblackhall@blackhallmediagroup.com
                     test test test — 4 service(s), $3,996. Both emails sent.
```

**What that proves:** the whole path works. The submission cleared the honeypot
and the timing floor, priced server-side, Resend returned 2xx on Nick's lead
email, and `sendEmail()` returned true on the client confirmation. Telemetry is
live and writing. `$3,996` is 4 × the `999` placeholder, so that email also
carries the "RATES ARE STILL PLACEHOLDERS" warning line and the confirmation
quotes no total — both behaving as designed.

**What it does not prove:** that the mail reached an inbox. `ok` means Resend
*accepted* the message, not that it survived spam filtering. If a lead is ever
reported missing while `/admin/activity` says Delivered, the problem is
downstream of this app — check Resend's own dashboard and the domain's
SPF/DKIM, not the route.

**Why the empty table earlier was a red herring:** telemetry was committed at
18:55 and deployed after Nick's original test, so his first test predated
anything that could record it. An empty `events` table meant "nothing was
watching", not "the lead was discarded". Worth remembering the shape — absence
of a record is only evidence once you know the recorder was running.

---

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
| Booking email, end to end | **Delivered**, both emails | Real production submission, read from `events` |
| Distance-based travel pricing | Built, waiting on a Google Maps key | `npm run typecheck` + `npm run build` clean, `check:rates` passes |
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

~~Also stale: `npm run lint`.~~ Fixed. `next lint` was removed in Next 16, but
the deeper point was that ESLint is not installed and there is no config — so
the script had not been checking anything even before Next 16 broke it. It is
now `npm run typecheck` (`tsc --noEmit`), which is the check that actually runs
here, and it passes. Adding a real lint toolchain is still open, and is Nick's
call rather than a silent cleanup.

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

### Two emails per booking

A booking sends **two** emails, in this order and for different reasons:

1. **Nick's notification** — the lead. If this fails the route answers 502 and
   the agent is told, honestly, that it did not send.
2. **The agent's confirmation** — reassurance. Sent second, through
   `lib/email.ts`, which returns false rather than throwing. A failure here is
   logged but must never turn a successful booking into an error on screen:
   Nick already has the lead, and telling the agent it failed would make them
   book someone else.

The confirmation deliberately **does not quote a total while the rates are
placeholders**. Putting "$1,998" in writing to an agent, when the number is
invented, is how a made-up figure becomes an argument later. It lists what they
chose and says pricing follows with the reply. Once `RATES_ARE_PLACEHOLDER` is
false it includes the estimate.

Worth knowing: a confirmation email means the form can be made to send mail to
any address someone types. The honeypot, origin check and minimum-time gate are
what stand between that and an email-bombing vector. There is no rate limiting.
If the form is ever abused, that is where to add it.

### Still to do here

- **Nick's real rates**, as above.
- ~~No end-to-end email test has been run.~~ **Run, and it passed** — Sep 9,
  20:07 UTC, from production. See "The booking form delivers" at the top. Still
  worth one more submission once the real rates are in, to confirm the
  placeholder warning line disappears and the confirmation starts quoting a
  total.
- The guide's two Claude scheduled tasks (booking → calendar hold, booking →
  draft Stripe invoice) are not set up. The email format is already shaped for
  them: stable field labels, `New Booking Request` in the subject, and the
  address first so the invoice memo can start with it.

---

## Distance-based travel pricing — built, needs a Google Maps key

The first piece of the calendar/scheduling work (see the "Calendar, Distance &
Stripe" plan, published as an artifact this session — ask if you need the link
again). Same shape as the signed-downloads work below: the code is real and
tested, one credential away from doing anything.

**What's real:** `TRAVEL_BANDS` in `lib/rates.ts` — a distance-banded surcharge
next to the sqft tiers, same editing experience, same `check:rates` boundary
checks (and unlike the sqft tiers, its free-vs-surcharge edge has teeth *now*,
before any real numbers land, because $0 and the $999 placeholder are actually
different amounts). `lib/distance.ts` is a pure haversine function — no
network, no key, used for both the travel surcharge and, later, the buffer
between two shoots in `lib/scheduling.ts`. `RATE_NOTES`' travel sentence is now
*generated* from `TRAVEL_BANDS` rather than hand-written, so the policy text
and the actual bands cannot drift apart — same reasoning as `rates.md` being
generated from `lib/rates.ts`.

**What's stubbed on nothing but a missing key:** `lib/geocode.ts` calls
Google's real Geocoding API — `hasGeocoding()` is an honest boolean mirroring
`isRemoteStorage()` in `lib/storage.ts`, and until `GOOGLE_MAPS_API_KEY` is set,
every address is honestly ungeocoded. `POST /api/booking/travel-estimate` is
the live round trip the form calls, debounced, as an agent types the address —
it resolves the address to a distance and nothing else; pricing that distance
happens through the same `quote()` the rest of the form already uses, so there
is exactly one place travel gets priced, not two that could disagree.
`app/api/booking/route.ts` re-geocodes the address server-side before pricing,
same as it already re-prices sqft and services — the browser's number is a
claim, not a fact.

**What this looks like today, with no key set:** the address field on `/book`
shows "We'll confirm travel when we follow up" — honest, not broken. No booking
email gets a travel line. The moment `GOOGLE_MAPS_API_KEY` lands (see the plan
artifact — it's bundled with the Calendar API credentials into one dashboard
session), all of it starts working with no other change.

**Left to do:**
- The Google Maps Platform key itself. Needs Nick present, same shape as R2.
- `BASE_LOCATION` in `lib/rates.ts` is anchored on downtown Dallas — matching
  the travel note this file carried before any of this existed — not Nick's
  actual studio or home address. Fine as a default; point it at a real address
  if that would price shoots more accurately.
- An address Google can't geocode still gets a booking today, just with no
  travel line priced — worth a human glance if a booking ever arrives from
  somewhere that reads as intentionally malformed, but not urgent.

---

## The rate card editor — half built

Nick chose this ahead of the calendar, because he expects to tune prices
repeatedly rather than set them once, and because it takes rate changes off a
dev session's desk entirely. Plan lives in the "Calendar, Distance & Stripe"
artifact, Track D.

**What is real:** `quote()` prices against a card handed to it, defaulting to
the one in `lib/rates.ts`, so nothing changed behaviour when it landed.
`lib/rate-card.ts` reads the newest `rate_cards` row and falls back to the
built-in card on *anything* — no database, no table, nothing saved, a failed
query. That fallback is why this was safe to deploy before the table existed,
and it is also the reason validation has to happen before a write: a corrupt
saved card would silently serve the built-in one instead of failing loudly.

`lib/rate-card-validate.ts` is what TypeScript used to do for free. Two of its
rules are worth knowing because both fail silently and cost money:

- A size band or travel band that is open-ended anywhere but **last** swallows
  everything above it, and every band after it prices nothing.
- A **final** travel band with a ceiling means any distance past it is charged
  as if it were nearer — a 500-mile job billed at the 75-mile rate.

`check:rates` runs the same validator against the shipped card, so the editor's
rules and the repo's rules cannot drift. Confirmed against nine deliberately
broken cards; all nine caught.

**Storage shape, and why:** one jsonb document per save, newest row live. No
`active` flag — two rows both claiming to be active is a bug that cannot happen
if newest-wins is the only rule. A whole-document save makes a half-updated
card (services changed, travel bands not) structurally impossible. Restoring an
old version saves it as a *new* version rather than deleting what came after.

**Services retire, never delete.** Past bookings name the ids they were quoted
under and `rates.md` bills by exact name, so deleting one breaks the record of
work already done. `archived: true` hides it from the form only.

### To create the table

Blocked from the Codespace — the permission classifier refuses outbound calls
to salanera.com. Nick runs this, or a future session with different permissions:

```sh
curl -X POST https://salanera.com/api/portal/migrate \
  -H "Authorization: Bearer $MIGRATE_TOKEN"
```

The token is in Vercel under Production and Development; `npx vercel env pull`
puts it in `.env.local`. Every statement is `IF NOT EXISTS`, so it is safe to
re-run and safe to run now.

### Left to build

1. `/admin/rates` — read-only first (proves the loading path), then editing.
2. **Bookings must snapshot their price.** Nick's decision: existing quotes keep
   what they were quoted, new prices apply only to new quotes. A booking needs
   to record its priced lines *and* the card version that produced them. This
   has to land **before the first real price change**, not after — afterwards
   there is nothing to reconstruct the old quote from.
3. `rates.md` regenerating on save, or the invoicing automation will bill last
   month's rate the first time a price changes from a browser.
4. History and restore in the UI.

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

## Telemetry — /admin/activity

Every booking, inquiry and download now writes an event saying what happened
and why. Built after the silent-discard day below, on the principle that the
failures which hurt are the ones nothing records.

- **`lib/telemetry.ts`** — `record()`. Console line first and unconditionally,
  then a row in the `events` table. It never throws and never blocks: a booking
  must not fail because we could not write down that it happened.
- **`events` table** — no foreign keys on purpose. An event has to outlive what
  it describes, and has to be writable when the thing being reported is that no
  record could be created.
- **`/admin/activity`** — the page to actually look at, linked in the admin nav.
  Counts for the last 24 hours, then the last 200 events with plain-English
  reasons.
- **`npm run activity`** — the same rows in the terminal, same labels
  (`scripts/activity.mjs`, read-only, takes an optional window in hours). It
  exists because the page needs a magic-link sign-in and a browser, and in the
  Codespace `vercel logs`, `vercel env pull` and outbound `curl` to salanera.com
  are all blocked by the permission classifier. When the question is "did that
  booking send", the answer needs a path that is not blocked. Note it reads
  `DATABASE_URL` from `.env.local`, which is the production database.

**Read the Discarded column first.** Anything there is a submission somebody
believes they sent and Nick never received. If those ever look like real people
rather than bots, the anti-spam rules are too tight — which is exactly what
happened, three times, on the day this was built.

Four outcomes: `ok` (worked), `discarded` (thrown away on bot suspicion — the
dangerous one), `rejected` (refused and the sender was told), `failed`
(something broke).

The `events` table is unbounded. At current volume that is irrelevant, but if it
ever gets large the fix is a delete of rows older than N days, not a rewrite.

**Not added, deliberately:** any third-party analytics. Vercel Analytics or
similar would need a line in the privacy policy and is a product decision, not
a debugging one. Ask Nick before adding page tracking.

### A CSS trap this uncovered

`.admin-muted` sets `display:block`. That is right for the spans it was written
for and silently destroys table layout the moment it lands on a `<td>` — cells
stop sharing a row and columns drift out of alignment, with nothing in the
console. Use `.ev-dim` for muted cells. There is now a
`.admin-table td.admin-muted{display:table-cell}` guard, but the real lesson is
that a display-setting utility class is a landmine in a table.

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

**The anti-spam defences ate three real submissions before anyone noticed, and
the pattern is the thing to remember.** Every one of them answered `200 {ok:true}`
and showed a success screen while sending nothing. To the person submitting,
a discarded lead and a delivered one look identical. Nick lost his own bookings
to two of these; a third silently swallowed a verification run, so the "test"
that was meant to prove the system worked proved nothing.

The three:

1. **Upper time bound.** Anything from a page open more than two hours was
   binned. That is a distracted human far more often than a bot. Removed.
2. **The honeypot name.** The hidden field was `company` with a `Company`
   label, so browser autofill filled it from the visitor's own profile and
   every agent with a brokerage saved was classed as a bot. Renamed to `hp_ref`
   with no label. `autoComplete="off"` does not prevent this; browsers ignore it.
3. **Lower time bound.** 3 seconds turned out to be reachable by a real fast
   pass with autofill. Now 500ms.

**The rule this leaves:** never add a silent-discard rule to these routes
without asking what fraction of real people it will catch, and never trust the
success screen as evidence that anything sent. `npx vercel logs
https://salanera.com` is the only proof — a delivered submission logs `info`
with no `warn` line beside it. Every discard now logs one.

**The historical note on the timing gate, kept because it explains the code:** Both form routes
discarded any submission whose form had been open more than two hours, by
answering `200 {ok:true}` and sending nothing. The visitor saw "Booking request
received" and Nick heard nothing at all. Nick hit this himself on his first
test. Worse, it was backwards: a bot that simply omits `startedAt` skips the
check entirely, while an agent who opened the form and got pulled into a
showing was thrown away.

The upper bound is gone from both routes. The "impossibly fast" lower bound
stays, and every silent discard now logs a line so it is visible in
`vercel logs` instead of vanishing. **If a lead is ever reported missing, look
there first.**

**A button that changes `type` between renders will submit the form.** The
booking form's last nav button switches from `type="button"` (Continue) to
`type="submit"` (Send). React reused the same DOM node and just flipped the
attribute — and a browser evaluates a click's *default action* after the
handlers have run, so the click that advanced to Review was performed against
what had by then become a submit button. The form posted itself before the
agent saw the review step. It reproduced on a plain mouse click, not just in
automation.

Two defences are in place and both should stay: distinct `key` props on the two
buttons, so React unmounts one and mounts the other instead of mutating type in
place, and a guard at the top of `submit()` refusing to send from any step but
the last. Watch for this anywhere a conditional swaps one button for another.

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

---

## Appendix: getting the Google Maps key, step by step

One value: `GOOGLE_MAPS_API_KEY`. Everything in "Distance-based travel pricing"
above starts working the moment it lands in Vercel; nothing else changes.

**Do this in the same sitting as the Calendar service account if you can.**
Both live in the same Google Cloud project, so step 1 and 2 are shared and you
only pay the setup tax once. The Calendar half is Track B, Phase 3 in the plan.

### Steps

1. **Create the project.** Go to `console.cloud.google.com`, sign in as
   `nblackhall@blackhallmediagroup.com` (the same account that owns the
   calendars — it matters later for the Calendar half). Top bar, project
   dropdown, **New Project**. Name it something stable like `sala-nera`.

2. **Turn on billing.** Billing → link a payment method. Maps Platform will not
   answer a single request without it, even inside the free allowance. There is
   a standing monthly free tier for Geocoding that this site will not come close
   to — a booking form geocodes an address a handful of times per lead, and the
   result is cached per address. Check the current allowance on the pricing page
   rather than trusting a number written here; Google has changed this model
   more than once.

3. **Enable the Geocoding API — specifically.** APIs & Services → Library →
   search "Geocoding API" → **Enable**. This is the one the site calls. Do not
   confuse it with "Maps JavaScript API" (that draws maps in a browser, which
   this site does not do) or "Places API" (address autocomplete, a different
   feature you might want later).

4. **Create the key.** APIs & Services → Credentials → **Create credentials** →
   **API key**. Copy it. Unlike R2's secret, you can re-read this one later, so
   losing the tab is not fatal.

5. **Restrict it, and restrict it the right way.** Click the new key → edit.
   - **API restrictions**: "Restrict key" → tick **Geocoding API** only. This
     is the restriction that matters. An unrestricted key that leaks can be
     spent against every API in the project.
   - **Application restrictions**: leave as **None**. This is a
     server-side key — `lib/geocode.ts` calls Google from Vercel, never from
     the browser. "HTTP referrers" is for keys embedded in a web page and would
     break this one. IP restriction sounds right but Vercel's egress addresses
     are not stable, so it would break too, intermittently, which is worse.
   - Consider setting a **quota cap** on the Geocoding API (APIs & Services →
     Geocoding API → Quotas) — a few thousand requests a day is far above real
     use and turns a runaway loop or a scraper into an error instead of a bill.

6. **Put it in Vercel.** Production is the only one that is actually required:

   ```sh
   npx vercel env add GOOGLE_MAPS_API_KEY production
   npx vercel env add GOOGLE_MAPS_API_KEY development   # only to test locally
   ```

   **Do not copy R2's "all three environments" rule here.** That rule exists
   because R2 needs four variables and a *partial* config makes the app quietly
   serve unsigned paths — a real failure mode worth guarding. This is one
   variable behind one honest boolean: without it `hasGeocoding()` is false and
   the form says so on the page. `development` earns its place only because it
   is what `vercel env pull` reads, so it is the difference between testing on
   localhost and testing on the live booking form. `preview` is pointless while
   `main` is the only branch anyone deploys.

7. **Pull it locally** so dev matches: `npx vercel env pull`. (See the
   `.env.local` gotcha above — it is a snapshot, not a live link.)

8. **Check it.** Open `/book`, go to the Property step, and type a real DFW
   address. Within about a second the hint under the address field should stop
   saying "We'll confirm travel when we follow up" and start saying either
   "Within our included travel radius" or "Adds $999 for travel". Try somewhere
   deliberately far — an address in Houston or Oklahoma City should say travel
   is quoted after contact, and the estimate should show "+ items quoted after".

### If it does not work

The hint saying "We'll confirm travel when we follow up" is the catch-all for
*every* failure, by design — it never guesses a distance. So when it will not
budge, the reason is in the logs, not on the page. `lib/geocode.ts` logs the
exact status Google returned:

- **`REQUEST_DENIED`** — the key is wrong, the Geocoding API is not enabled on
  the project, or you left an Application restriction on it. Far and away the
  most likely, and step 5 is where it usually goes wrong.
- **`OVER_QUERY_LIMIT`** — billing is not actually active, or a quota cap is
  set too low.
- **`ZERO_RESULTS`** — nothing wrong with the setup; Google genuinely cannot
  place that address. Try a known-good one before suspecting the key.
- **Nothing at all in the logs** — the key is not reaching the running app.
  Check it landed in the environment you are actually testing (`vercel env ls`),
  and remember a newly added variable needs a redeploy to take effect.
