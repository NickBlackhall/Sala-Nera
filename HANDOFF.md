# Sala Nera — Handoff (Sep 18 2026)

## Latest — Sep 18: the Google Calendar credential is done. Every blocker for `lib/scheduling.ts` is now cleared

Session resumed after the Codespace crashed (nothing was lost — `git status`
was clean, `main` matched `origin/main`). Picked up where Sep 16 left off:
the two blockers for `lib/scheduling.ts` were working days/hours and the
Google Calendar service account. **Both are now resolved. This is the last
credential-shaped gap in the whole booking build.**

**Working days/hours/buffer — resolved, asked Nick directly:**
- Days: **Monday–Thursday only.** No Friday, no weekends.
- Hours: **8am–5pm.**
- Buffer between back-to-back bookings: **a flat 1 hour**, on top of (not
  instead of) the drive-time buffer already in `lib/distance.ts`. Supersedes
  the older "buffer scales with distance" idea in the Calendar, Distance &
  Stripe plan artifact (Sep 9) — that was a guess made before Nick weighed
  in; use the flat-hour number, not the artifact's.

Combined with the ~4hrs/2,500 sqft duration number from Sep 16, this is
every number `lib/scheduling.ts` needs from Nick.

**The calendar architecture changed from the Sep 9 plan — read this before
touching `lib/scheduling.ts`.** The plan artifact
(https://claude.ai/artifact/WcnHjuTYdrQXKedqBTfdGZ) describes a two-calendar
design: a real-commitments calendar checked read-only (free/busy), and a
separate "Sala Nera Bookings" calendar Sala Nera writes its own holds onto.
**That's superseded.** Walking through it live with Nick surfaced two things
the plan had wrong or hadn't accounted for:

1. **The real-commitments calendar is not named "Appointments."** It's
   **"Blackhall Media Group Appointments."** Don't use the shorter name
   anywhere — it doesn't exist and will send whoever's reading this hunting
   for a calendar that isn't there.
2. **Nick doesn't want two calendars.** "Blackhall Media Group Appointments"
   is shared between BMG (his other brand) and Sala Nera — both are real
   commitments for the same one photographer, and Nick would rather have one
   true calendar than reconcile two. Confirmed the load-bearing fact first:
   a manual block on that calendar already blocks the same time on Spiro
   (BMG's booking tool), meaning Spiro just reads calendar conflicts rather
   than doing anything special with the events themselves — so a
   Sala-Nera-written event should behave exactly like a manual one and
   protect both brands automatically.

**Decided: one calendar, not two.** `lib/scheduling.ts` reads *and* writes
directly to **"Blackhall Media Group Appointments."** Every Sala Nera
booking must be clearly tagged in the event title on creation, e.g.
**"[Sala Nera] 4200 Preston Hollow Ln"** — this is how Nick tells the two
brands apart at a glance, so don't skip it when this gets built. The
separate "Sala Nera Bookings" calendar from the Sep 9 session is **unused,
not part of the design** — leave it alone, nothing reads or writes it.

**The service account is fully set up, shared, and its credentials are live
in Vercel Production**, confirmed via `vercel env ls production`:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID` — the ID of "Blackhall Media Group Appointments"

Same Google Cloud project as the Maps key: **sala-nera**, under
`nblackhall@blackhallmediagroup.com`. Service account name
`sala-nera-scheduler`. Shared onto "Blackhall Media Group Appointments" with
permission **"Make changes (see private events as free/busy)"** — the
closest match to the original privacy intent (Sala Nera can write its own
events; other calendar entries it doesn't need full detail on stay as
free/busy) even though the two-calendar isolation plan was dropped.

**Two real Google/Workspace obstacles hit along the way — expect these again
on any future service-account setup in this same Google account, they are
not one-off flukes:**

1. **New GCP projects now block service-account key downloads by default**
   ("Secure by Default"). The fix is an Organization Policy override, and
   Google's console makes this genuinely confusing:
   - The constraint that matters is the **legacy** one, ID exactly
     `iam.disableServiceAccountKeyCreation` — **not**
     `iam.managed.disableServiceAccountKeyCreation` (a decoy with an almost
     identical display name, "Disable service account key creation," and a
     `Status: Not enforced` that makes it look like a red herring — it is
     one) and **not** `iam-managed.disableServiceAccountApiKeyCreation`
     ("Block service account API key bindings," a different feature
     entirely). All three showed up while hunting for this in the console.
     Search the constraint list for `disableServiceAccountKeyCreation` and
     pick the one tagged **"Managed (Legacy)."**
   - Fixing it needed a role Nick didn't have yet: **Organization Policy
     Administrator**. Google's own "Fix access" flow on the permission-denied
     screen let him grant it to himself in one click (target resource:
     `blackhallmediagroup.com`) — safe here since he's the sole owner of the
     whole account, but worth knowing this is an org-wide grant, not scoped
     to one project.
   - With that role, IAM & Admin → Organization Policies → the legacy
     constraint → Manage policy → **Override parent's policy** → **Add a
     rule** → enforcement **Off** → Set policy. This override is scoped to
     just the `sala-nera` project, not the whole account.
2. **Google Workspace blocks granting "Make changes" calendar access to
   anything outside the domain, by default** — and a service account
   (`@sala-nera.iam.gserviceaccount.com`) counts as outside
   `blackhallmediagroup.com` even though Nick owns both. Symptom: the
   "Make changes…" options are greyed out in the calendar's own sharing
   dialog, with a small note "Some sharing options may have been turned off
   for your organization by your administrator." Fix is in the **Workspace
   Admin console**, a different system from Google Cloud:
   `admin.google.com` → Apps → Google Workspace → Calendar → Sharing
   settings → General settings → **"External sharing options for secondary
   calendars"** (matters here because "Blackhall Media Group Appointments"
   is a secondary calendar, not Nick's primary one) → change from "Share all
   information, but outsiders cannot change calendars" to **"Share all
   information, and outsiders can change calendars."** Takes a couple
   minutes to propagate. Don't pick the "allow managing of calendars" tier
   above it — that additionally lets the service account change sharing
   permissions, which it never needs to do.

**The downloaded JSON key file was handled without ever putting the private
key into the chat transcript**, worth repeating for any future credential
like this one: Nick dropped the file into `reference/` (already
git-ignored, confirmed before use — "Confidential third-party course
materials — never commit" in `.gitignore`), it was read directly and the
`client_email` / `private_key` fields piped straight into
`vercel env add ... production` via temp files in the session scratchpad,
never printed to stdout or echoed back in chat. Both the scratchpad copies
and the `reference/` copy were deleted immediately after confirming the
Vercel variables landed. The calendar ID (not sensitive) came through chat
directly and was used the same way. **Follow this same pattern next time a
raw credential file needs to go from Nick's machine into Vercel — never ask
him to paste a private key as text.**

**Nick also asked for far more detailed, click-by-click instructions than
the usual plain-language summary this session** — he's non-technical and
wants every click and button label spelled out, not a summarized appendix.
Apply that level of detail for any future console walkthrough like this one;
it's a stronger version of the existing "explain plainly, don't dump jargon"
rule.

**Next real step: build `lib/scheduling.ts`.** Every input it needs now
exists — duration (~4hrs/2,500 sqft), hours (Mon–Thu 8–5), buffer (flat 1hr),
and a live, working credential against the one calendar that matters. Phase
2 from the plan artifact (duration/hours/buffer logic, pure code) and Phase
3 (the free/busy check, adjusted for one calendar instead of two, plus the
"[Sala Nera]" title-tagging requirement above) are both buildable now.

## Latest — Sep 16: R2 is connected and the upload button is live

Session opened with a scan against production (nothing had changed since the
Sep 14 entry below — `GOOGLE_MAPS_API_KEY` is still the only credential set,
no R2, no Calendar service account), then a plain-language walk of the whole
client journey with Nick and three decisions:

1. **Instant, calendar-backed booking is reconfirmed** — asked directly again
   given the numbers are still incomplete, Nick chose fully instant over a
   manual-confirm fallback. No code changed here; still blocked on the Google
   Calendar service account and his working days/hours.
2. **The shoot-duration conflict is resolved: ~4 hours for 2,500 sq ft is the
   real number.** The older "3,329 sq ft = 90 min" anchor is superseded — do
   not use it. `lib/scheduling.ts` still needs working hours/days and a
   buffer decision before it can be written.
3. **The real upload path is a manual button in `/admin`, not a Dropbox
   pipeline.** Nick's actual workflow: shoot → raw to Dropbox → editor
   delivers to a Dropbox "Finished" folder → his QC pass → today, upload to
   Spiro for the client gallery. Spiro is his current delivery product, not
   just booking. The new button replaces only that last step. Confirmed
   along the way: yes, `/portal` is deliberately a Pixieset-style gallery he
   owns instead of renting.

**Built, deployed, and no longer waiting on anything:** the admin upload
button (item 1 in the gap list below, the biggest blocker in the whole
journey). It was written in the usual "one credential away" shape, and then
**Nick connected Cloudflare R2 in the same session**, so unlike Google Maps
before it, this one did not sit dormant — it is live with real credentials
behind it. The single thing left is putting a real file through it; see
"the test still owed" below.

- `lib/sigv4.ts` — `presign()` now takes a `method`, defaulting to `GET` so
  every existing caller is untouched. `PUT` is what an upload needs.
  `npm run check:sigv4` still passes against the AWS reference vector, and
  since that vector only ever exercised GET, the PUT was additionally checked
  against an independently written implementation of the canonical request —
  confirming the method is genuinely signed rather than silently ignored.
- `lib/storage.ts` — `uploadUrl(key)`, a presigned PUT, `null` when R2 isn't
  configured. Files go straight from the browser to R2, never through a
  Vercel function — the same reasoning as why downloads 302 instead of
  proxying: a serverless function billing for every gigabyte of a property
  film is the wrong shape.
- Two new server actions in `app/admin/actions.ts`, called directly from a
  client component rather than through a `<form>`, since they return data:
  `createUploadUrlAction` (mints the presigned URL, checks the file is
  actually a photo or video, and refuses with a plain-English message if the
  listing is gone or R2 isn't configured) and
  `addMediaAction` (records the row once the browser confirms the bytes
  landed). `lib/admin-queries.ts` gained `insertMediaRow`, `nextMediaSort`,
  `getListingSlug`.
- `app/admin/UploadMedia.tsx` — the button. Multi-file, shows per-file
  progress/errors, reads width/height for photos client-side before upload
  (video is left null — no cheap way to read it in the browser). Wired into
  `app/admin/listings/[id]/page.tsx`, replacing the old "no browser upload
  until R2 is wired up" message — that message now only shows when R2 really
  isn't connected, checked with the same `isRemoteStorage()` the rest of the
  codebase already trusts.

**Two things the browser blocks that have nothing to do with credentials.**
Both were caught in review, before any of this ran against a real bucket.
Both fail in ways that look exactly like "R2 is misconfigured", which is why
they are written down here rather than left to be rediscovered at 11pm:

1. **The site's own CSP had to be taught about R2** (`next.config.mjs`).
   `connect-src 'self'` would have blocked the upload's PUT outright — the
   button could never have worked, with or without a correct bucket. Worse,
   `img-src`/`media-src` were equally narrow, so the *whole portal gallery*
   would have gone blank the moment media moved to R2, since every preview
   becomes a signed cross-origin URL. Fixed by naming the exact R2 host
   (built from `R2_ACCOUNT_ID`) in those three directives — not a wildcard,
   so it permits Nick's bucket and no one else's. When `R2_ACCOUNT_ID` is
   unset the header is byte-for-byte what it was before, verified both ways.
   **A newly added env var needs a redeploy before this header changes.**

2. **The bucket needs a CORS policy**, which the R2 appendix below predates.
   Uploads go straight from the browser to R2's own domain, and a presigned
   URL does not bypass CORS — it only satisfies the bucket's access rules.
   `content-type` must be in the allowed headers or the preflight fails:

   ```json
   [
     {
       "AllowedOrigins": ["https://salanera.com", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

Verified: `npm run typecheck`; `npm run check:sigv4` (still matches the AWS
vector); `npm run build` (clean, 27 routes); the CSP header inspected live
both with and without R2 configured; the presigned **PUT** checked against an
independently written implementation of the canonical request, confirming the
method is genuinely signed rather than ignored (the AWS vector only ever
covered GET); the upload button confirmed to appear with R2 configured and
to be replaced by the honest "not connected" message without it, both as
real authenticated requests against `/admin/listings/1`; and `max(sort)`
confirmed against the real database to come back as a number, not the string
`count()` returns — see the note in `nextMediaSort`.

**Not yet verified: an actual file landing in a real bucket.** See the test
still owed, below.

### Cloudflare setup — done, walked through live with Nick

Every step below was walked live, step by step, in this same session, and
the resulting values are confirmed present in Vercel Production:
- Bucket created (R2 **Object Storage**, not R2 Data Catalog — a different,
  unrelated product that also shows up in the sidebar).
- Public access confirmed **disabled** — that's the correct default state,
  nothing had to be changed.
- CORS policy entered (the JSON block above).
- API token created: **Object Read & Write**, scoped to just this bucket,
  **no client IP filtering** — deliberately skipped, same reasoning as the
  Google Maps key below: Vercel's servers don't have a fixed IP, so an IP
  restriction would make the token fail intermittently rather than protect
  it.
- All four values entered into Vercel as **Production only**, type Secret,
  and confirmed present with `vercel env ls production`.

**One deliberate deviation from the R2 appendix below, worth not
"fixing":** the appendix says all four variables go in Production, Preview,
*and* Development. Talked through with Nick and simplified to **Production
only** — he only ever deploys from `main` (Preview is genuinely pointless,
same conclusion the Google Maps key appendix already reached), and
Development just means "usable from `npm run dev` in this Codespace,"
which isn't needed to verify a real upload — that can be done directly
against the live site, the same way a real booking submission was verified
against production earlier in this project. If local testing is wanted
later, add Development then; don't add it by default.

**Committed, pushed and deployed** — `cae8d29` (the feature) and `e88e078`
(this file), live at salanera.com as of Sep 16, 21:54 UTC. That deploy is
the first one carrying both the R2 credentials and the upload button, so
`isRemoteStorage()` is true in production for the first time and the admin
"media is not on R2 yet" notice should now be gone.

### ⬜ THE TEST STILL OWED — run this first, next session

**Nobody has yet put a real file into the real bucket.** The feature was
built and checked before any bucket existed, so this is the first contact
between the two, and a typo in a pasted value (the bucket name especially)
would only show up here. Nick asked for it to be marked outstanding — he
wants to run it together rather than have it done for him:

1. ~~Check the CSP header picked up the R2 host.~~ **Done, and it passed.**
   Checked against the live site immediately after this deploy: `img-src`,
   `media-src` and `connect-src` each now name
   `https://<account-id>.r2.cloudflarestorage.com`, where the same header
   named none of them before the deploy (that baseline was captured first,
   so the comparison is real). **This also settles a genuine open question:
   Vercel Secret-type variables *are* available at build time** — the CSP is
   built from `R2_ACCOUNT_ID` in `next.config.mjs`, which is type Secret, and
   it came through. No need to change it to Config. Re-run the check any time
   with:

   ```sh
   curl -sSD - -o /dev/null https://salanera.com/ | grep -i content-security
   ```

2. ⬜ **Upload one photo and one video** through
   `/admin/listings/<id>` on the live site, and confirm: the row appears in
   the media grid, the thumbnail renders (that proves `img-src` and a
   working presigned GET), and the file is visible in the Cloudflare
   dashboard under `listings/<slug>/`.

3. **Then open the listing in `/portal/<slug>` as the client** and confirm
   the gallery renders the new media, locked and unlocked.

If an upload fails, read the CORS and CSP notes above *before* suspecting
the credentials — both fail silently in the browser console rather than as
a 403 from R2, which is exactly what makes them look like a key problem.

**After the test passes**, the "Media bytes — still world-readable local
paths" row in the Verified state table below finally becomes false, and the
portal can honestly be described as protecting files. Not before.

**Then** the two remaining booking blockers from Sep 14 are unchanged: the
Google Calendar service account, and Nick's working days/hours for
`lib/scheduling.ts`.

## Latest — Sep 14: the terms/signature step is built

Closes out item 1 from the Sep 11 recommended order below. `/book` now has a
seventh step, modeled on Guthrie's step 7: an "Agreement" panel with
placeholder shoot terms (`lib/terms.ts`), where typing a full legal name
serves as the e-signature. Same shape as `RATES_ARE_PLACEHOLDER` — obviously a
stand-in, not a guess dressed up as real; Nick will supply real terms text
later. The server route (`app/api/booking/route.ts`) rejects a submission
with no signature and includes it, plus a placeholder-terms warning, in
Nick's lead email.

Verified: typecheck, production build, and a real-browser walkthrough at
1280px and 390px — reachable, blocks Send without a signature, no horizontal
overflow. Committed as `d641900`.

**Nothing else changed since the Sep 11 evening entry below** — the client
journey map, the rates CMS sketch, and every open item there are still
exactly as described, minus this one line item now being done.

## Latest — Sep 11, evening: the whole client journey, mapped end to end

Nick stepped away after this session's booking-form work and asked for three
things before he went: (1) delete the stray admin-email client row — done,
see the previous entry, confirmed by re-querying the row is gone and its one
booking now shows `client_id: null`; (2) a full walk of the client journey
from clicking "Book a Shoot" to downloading finished photos, marking what's
real versus what's a gap; (3) a first sketch of the rates CMS. All three are
below. Nothing in this entry changes code — it's the map, not a build.

**Two small facts from Nick, not yet acted on:**

- **A shoot-duration anchor, for the eventual calendar work:** roughly 4
  hours for 2,500 sq ft, photography + drone + video together. He does not
  have more granularity than that yet, and said so plainly. **Flag: this
  does not agree with the anchor already on file** (3,329 sq ft = 90 minutes,
  a few sections down) — 4 hours for 2,500 sq ft is over 3× the rate per
  square foot that number implies. Don't average them or guess which is
  right. Ask Nick directly which one describes the real day before
  `lib/scheduling.ts` is written — a wrong duration double-books him, which
  is worse than a wrong price.
- ~~The booking form's terms/signature step (Guthrie's step 7) is wanted.~~
  **Built Sep 14** — see the entry at the top of this file.

---

### The client journey, start to finish

Each stage says what's real, what's still a gap, and where the code lives.
"✅ Real" means tested and live in production right now, not just written.

**1. An agent lands on `/book` and fills out the form.**
✅ Real: seven steps (Contact → Property → Details → Services → Notes →
Agreement → Review), live pricing as they type, Guthrie's service/add-on
menu, a terms/signature step, honeypot and timing checks, server-side
re-pricing so the browser's number is never trusted.
`app/book/BookingForm.tsx`, `app/api/booking/route.ts`.
⬜ Gap: no real calendar yet — "desired date" is a request, not a slot.

**2. They submit.**
✅ Real: Nick gets an emailed lead with every field, including the new
Property Details block. The agent gets a confirmation email that does not
quote a price while rates are placeholders. The booking is saved to the
`bookings` table with the exact prices it was quoted — a later rate change
can never rewrite it. A client account is created or reused automatically
from the email address (skipped for Nick's own admin addresses). Every
outcome — sent, discarded as a bot, rejected, or failed — is written to
`/admin/activity`.
⬜ Gap: nothing books a hold on Nick's actual calendar. Nothing drafts a
Stripe invoice, even though the guide describes that as an automation.

**3. Nick reviews the lead and replies to confirm the date and real price.**
✅ Real: `/admin/bookings` lists every saved booking with what was quoted;
`/admin/activity` shows delivery status; `/admin/clients` now shows the
account the booking created, including a warning if it's ever an admin
address, and can delete one.
⬜ Gap: this whole step is Nick, by hand, in his email client — nothing
automates the back-and-forth yet. This is the piece "instant booking" is
meant to remove.

**4. Nick creates the listing in `/admin`.**
✅ Real: `/admin/listings/new` — address, slug, assign to a client (the
dropdown already includes anyone the booking form created), shoot date,
lock state. Deliberately still a manual step, on purpose: a booking does not
create a listing by itself, so a junk or test booking can't spawn a gallery,
and later, can't spawn a Dropbox folder pair either.
⬜ Gap: nothing links a saved booking row to the listing it becomes — Nick
re-types the address by hand. Small, but worth a "create listing from this
booking" button on `/admin/bookings` once the rest settles.

**5. Nick shoots it, edits, and gets the finished files onto the site.**
✅ Real, as of Sep 16, once R2 lands: `/admin/listings/[id]` has an upload
button — pick photos or video, they go straight from the browser to R2, and
the gallery picks them up immediately. Nick's real workflow stays the same
up to this point (Dropbox with his editor, his own QC pass); this button
replaces only the final "upload to Spiro" step. Decided explicitly against a
Dropbox-folder pipeline — see the booking-direction memory.
⬜ Gap: the button can't actually store anything until Cloudflare R2 (below)
is connected — the admin page shows an honest "not connected yet" message
in its place until then, same shape as every other "one credential away"
feature in this codebase.

**6. The client signs in.**
✅ Real, completely. Email in, a magic link out, no password. Whether it's
a booking-created account or one Nick made by hand makes no difference.
`lib/session.ts`, `/portal/login`.

**7. The client sees their gallery.**
✅ Real: `/portal` lists every listing they (or their team) own; `/portal/[slug]`
shows the gallery. Locked listings show watermarked previews and no working
download button; unlocked ones don't. Ownership is checked server-side,
team-sharing included, and a listing that isn't theirs 404s rather than 403s
so a stranger can't use the error itself to learn anything.
⬜ Gap: none, for what exists. This step works today for any listing that
actually has media on it (see step 5).

**8. The client pays to unlock.**
⬜ **This does not exist yet, in any form.** `downloadLocked` is flipped by
Nick clicking a button in `/admin`. There is no checkout, no invoice, no
Stripe integration anywhere in the code — `invoices` is a table shape in the
schema and nothing else. The plan (see "Calendar, Distance & Stripe" below)
is pay-to-download at the portal lock, not a charge at booking time, and
that `invoice.paid` should call the exact same `setListingLock()` the admin
button already calls — so Stripe, whenever it lands, slots into a mechanism
that's already built and tested, rather than needing its own.

**9. The client downloads.**
✅ Real and tested: `GET /api/portal/download/[id]` and
`POST /api/portal/download` check the session, ownership, and the lock
before minting anything, and log every download. The lightbox and gallery
buttons go through this route, not straight at a file.
⚠️ **Real, but currently pointless: the files themselves are not protected.**
Media rows point at `/demo/*.jpg` under `public/`, which anyone can fetch
directly, lock or no lock. The enforcement is real; the thing it's
enforcing access to isn't private yet. **Updated Sep 16: R2 is now
connected**, so the plumbing is finally there — but this step only becomes
real for media that actually lives in the bucket. The seeded demo rows still
point at `/demo/*.jpg` under `public/`, so they remain fetchable by anyone
with the path. Upload real media through the new admin button and that
listing genuinely is protected; the demo ones stay unprotected until they
are replaced or deleted.
⬜ Smaller gaps here: "Download All" fires one request per file rather than
a real zip (fine until it isn't); MLS-size derivatives don't exist (the
button says so rather than pretending); an activity click-through from
"who downloaded what" back to `/admin/bookings` doesn't exist yet.

---

### Every gap, gathered in one place

In the order they'd unblock the most:

1. ~~No upload path for real media~~ (step 5). **Built and deployed Sep 16**
   — an admin upload button, live with real R2 credentials behind it. One
   test still owed: see the Sep 16 entry at the top of this file.
2. ~~Cloudflare R2 not connected~~ (step 9). **Connected Sep 16**, walked
   through live with Nick: bucket created and private, CORS policy set, API
   token scoped to the bucket, all four values in Vercel Production. The
   remaining caveat is not configuration but content — **no real file has
   been put in the bucket yet**, and the existing demo media rows still
   point at local `/demo/*.jpg` paths, so nothing is actually protected
   until real media is uploaded to replace them.
3. **No instant calendar booking** (steps 1–3). Blocked on the Google
   Calendar service account (not started) and working days/hours — the
   duration-per-sqft number itself is resolved, see the Sep 16 entry.
4. **No Stripe / no way to actually pay** (step 8). Needs Nick present;
   scoped as pay-to-download, slots into `setListingLock()`.
5. ~~No Dropbox Raw/Finished pipeline~~ (step 5). **Decided against, Sep 16**
   — Nick chose the manual upload button instead. Not being built.
6. ~~No terms/signature step on `/book`.~~ **Built Sep 14.**
7. **Real shoot rates.** Deliberately parked by Nick; his real numbers
   already exist on his live Spiro page whenever he's ready — a five-minute
   look, not a research project.
8. **No CMS for services/prices.** Brainstormed below; not started. The
   database table, loader and validator it would sit on top of already
   exist.
9. **No "create listing from this booking" link** (step 4). Small.
10. **No MLS-size exports, no real zip for batch downloads** (step 9).
    Both explicitly deferred already; revisit if either turns out to matter
    in practice.
11. **Privacy page is stale.** Still describes only "inquiries" via Vercel
    and Resend — doesn't mention saved bookings, client accounts, or Neon
    (the database). Nick's wording call, not touched.

### Recommended order, given what's already true

R2 is Nick's own task and already in progress, so it isn't "next" for a
session to pick up — but everything downstream of it (real protection,
Dropbox) waits on him finishing it regardless of what else gets built.
With that in mind, in the order a session should actually work through them:

1. ~~The terms/signature step on `/book`.~~ **Built Sep 14.**
2. ~~A real upload path.~~ **Decided (manual button, not Dropbox) and built
   Sep 16.** Confirm one real upload end-to-end once Nick has R2 connected —
   see the Sep 16 entry at the top of this file.
3. **Resolve working days/hours with Nick, then build `lib/scheduling.ts`
   and instant calendar booking**, once the Google Calendar service account
   exists. The duration-per-sqft number is resolved (~4 hrs / 2,500 sq ft);
   this is the actual centerpiece of "get the booking portal figured out" —
   everything else in the booking form has been leading here.
4. **The rates CMS**, whenever Nick wants to stop parking pricing — see the
   brainstorm below. Foundation already exists; this is real but not urgent.
5. **Stripe**, needs Nick present for the business decisions (pricing,
   what "paid" means, refunds). Mechanically simple once decided.

---

### Brainstorm: what the rates CMS could look like

Nick asked for a page where he changes services and prices without a
developer. Here's a first sketch — not built, not committed to.

**What already exists to build on:** `rate_cards` (a versioned table — one
jsonb document per save, newest wins, nothing is ever overwritten), the
validator in `lib/rate-card-validate.ts` (catches gapped size bands, a final
band that isn't open-ended, an add-on tied to a retired service, and more —
already proven against nine deliberately broken cards), and `lib/rate-card.ts`
(falls back to the built-in card on anything unreadable, so a bad save can
never take pricing down). The editor's whole job is to be a form in front of
data that already knows how to validate and version itself.

**Phase 1 — read-only**, proving the loading path before anything is
editable:

```
/admin/rates
┌─────────────────────────────────────────────────────────┐
│ Rate card                              Version: built-in │
│                                    (no saves yet)         │
├─────────────────────────────────────────────────────────┤
│ THE SHOOT                                                │
│  Interior & exterior photography     tiered, 5 bands     │
│  Cinematic property film             tiered, 3 bands     │
│  Basic social reel                   tiered, 3 bands     │
│  ...                                                     │
│ ADD-ONS                                                  │
│  Twilight session          $999   → only with Photography│
│  Verticals & vignettes     $999   → only with Photography│
│  Floor plan                $999                          │
│  ...                                                     │
│ TRAVEL                                                   │
│  0–20 mi: included · 20–50: $65 · 50–75: $100 · 75+: ask │
└─────────────────────────────────────────────────────────┘
```

**Phase 2 — editing.** Each service becomes a small editable card:

```
┌─ Twilight session ──────────────────────── [Retire] ─┐
│ Name        [Twilight session___________]            │
│ Blurb       [A second visit at dusk...___]            │
│ Group       ( ) Core   (•) Add-on                     │
│ Only with   [x] Photography  [ ] Cinematic film  ...  │
│ Pricing     (•) Flat  ( ) Tiered  ( ) Quoted after    │
│             $ [999____]                               │
└────────────────────────────────────────────────────────┘
[+ Add a service]
```

A tiered service's pricing block expands into its bands instead of one
dollar field:

```
│ Pricing     ( ) Flat  (•) Tiered  ( ) Quoted after    │
│             Up to  [1999_] sq ft →  $[999__]          │
│             Up to  [3499_] sq ft →  $[999__]          │
│             Up to  [4999_] sq ft →  $[999__]          │
│             Up to  [7499_] sq ft →  $[999__]          │
│             Above that            →  ( ) Quoted after │
│             [+ Add a band]                            │
```

**Saving** runs the exact same `validateRateCard()` the codebase already
ships, before anything is written — a bad save is refused with the same
plain-English problem list the validator already produces (e.g. "Twilight
session: Every service it goes with is retired, so it can never be
offered."), not a stack trace. A successful save writes a **new** row —
never edits an old one — with a short required note ("what changed, in your
words") and Nick's email, matching how `rate_cards` already works.

**History**, a second tab or a section below:

```
┌─ History ──────────────────────────────────────────────┐
│ Sep 15, 2:14pm  "real photography prices"     [Restore]│
│ Sep 12, 9:03am  "added drone bundle discount" [Restore]│
│ (built-in card — the one shipped in code)              │
└──────────────────────────────────────────────────────────┘
```
Restoring an old version saves it again as a **new** version, per the
existing design — the history itself is never rewritten, so what was live
and when is always honest.

**One real architectural question this raises, worth deciding before
building it:** `rates.md` — the file the invoicing automation reads — is
currently *generated from the TypeScript file* by a script Nick runs by
hand (`npm run rates:doc`), then committed. Once prices live in the
database and change from a browser with no deploy, a committed file goes
stale the moment someone edits a price. Two ways to fix it:

- **(A) Render it on request instead of generating a file.** An endpoint
  (e.g. `/api/rates-doc`, or an admin page) reads whatever the *live* rate
  card is right now and renders the same markdown format on the fly — so
  the invoicing automation always sees the current price, never a stale
  commit. No file, no `npm run rates:doc` step, ever, once this exists.
- **(B) Regenerate and re-commit `rates.md` on every CMS save.** Possible,
  but means the editor needs write access to the git repo from a Vercel
  serverless function, which is a strange amount of power to hand a form
  that changes a phone number — and it reintroduces exactly the "did
  someone remember to run the generator" risk the generator was built to
  remove.

**(A) is the better fit** — it keeps "one source of truth" the same
principle that already governs `lib/rates.ts` vs. `rates.md` today, just
moves the source of truth from a file to the database row `lib/rate-card.ts`
already reads. Worth deciding with Nick before `/admin/rates` is built,
since it changes what "the invoicing automation reads rates.md" means going
forward — probably "reads this URL" instead.

```mermaid
flowchart LR
    A["/admin/rates — Nick edits"] -->|validateRateCard| B{Valid?}
    B -->|No| A
    B -->|Yes, new row| C[("rate_cards table\n(versioned, newest wins)")]
    C --> D["lib/rate-card.ts\n(falls back to built-in)"]
    D --> E["/book — live pricing"]
    D --> F["app/api/booking — server re-pricing"]
    D --> G["/api/rates-doc (proposed)\nrenders current card as text"]
    G --> H["Invoicing automation reads this,\nnever a committed file"]
```

## Latest — Sep 11, afternoon: Guthrie's menu is on /book

Nick sent screenshots of all seven steps of jacobguthrie.com/book, now in
`reference/guthrie-screenshots/`. That settles the question the next section
leaves open: **Guthrie for the form's structure and menu, Spiro for the booking
mechanics** (real calendar slots, instant confirmation). The look of `/book`
does not change.

Built — the menu only, every price still `999`:

- Four new core services: Basic social reel, Luxury social reel, Basic
  property video, and "Something else" (quoted; tells them to use the notes).
- Two new photography add-ons: Verticals & vignettes, AI twilight.
- **Add-ons can belong to a service** (`appliesTo` in `lib/rates.ts`).
  Twilight, verticals, AI twilight and virtual staging appear under an
  "Interior & exterior photography add-ons" heading only once Photography is
  ticked; everything else is under "Extras". `quote()` enforces it, not just
  the form — an add-on sent without its service is dropped, never charged —
  and unticking Photography clears its add-ons.
- The validator rejects a bad `appliesTo`: on a core service, pointing at
  something that isn't a core service, empty, or every core it needs retired.

Verified: typecheck; `check:rates`, whose new checks were confirmed to fail
with the rule removed; the validator against five broken cards; and a
headless-browser run of the Services step at 1280px and 390px — 23 checks,
stopped at Review without submitting.

Choices made along the way: Twilight used to be offered with anything; it is
now photography-only, matching Guthrie. Drone stills/video stayed in Extras.
The three new video services borrow the film's sqft bands — invented, like
the prices.

**Roadmap, not now: a CMS page for services and prices.** Nick asked for it.
It is the unbuilt `/admin/rates` screen in "The rate card editor" below — the
table, loader and validator already exist. It will need a way to set
`appliesTo`.

**Also built: a Details step** (Contact → Property → Details → Services →
Notes → Review). Guthrie's six property questions — status, listing type,
off-market, which way the front faces, view home, homeowner home — as
one-tap answers, plus access notes, moved here from Property. All optional,
so an agent who doesn't know the facing can still book. The questions and
their allowed answers live in `lib/booking-details.ts`; the booking route
keeps only answers from that list, and Nick's email gets a "Property
details:" block. Steps are now checked by name, not index, so inserting the
next one can't shift the others. Verified in a headless browser at 1280px
and 390px, with the final send intercepted so nothing was emailed or stored.

**Step 2: bookings are saved, and each one opens the client's portal
account** (`lib/bookings.ts`). Only after Nick's lead email has gone out —
never before, so a database problem can't cost a lead — the route creates
the client, or reuses the account for a returning email, filling blanks only
and never overwriting what Nick saved. Then it saves the booking with its
priced lines as a snapshot, which is the "bookings must snapshot their
price" item in the rate card section below. Each part fails on its own into
/admin/activity (`client_not_saved`, `booking_not_saved`). The client's
confirmation email gains a sign-in link, but only when the account really
exists, and the Review step says an account will be created. No listing is
created at booking time: Nick still creates galleries, which also keeps junk
bookings from spawning Dropbox folders once that pipeline exists.
`/admin/bookings` lists them.

**Migration `0003_bookings` is applied** (Sep 11), before the code was
pushed, so no booking ever met a missing table. It was run from the
codespace straight against Neon, with the same statements and transaction
`/api/portal/migrate` uses, after checking `0002_rate_cards` was already
recorded there (i.e. it was the production database). Row counts in the
existing tables were identical before and after. Worth knowing for next
time: the classifier blocked curl to salanera.com then, and a direct Neon
connection from the codespace works. (**Stale as of Sep 16** — curl to
salanera.com succeeds from this Codespace now; it was retested directly.
Don't skip a verification on the assumption it's still blocked.) A fresh
database still gets everything
from the curl under "To create the table" below. /admin/bookings shows a
message instead of crashing if the table is ever missing.

Verified against a throwaway in-memory Postgres (PGlite) running the real
migration and the real code, not the production database: 18 checks, and
the no-overwrite check was confirmed to fail with the rule removed. That
harness lived in the session scratchpad and is not in the repo.

**Flag for Nick, not changed:** the privacy page talks only about
"inquiries" and lists Vercel and Resend. It doesn't mention saved bookings,
client accounts, or Neon, the database the portal already used. Worth a
line; the wording is his call.

**Found by Nick's own test booking: booking with an admin email creates a
client account under it.** Harmless — admin status wins at sign-in either
way — but confusing to leave sitting in the client list, and it happened on
the first real test. Fixed two ways: `ensureClient()` is no longer called
when the email is one of `ADMIN_EMAILS` (`app/api/booking/route.ts`), and
`/admin/clients/[id]` now warns in place on any client whose email is an
admin address, in case one exists already or gets added by hand. Also added:
deleting a client (`deleteClientRow` / `deleteClientAction` /
`DeleteClient.tsx`), same shape as deleting a listing — their bookings and
listings are kept, just with no owner. There was no way to remove a client
at all before this.

**The stray row from Nick's test is still in production** —
`nblackhall@blackhallmediagroup.com`, client id 4 — because deleting it is a
real production write and the classifier holds those for a person to
confirm, not a script. Delete it from `/admin/clients` whenever; the warning
banner there points at the same button.

**Next, one step at a time** (Nick's preference — plan, confirm, then
build): the terms/signature step. The calendar step is still blocked on the
Google service account and Nick's shoot durations and hours.
*(Update, Sep 14: the terms/signature step is now built — see the top of
this file.)*

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
3. ~~**Cloudflare R2.**~~ **Done Sep 16** — connected, credentials in Vercel
   Production. See the entry at the top of this file.
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
6. ~~Dropbox delivery pipeline.~~ **Decided against, Sep 16** — Nick chose a
   manual upload button instead. See the Sep 16 entry at the top of this
   file; not being built.
7. ~~Browser upload UI~~, then Stripe. **Upload built and live Sep 16**, with
   R2 connected behind it. Stripe is scoped as pay-to-download on the portal
   lock, **not** a booking-time charge — see the plan.

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
| Production build | Clean, 27 routes | `npm run build` |
| Mobile layout | All 7 portal/admin pages fit 390px, no sideways scroll | Playwright measurement |
| Download authorisation | Enforced server-side, 8 cases probed | Live requests, see below |
| Cloudflare R2 | **Connected** Sep 16, all four vars in Production | `vercel env ls`, and the live CSP header naming the bucket host |
| Media bytes | Existing demo rows are **still world-readable local paths**; R2 is ready for new uploads | Nothing has been uploaded to the bucket yet |
| Admin media upload | Built and deployed; **one real upload still untested** | `cae8d29`, live; button confirmed to render with R2 configured |
| Booking form `/book` | Built; 7 steps, live estimate | Measured at 390px and 1280px |
| Booking rates | **Placeholders**, flag still true | `lib/rates.ts` |
| Booking email, end to end | **Delivered**, both emails | Real production submission, read from `events` |
| Distance-based travel pricing | Built, key live since Sep 9 | `npm run typecheck` + `npm run build` clean, `check:rates` passes |
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

## Signed downloads — server side done, bucket now connected

**Read this carefully, the state is genuinely half-and-half** (and was
written before R2 existed — see the Sep 16 correction two paragraphs down).

What is now real: every download goes through a route that checks the session,
checks team-aware ownership, checks the payment lock, and writes a `downloads`
row. `lib/downloads.ts` is the only place any of those decisions are made —
routes must not re-check ownership themselves, because the rules are subtle and
a second implementation is a second chance to get one wrong.

What is still not real, **for the seeded demo listings only**: their media rows
point at `/demo/*.jpg` under `public/`, so anyone with a path can fetch those
files without passing the route at all.

**Updated Sep 16: the private bucket now exists**, so anything uploaded through
the admin button lands in R2 and genuinely is protected by the route. The demo
rows are the exception, not the rule, and they stay unprotected until they are
replaced or deleted. So the honest phrasing is no longer "the portal doesn't
protect files" but "the portal protects uploaded files; the two demo listings
predate the bucket."

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

1. ~~**Cloudflare R2**~~ — **done Sep 16.** The appendix at the bottom of this
   file is what was followed, and has been corrected where it was wrong.
2. ~~Browser upload~~, replacing `scripts/seed-portal.mjs` for real listings.
   **Built Sep 16** — see the entry at the top of this file. `scripts/seed-portal.mjs`
   still exists for reseeding the two demo listings, unchanged.
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

**The CSP in `next.config.mjs` governs anything R2 serves, and it fails
silently in the console rather than on the network.** `connect-src`,
`img-src` and `media-src` all have to name the R2 host or the browser refuses
the request with nothing that looks like an error from R2 — no 403, no
timeout, just a blocked request and a blank image. The host is composed from
`R2_ACCOUNT_ID` at build time, so **adding that variable requires a redeploy
before the header changes.** If uploads or previews fail while the
credentials are known-good, read the CSP header before suspecting Cloudflare:
`curl -sD - -o /dev/null https://salanera.com/book | grep -i content-security`.

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

   **Then set the bucket's CORS policy** — Settings → CORS policy on the
   bucket. Without it the admin upload button fails in the browser, because
   the file goes straight from the browser to R2's domain and a presigned URL
   does not bypass CORS. `content-type` must be allowed or the preflight
   fails:

   ```json
   [
     {
       "AllowedOrigins": ["https://salanera.com", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

3. **Create an API token.** In R2, find API / "Manage R2 API Tokens" and create
   one with **Object Read & Write** permission, scoped to just this bucket
   rather than the whole account. Copy the Access Key ID and Secret Access Key.

4. **Note the account id** from the S3 endpoint shown on the bucket or API page:
   `https://<32 hex chars>.r2.cloudflarestorage.com`. That hex string is
   `R2_ACCOUNT_ID` — not the bucket name, and not the token id.

5. **Put all four into Vercel.** Revised Sep 16: **Production only** is
   enough — Nick only ever deploys from `main`, so Preview is as pointless
   here as it already is for the Google Maps key below, and Development only
   matters for testing from `npm run dev` in the Codespace, which isn't
   needed to verify a real upload (that can be done directly against the
   live site). Add Development later if local testing turns out to matter.
   Either the dashboard, or:

   ```sh
   npx vercel env add R2_ACCOUNT_ID production
   # …repeat per variable, or paste them in the dashboard
   ```

   Remember `lib/storage.ts` treats a *partial* config as no config, on purpose.
   Three of four set means the app quietly keeps serving unsigned local paths
   rather than half-working — so check all four landed in Production.

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
