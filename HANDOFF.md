# Sala Nera — Handoff (rewritten Sep 22 2026, ~17:00 UTC)

Sala Nera is Nick Blackhall's cinematic real-estate media brand (Blackhall
Media Group, Dallas–Fort Worth). One Next.js 16 app serves the public site, the
booking form, the client delivery portal and Nick's admin, deployed from `main`
to **salanera.com** on Vercel.

**This file holds only what is true now.** On Sep 22 it was rewritten from
3,000 lines of session-by-session history, much of it superseded. The old
version, with every decision's back-story, is in git:
`git show 1b39171:HANDOFF.md`. Look there for the *why* behind anything below.
Don't copy old "still owed" lists back in without checking them.

Everything below was checked against the code and the production database on
Sep 22 unless it says otherwise.

---

## 1. Start here

**State:** everything is committed, pushed and deployed. The last code change
is `05e3297`, the all-day calendar block, and **it is now proven live end to
end** (§4.2). The working tree is clean. That push was not confirmed Ready:
auto mode blocked `npx vercel ls` in that session, so it was checked by
serving salanera.com instead.

**Waiting on Nick (his test, then my read-only check):**
1. **Download all photos on his phone.** Open Rockwall
   (`/portal/rockwall-shores-drive`) signed in as his Gmail and download both
   zips. On an iPhone they should land in Files and open as a folder of 32
   photos. Then check read-only:
   `select reason, detail, at from events where kind='download' order by at desc limit 5`.
2. **A horizontal film upload.** It should record about 1920×1080 and get a
   still (`grid_key`/`large_key` set). The only film so far is vertical (media
   56). Check: `select id, width, height, grid_key is not null from media where kind='video'`.
3. **A fresh photo upload that makes its own copies** without pressing Make
   previews. That proves new photos get copies, and the copyright notice, on
   their own; Rockwall's 32 existing copies predate the notice. The latest
   media id is 56, so anything above it is new.

**Next work. Nick picks the order:**
- **UI tweaks he wants to discuss**:
  - The download area, now the zips work.
  - The agent's reschedule/cancel screens. UI only; see the rule in §3.
  - The Low res label (a second agent suggested "Best for phone, web and social").
- **Zip Stage 2:** Download Selected (§4.6).
- **Client-journey gaps, in Nick's order:**
  1. **Real prices and terms.** Both are placeholders
     (`RATES_ARE_PLACEHOLDER`, `TERMS_ARE_PLACEHOLDER`). **Sala Nera's rates
     don't exist yet, and they are not the Spiro ones.** Nick's Spiro page
     (`book.blackhallmediagroup.com/order/bmg/residential`: Silver $250, Gold
     $400, Platinum $820) is Blackhall Media Group's volume-client pricing, a
     different business aimed at a different buyer. Sala Nera is the premium
     cinematic brand. Don't copy the Spiro numbers across, and don't start
     this until Nick says the rates exist (Sep 22: "not ready to do rates
     yet").
  2. **Payment through Stripe, "eventually"** (Nick, Sep 21). Parked.

  (**The Spiro calendar question is fully closed** (Sep 22): Spiro won't
  double-book a Sala Nera shoot, and Spiro's own shoots land on this calendar
  so salanera.com won't double-book Nick either. See §4.2, including the one
  fragility — Spiro writes through Nick's Google account, not its own.)

---

## 2. How to work on this project

**Nick:**
- He is not a developer. Explain in plain terms, lead with the verdict, and
  when he asks "can it do X", go and test X.
- For console walkthroughs (Google, Cloudflare), he wants every click and
  button label spelled out.
- He sometimes runs a plan past a second AI agent and pastes its critique
  back. Judge each point on its merits and check its claims about the code.
  On Sep 22 its diagnosis of a download stall was wrong; its fix was still
  fine.
- **His normal Chrome profile on his new Mac has an extension that silently
  drops downloads.** Nothing reaches chrome://downloads and the tab keeps
  spinning. If a download "doesn't start", check the server side first
  (below), then have him retry in a Chrome Guest window or Safari before
  touching code.

**Production safety:**
- **`.env.local` points at the production database.** A local dev server with
  it reads and writes real data.
- **`.env.local` also holds a real Resend key** (a read-only listing of sent
  emails worked with it on Sep 22). So a local server can send real email too.
  This contradicts older notes that said local email fails.
- **Never send a write-capable request as the admin to the prod-backed local
  server.** On Sep 21 a replayed request locked Rockwall for a minute. Prove
  action gating in the pglite harness. In Playwright, abort anything that
  saves (`page.route(...)` → `route.abort()`) and re-query afterwards.
- **`npm run db:seed` writes to production** through `.env.local`. It reseeds
  the demo listings; don't run it casually.
- **Live checks are read-only.** GET page views with a minted admin cookie
  are fine; POSTs are not. On the live site, Nick does anything that writes
  (upload, delete, press a button), and I verify before and after.
- This workspace has **no R2 keys** and **no Google calendar key**, so
  anything touching the real bucket or calendar is proven on the live site.

**Deploying and migrations:**
- Pushing to `main` deploys production. Wait for Ready with
  `until npx vercel ls 2>&1 | grep -m1 Production | grep -q Ready; do sleep 5; done`.
- Migrations: add statements to `lib/portal-migration.ts` (idempotent, and
  bump `PORTAL_MIGRATION_ID`) plus `lib/schema.ts`, and push that alone. Then
  **Nick runs** the one-liner; auto mode refuses it for me:
  `node --env-file=.env.local -e "fetch('https://salanera.com/api/portal/migrate',{method:'POST',headers:{Authorization:'Bearer '+process.env.MIGRATE_TOKEN}}).then(r=>r.text()).then(console.log)"`.
  Confirm in `portal_migrations`, and only then push code that uses it. The
  endpoint runs the *deployed* code, so push and wait first. Applied so far:
  `0001`–`0008` (`0008_archives` on Sep 22).
- Vercel team `bmg11` is on **Hobby**:
  - 300s function limit and 10 GB/month Fast Origin Transfer.
  - Hobby is for non-commercial use only. Nick knows and will upgrade before
    real clients; don't keep raising it.

**Seeing what happened on production (all read-only):**
- `npm run activity` reads the `events` table. So does /admin/activity.
- `npx vercel logs --since 30m --json` shows per-request status and our
  console lines. It works from this workspace; older notes saying it's
  blocked are wrong. Runtime logs are kept 1 hour on Hobby.
- A throwaway `.mjs` in the project root using `@neondatabase/serverless`,
  run with `node --env-file=.env.local`, then deleted.
- Resend's sent list, to see whether an email really went out:
  `fetch('https://api.resend.com/emails?limit=15', {headers:{Authorization:'Bearer '+RESEND_API_KEY}})`.
- Repeated automated requests to salanera.com can trip Vercel's bot checkpoint
  (an HTML "Security Checkpoint" page instead of JSON). Prefer the database.

**Testing tools:**
- `npm install --no-save playwright @electric-sql/pglite ffmpeg-static`, all
  in one command: a separate `--no-save` install removes the others.
- Playwright's Chromium can't play H.264, so test video with VP9. For
  sideways phone clips, use ffmpeg's `-display_rotation 90`.
- **Demo mode:** `DATABASE_URL= npx next dev -p 3217`. It has no database and
  no R2, and its sample data is in `lib/demo.ts`:
  - `rockwall-shores-drive`: paid.
  - `preston-hollow-lane`: locked.
  - `serenity-trail`: booked, no media.

  The zip route makes demo zips on the spot.
- `.env.local` has `PORTAL_URL=http://localhost:3000`. On another port, set
  `PORTAL_URL` too, or email and sign-out links point wrong.
- Stop a dev server by the PIDs from `ss -ltnp | grep <port>`. Killing the
  `npx` PID leaves `next-server` holding the port. Don't `pkill -f "next dev"`
  in the same command string: it kills its own shell (exit 144).
- **Admin session without email:** sign a JWT with `jose` using `AUTH_SECRET`,
  `{ email: <first of ADMIN_EMAILS>, purpose: 'session' }`, and set it as the
  `sn_portal` cookie (domain `salanera.com` for live GETs). See
  `reference/shoot-media-grid.mjs`.
- The dev overlay's "1 Issue" is React complaining that the site's CSP blocks
  `eval` in development. It is harmless and never appears in production.
- A clean build proves nothing about a route nobody has called. Call it.
- **Measure the page rather than reasoning about it**, for example with
  `getBoundingClientRect()` or `scrollWidth - innerWidth` at 390px.

**Check scripts.** They are in `reference/`, which is **gitignored**: it also
holds confidential course PDFs, so these exist in this workspace only. Run
them with `node --import ./scripts/ts-alias-hook.mjs reference/<name>.mjs`.
All pass at `4abf141`. Counts are included where known:
- **Zips:**
  - `check-zip` (33): Python, `unzip` and `bsdtar` read what `lib/zip.ts`
    writes; ZIP64 is forced.
  - `check-archives` (81): the whole zip flow on pglite with a fake R2.
  - `shoot-download-all` (24): a browser run in demo mode.
- **Downloads and email:**
  - `check-downloads` (33): single-file and bulk routes.
  - `check-delivery-email` (35).
  - `check-admin-signin` (29).
- **Bookings:**
  - `check-booking-changes` (42).
  - `check-booking-listing` (33).
  - `check-claim`.
  - `check-migration`.
  - `check-calendar-allday` (16): the all-day date maths, across both
    daylight-saving switches, and the time in the event title.
- **Media and admin:**
  - `check-copies-action`.
  - `check-media-copies`.
  - `check-listing-delete`.
  - `check-reorder`.
  - `check-property-site`.
- **Package scripts:** `npm run check:sigv4`, `check:rates` and
  `check:scheduling`.
- **Browser runs:**
  - `shoot-media-grid`.
  - `shoot-drag-cases`.
  - `shoot-multi-select`.
  - `shoot-picker`, which needs calendar keys.
  - `shoot-book`.
- **Need real keys or production data:**
  - `check-calendar`.
  - `check-calendar-write`.
  - `check-availability`.
  - `check-live-availability`.
  - `check-rockwall-media`.
  - `measure-gallery`.
  - `live-listing-delete`: writes to production; only with Nick's go-ahead.
- `shoot-download-switch` is **obsolete**: it drives the Download All and
  Download Selected buttons removed on Sep 22. `shoot-download-all` replaced
  it.
- `next-server-stub.mjs` gives checks a `next/server` whose `after()` runs
  inline. Set `globalThis.__after = []` to await it.

---

## 3. Rules Nick has set (don't change without asking him)

**Booking:**
- **Instant booking** onto one real calendar, **"Blackhall Media Group
  Appointments"**, shared with his other brand. There is no separate Sala
  Nera calendar. (A "Sala Nera Bookings" calendar exists but is unused; leave
  it alone.) Events are titled `[Sala Nera] <address>`.
- **Mon–Thu, 8am–5pm.** Starts at 8, 9, 10 or 11am.
- **The calendar event blocks the whole day, all-day, not the shoot's hours**
  (Nick, Sep 22): "record it as an all day appointment, at least while I work
  out how to run Sala Nera more efficiently." The booking's real hours are
  unchanged everywhere else — database, emails, portal. Only the calendar
  entry is all-day. See §4.2 for why, and for the two details that make it
  work.
- **One Sala Nera booking a day, blocked at a flat six hours.** This is
  deliberate: don't replace it with a sqft or service duration model.
- A flat 1-hour buffer, plus drive time (`lib/distance.ts`).
- 48 hours' minimum notice. The 60-day horizon is my choice and easy to
  change.
- Every busy block on that calendar is a hard block, including personal ones
  such as medical appointments.

**Calendar privacy:** read **free/busy only**, never event titles. That keeps
Nick's private appointments out of the site. The read and the write use
separate scopes (`calendar.freebusy` and `calendar.events`) and separate
tokens.

**Agent reschedule and cancel:**
- Allowed up to 48 hours before the shoot, and only when signed in to the
  portal.
- **The UI may be restyled, but don't touch the wiring:** `lib/booking-changes.ts`,
  `app/portal/[slug]/actions.ts`, the guarded UPDATEs, and the calendar and
  email calls. It is proven live.

**Listings and delivery:**
- **Every booking creates its own listing**, fully automatically: locked, with
  the agent as client. Admin cancel deletes it only if it has no media.
- **Delivery emails are sent by Nick pressing a button**, never automatically.
  Uploads arrive in batches and he checks them first.

**Downloads:**
- **Download all photos is one zip per size, films downloaded separately.**
  The ready email builds the zips first and doesn't send if they fail. The
  preview email builds nothing.
- Zip filenames are ASCII only. Photos inside are named `01 - <name>` in
  gallery order.

**Property website:** readable address links, with no random code (Nick
declined codes). It is noindex, and exists for paid listings only.

**Uploads:** the upload path is the manual admin button. A Dropbox pipeline was
decided against.

**Touch:** admin drag-to-reorder is mouse-only. Nick wants finger-drag later, as
separate work.

---

## 4. What's live

### 4.1 Public site and booking form
- **Pages:** `/`, `/work`, `/films` (linked from the footer), `/contact`,
  `/privacy`, `/book`.
- **`/book`** (`app/book/BookingForm.tsx`, `SlotPicker.tsx`,
  `app/api/booking/route.ts`) has seven steps: Contact → Property → Details →
  Services → Notes → Agreement → Review.
  - **Menu and pricing:** Guthrie's service menu and add-ons (`appliesTo`).
    Live pricing uses `lib/rates.ts`, and the server re-prices every
    submission. **All prices are `999` placeholders**, flagged on the form
    and in emails.
  - **Travel:** priced by distance from `BASE_LOCATION` (downtown Dallas, not
    Nick's real base). Geocoding runs through `GOOGLE_MAPS_API_KEY`, which is
    live.
  - **Agreement:** placeholder terms (`lib/terms.ts`), with a typed-name
    signature.
  - **Slots:** real slots from the calendar. If availability can't load, the
    form falls back to a preferred-date request, saved as `requested`. That
    fallback is load-bearing: don't remove it.
- **Anti-spam:** a honeypot `hp_ref` and a 500ms minimum time. There is no upper
  time limit and no rate limiting. **Every silent discard logs an event**,
  because three real bookings were once lost to over-tight rules. Never add a
  silent-discard rule without asking how many real people it would catch.
- **Two emails:**
  - Nick's lead email is required: if it fails, the route answers 502.
  - The agent's confirmation is best-effort. It quotes no total while rates
    are placeholders, and links to their portal listing, where the booking can
    be changed up to 48h before.
- **What gets saved:** each booking is saved with its priced lines as a
  snapshot (`lib/bookings.ts`), and a client account is created or reused.
  Admin addresses get no client account.
- **Rate card storage exists but has no editor.** The `rate_cards` table is
  empty, `lib/rate-card.ts` falls back to the built-in card, and
  `lib/rate-card-validate.ts` checks cards. `rates.md` is generated by
  `npm run rates:doc`; never edit it by hand.

### 4.2 Instant booking and the calendar
- **The pieces:**
  - `lib/scheduling.ts` holds the rules.
  - `lib/calendar.ts` reads and writes Google Calendar through a service
    account signed with `jose`, not `googleapis`.
  - `lib/availability.ts` and `GET /api/booking/availability` serve open slots.
  - `claimSlot()` in `lib/bookings.ts` takes a slot.
- **The one-a-day rule is enforced by the database:** a partial unique index,
  `bookings_one_confirmed_per_day`. Whoever loses a race gets "that slot just
  went".
- **Claim first, calendar second.** A failed calendar write never undoes a
  booking; /admin/bookings flags it as "not on your calendar".
- A failed availability read returns **null, never an empty list**, so an
  outage offers nothing rather than everything.
- **Env vars:** `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
  `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (stored with **real newlines**, so don't
  `.replace(/\\n/g,…)` it) and `GOOGLE_CALENDAR_ID`. They are in Production
  only, as Secret, so they aren't pullable and local dev shows the fallback.
- **Spiro reads the same calendar. Verified by Nick on Sep 22.** With Sala
  Nera booking 5 holding Thu Oct 1, 10am–4pm, he tried to book that time on
  Spiro. Spiro let him pick it, then refused at checkout ("that time isn't
  available"), and on a reload offered only 4pm and later. So Spiro cannot
  complete a booking over a Sala Nera shoot. Note that Spiro's *first* list of
  times is stale; the gate is at checkout.
  - **This is why bookings are all-day blocks.** Spiro offered 4pm, the minute
    the six-hour Sala Nera block ended, with no pack-up or drive time: Spiro
    knows nothing of our buffer. Rather than chase a buffer setting inside
    Spiro, Nick chose to take the whole day off the market (§3). An all-day
    event does that everywhere at once.
  - **All-day blocks work on both sides. Proven Sep 22** — first with a
    hand-made event on Thu Oct 15, then **end to end with a real booking the
    app wrote itself**. Nick booked 520 Cashmere Drive for Mon Oct 5, 11am. The
    event the service account created reads:

    ```
    summary: [Sala Nera] 11am · 520 Cashmere Drive, garland texas test
    start:   { date: 2026-10-05 }
    end:     { date: 2026-10-06 }
    ```

    `date` rather than `dateTime` is what makes it all-day, and Google's
    exclusive end date means one day with no bleed. Google omits
    `transparency` from the API response when an event is opaque, and the
    event editor showed Busy. Spiro then offered no times at all on Oct 5 —
    including 5pm, the gap the old six-hour block left open — and
    salanera.com dropped all four of Oct 5's start times while leaving Oct 6
    and Oct 7 open. The hand-made Oct 15 test event has been deleted.
  - **It doesn't look all-day at a glance, and that's Google, not a bug.**
    Google never prints "All day" on the chip: in month view the event is a
    filled bar, in week and day view it sits in the thin strip above the
    hourly grid. Our title leading with "11am ·" makes it read like a timed
    appointment. Opening the event shows All day + Busy. Nick raised this on
    Sep 22 thinking the block had failed; it hadn't.
  - **Spiro reads our all-day event as a time-off request.** Booking Oct 5
    produced a Spiro email telling Nick that his employee (himself) had
    applied for time off. He is fine with the noise — "a redundant reminder
    of the Sala Nera booking." It is useful evidence: Spiro is not merely
    free/busy-aware of this calendar, it reads the events and classifies
    them. **The email is a notice, not an approval step** (Nick, Sep 22): it
    carries no approve or decline action. So the day Spiro takes off the
    market is not contingent on Nick acting on the mail, and there is no
    pending request that could lapse and quietly hand the day back. Nothing
    to do when one arrives.
  - **The reverse direction is settled too: Spiro writes its shoots onto this
    calendar** (checked Sep 22). Nick's BMG shoot on Wed Sep 23 is on it as a
    normal timed, busy event:

    ```
    Keith Redelsperger - 4840 Serenity Trail, McKinney, TX 75071
    Sep 23, 1:30 PM – 5:30 PM
    ```

    Spiro wrote it: the description holds the Gold Media Package, the order's
    questions and answers, and links to Spiro's photographer and admin
    portals. So a BMG shoot does reach the calendar `lib/availability.ts`
    reads, and salanera.com will not sell a day Nick is already shooting.
    With a 1:30–5:30pm block, all four start times fail the buffer check
    (8am guards 7am–3pm, 11am guards 10am–6pm; every one overlaps), so the
    whole day goes — before drive time is even considered.
    - **Not observed live end to end**, because Sep 23 is inside the 48-hour
      notice window and never appears in `/api/booking/availability`. What was
      checked is that the busy block exists on the calendar, and that the
      rules in `lib/scheduling.ts` reject all four starts against it.
    - **The one fragility:** the event's creator is
      `nblackhall@blackhallmediagroup.com`, not a Spiro service account — Spiro
      writes through Nick's connected Google account. If that integration is
      ever disconnected in Spiro, BMG shoots stop reaching this calendar and
      salanera.com starts selling days Nick is booked, silently. Worth
      re-checking if he ever reconnects or changes Google accounts in Spiro.
  - Thu Oct 8, which the site was blocking on Sep 22, turned out to be a
    doctor's appointment, so it proves the personal-hard-block rule live.
  - **A personal appointment costs the whole day**, confirmed live by Oct 8.
    With six hours plus an hour of buffer either side, anything busy between
    about 7am and 7pm overlaps all four start times. That is the hard-block
    rule Nick set (§3), not a bug, but it is blunter than it looks.
- **Which "Make changes" sharing tier** the service account has on the
  calendar was never visually confirmed. Any of them can write.
- **Bookings holding days** (Sep 22, end of day): the all-day test booking,
  `520 Cashmere Drive, garland texas test`, is confirmed and holds **Mon Oct
  5, 11am–5pm**. It is Nick's to cancel in /admin/bookings now that the
  all-day block is proven. The earlier row 5 on Thu Oct 1 was cancelled, and
  its calendar event went with it. Thu Oct 8 is blocked by a real ortho
  appointment of Nick's, not by us.

### 4.3 Agents reschedule or cancel their own booking
- **Where:** the listing's "Shoot booked" page (`ManageBooking.tsx`) has
  Reschedule (the booking form's `SlotPicker` in `purpose="reschedule"` mode)
  and Cancel booking. Inside 48h it tells them to email Nick.
- **Guards:** a move is one guarded UPDATE of the same row. The one-a-day
  index refuses a day someone else has. After that: the new calendar event is
  created, the old one deleted, and the listing's date updated.
- **Emails:** both Nick and the agent are emailed. Events are recorded as
  `client_rescheduled` and `client_cancelled`, or `change_email_failed`.
- **Limit:** a booking can't move to another time on the same day.
- **Proven live by Nick on Sep 22** with booking 4.

### 4.4 Sign-in, portal and admin access
- **Sign-in:** magic links with no passwords (`lib/session.ts`), 15 minutes,
  cookie `sn_portal`. The client sign-in is `/portal/login`, and the link
  brings the agent back to the listing (`safePortalPath()` allows only
  `/portal/<slug>`).
- **Admin sign-in:** `/admin/login` emails **only** addresses in
  `ADMIN_EMAILS`, which is just `nblackhall@blackhallmediagroup.com`. It gives
  the same reply for any address and silently sends nothing to a non-admin.
  That's by design, so nobody can probe which addresses exist.
- **Gatekeeping:** `requireAdmin()` redirects non-admins to `/admin/login`,
  and every admin page and action calls it first. A server action is a public
  POST endpoint, so the layout alone protects nothing.
- **Downloads:** every download goes through `authorizeListing()`
  (`lib/downloads.ts`), which checks team-aware ownership and the payment
  lock; admins don't bypass the lock. A listing someone may not see answers
  404, and a locked one they own answers 403.
- **Teams:** clients sharing a `team` slug see each other's listings.

### 4.5 Admin (`/admin`)
- **Pages:**
  - Listings, with a one-click lock toggle.
  - Clients (create, edit, delete).
  - Bookings (confirmed shoots, with a cancel that releases the day and
    deletes the listing if it's empty).
  - Activity (events, with plain-English reasons).
- **Listing page** (`/admin/listings/[id]`, `maxDuration = 300`):
  - **Delivery panel at the top** (`SendDelivery.tsx`):
    - Each zip's status: Not made yet / Being made / Ready · size / Couldn't
      be made.
    - **Prepare/Rebuild downloads.**
    - **Send preview email** while locked, **Send delivery email** once
      paid, with the send history.
  - **Details form.**
  - **Upload:** straight from the browser to R2 through a presigned PUT. The
    bucket's CORS allows PUT/GET from salanera.com and localhost:3000.
  - **Media grid:** set cover, delete (row first, then the bytes), drag to
    reorder (computed on drop, never live during the drag), and select
    several to drag as a group, with a drop-to-end zone.
  - **Download activity:** grouped as one line per download, e.g. "33 files
    at once".
  - **Delete listing,** which deletes its media files and zips too.
- **Smaller copies** (`lib/media-copies.ts`, `sharp`, made on the server after
  upload):
  - The copies: grid (1200px), large (2400px, also the low-res download), and
    high (only when the original is over 19 MB or not a JPEG).
  - They are auto-rotated and sRGB. Camera EXIF (including GPS) is replaced
    by `Copyright <year> Sala Nera`.
  - The **Make previews** notice appears only for photos without copies.
- **Video:** the browser reads its size and takes a still 1s in before upload
  (`probeVideo.ts`), because Vercel has no ffmpeg. The still becomes the
  video's copies.
- **Preston Hollow (listing 1) is seeded demo data:**
  - Its agent is `agent@briggsfreeman.com`, made up but on a real brokerage's
    domain. **Never send a delivery email on it.**
  - Its 10 photos are local `/demo/*.jpg` paths, not in R2, so zips can't be
    built for it.
  - Rockwall (listing 2) is the real test listing. Its agent is client 6,
    Nick's Gmail, `nickblackhall@gmail.com`.

### 4.6 Delivery page and downloads (`/portal/<slug>`)
- **The page:** a gallery with a header (cover, address, "Shot for"),
  uncropped tiles and a lightbox. Films play in our own player
  (`VideoPlayer.tsx`).
- **Locked:** watermarked previews, a watermark over the player, no downloads.
  **Unpaid galleries still stream the full video file** (a known gap, parked
  with the "protection strength" polish item).
- **Paid:** a **High res / Low res switch** (High is the default) applies to
  every download on the page.
  - **High** is the original, or `high_key` when there is one.
  - **Low** is the 2400px copy, saved as `<name>-low-res.jpg`.
  - `downloads.resolution` records what was actually delivered.
- **Download all photos** gives one zip per size. **Proven live on Sep 22** in
  Safari and in a clean Chrome window on Mac: High res was 332 MB (built in
  17s) and Low res 21 MB (built in 5s).
  - **Code:** `lib/zip.ts` is our own writer. It uses store mode with real
    CRCs in every header and no data descriptors, which makes it ZIP 2.0;
    ZIP64 kicks in only past 4 GB or 65,535 entries. `lib/archives.ts` is the
    logic, and the route is `app/api/portal/download/archive/route.ts`.
  - **Built from R2 back into R2** as **one streamed presigned PUT** of known
    length. R2 doesn't accept multipart uploads through presigned URLs, and a
    single PUT takes up to 4.995 GiB; above 5 GB a build refuses. The upload
    is all-or-nothing, so there's nothing to abort.
  - **Versioning:** each zip carries a fingerprint of its entry names (which
    include the order) and source objects. Only a zip matching the listing's
    current photos is ever handed out.
  - **Changes that throw zips away:** upload, delete, reorder, or new copies
    delete out-of-date zips (`discardStaleArchives`). A film upload or
    film-only move doesn't.
  - **Locking:** a single-statement claim on a unique index means a zip
    builds once. The object key is unique per attempt
    (`archives/<slug>/<version>/<8-hex>/photos-<res>.zip`).
  - **When zips get built:**
    - Nick's ready email builds both first, reusing fresh ones.
    - Prepare/Rebuild builds without emailing.
    - A client's click on a missing zip builds it after the response
      (`after()`). The page polls, then shows a real "Download them now" link
      with no automatic click.
  - **After a failure:** a client can't retry for 10 minutes, and Nick is
    emailed at `NOTIFY_EMAIL`. Nick's button retries at once. A row stuck in
    "building" for over 6 minutes counts as dead.
  - **The download itself** is an ordinary same-origin link to
    `GET /api/portal/download/archive?slug=&res=`:
    - It re-authorises, logs the download (the per-photo `downloads` rows plus
      an `archive` event), then **302s to R2**. The link lasts `ARCHIVE_TTL`,
      1 hour.
    - A stale zip gets a 303 back to the gallery.
    - The POST only prepares and reports status, and logs nothing.
- **Films** download separately ("Download film · 127 MB") via
  `/api/portal/download/<id>`.
- **Single photos:** open one, then use "Download high/low res" at the bottom.
  This path is proven live.
- **Stage 2, not built:** Download Selected. The tick boxes are hidden in
  Stage 1. The agreed design:
  - One photo downloads directly.
  - Two or more become a **temporary zip** under a temp prefix, using the
    `archives.expires_at` column, which already exists, so no migration is
    needed. The app refuses links past `expires_at`.
  - An R2 lifecycle rule deletes that prefix after a day. Walk Nick through
    setting it in Cloudflare.
  - One build per identical selection, version and size.
  - `POST /api/portal/download` (one signed URL per file) still exists but
    nothing uses it.
- **On iPhone** a zip goes to Files, not Photos. That's a parked polish item.

### 4.7 Property website (`/p/<slug>` and `/p/<slug>/mls`)
- **Access:** public, for paid listings only. Anything else gives the same
  neutral 404. It is noindex.
- **Content:** it shows the smaller copies, signed for 24h (`PUBLIC_TTL`),
  films first, with panoramas spanning the page. The branded page ends with
  the agent's contact details.
- **The MLS version has no agent, brokerage or photographer anywhere a viewer
  can see.** `check-property-site` scans the HTML for leaks.
- **Links to it** appear on the delivery page (View / Copy link / Copy MLS
  link) and on the admin listing page.
- **Known limits:**
  - The MLS link still says salanera.com. A neutral domain could point at the
    same pages if an MLS objects.
  - The page source contains Next's root not-found template bits, which
    viewers can't see.

### 4.8 Telemetry
- **`record()` in `lib/telemetry.ts`:** writes a console line first, then an
  `events` row. It never throws. The table has no foreign keys, on purpose.
- **Outcomes:** `ok`, `discarded` (read these first), `rejected`, `failed`.
  Reason labels live in both `app/admin/activity/page.tsx` and
  `scripts/activity.mjs`; keep them in step.
- **Zip events:**
  - `archive`: a zip link was handed out.
  - `archive_built`: its detail includes size and build seconds.
  - `archive_failed`.
- **Not logged:** the sign-in route doesn't record events, so use the Vercel
  logs or Resend's sent list for those.

---

## 5. Open items and known gaps

**Nick's decisions or tasks:**
- Real rates and terms (placeholders). Sala Nera's own rates don't exist
  yet and aren't the Spiro ones; see §1.
- Stripe, parked. The invoice button is hidden, and payment is arranged with
  Nick, who unlocks the listing.
- **The privacy page is out of date.** It mentions only inquiries, Vercel and
  Resend, not saved bookings, client accounts, Neon or R2. The wording is his
  call.
- **Delete the dead GitHub branches.** Auto mode blocks me from doing it.
  They're safe to delete: merged, or preserved as the tag
  `archive/launch-readiness`. Nick runs:
  `git push origin --delete portal-build nextjs-portal-foundation launch-readiness`
  then `git remote prune origin`. `MIGRATE_TOKEN` is now in Production, so the
  old worry about losing it with `portal-build` is gone.
- **A test-data clean-out, at launch, in one pass.** Nothing costs anything
  while it sits there, so this is a launch task, not a running chore — and
  `npm run db:seed` would put Preston Hollow straight back. On Sep 22 the
  leftovers were: listing 1 (Preston Hollow, seeded demo, fake agent
  `agent@briggsfreeman.com` on a real brokerage domain), client 5
  (`kvuenick@gmail.com`, no listings), and bookings 1–4 (one old request, three
  cancelled). **Keep listing 2, Rockwall**: it is the real test property, with
  32 photos and the film, and the outstanding tests need it. Note there is no
  Delete for a booking, only Cancel, so clearing those rows means hand-editing
  production.
- Which Chrome extension blocks his downloads. His to find, if he wants.
- **The Hobby plan:** needs Pro before commercial use. He knows.

**Built pieces still missing:**
- **Zip Stage 2** (Download Selected), described in §4.6.
- **A rate card editor** (`/admin/rates`). Only the table, loader and
  validator exist. A sketch and the `rates.md` question are in the old
  handoff. Recommended: render the rates document from the live card on
  request, rather than committing a generated file.
- **Video:**
  - Tiles show no running time; that needs a column.
  - The gallery bar says "N images" even when some are films.
  - Older videos without a still have no catch-up.

**Small known limits:**
- **Bookings:**
  - An address without a comma between street and city ends up with no
    city; Nick tidies it by hand.
  - Creating a listing by hand for a booked shoot makes a duplicate.
  - A reschedule can't move to a different time on the same day.
- **Admin on a phone:** the nav overflows ~26px at 390px, and the listings
  table scrolls sideways. Nick works on desktop.
- **Drag to reorder:** long drags that need the page to auto-scroll are
  unproven. Playwright's `dragTo()` can't scroll mid-drag, and silently does
  nothing if the target is off-screen. If they're painful, try a "send to
  front" button first.
- **Unbounded or unchecked:**
  - No rate limiting on the booking form.
  - The `events` table grows forever.
  - There's no lint toolchain; `npm run typecheck` is the check.
- **Housekeeping:**
  - `BASE_LOCATION` is downtown Dallas.
  - Some brand files have spaces in their names, e.g.
    `sala nera logo cropped dark.svg`. Rename them all at once with every
    reference, if ever.

---

## 6. Accounts and credentials

| What | Where | Notes |
|---|---|---|
| Vercel | team `bmg11`, project `sala-nera` | The CLI is logged in here. Env vars live in Production. |
| Neon (Postgres) | `DATABASE_URL` | The same database locally (`.env.local`) and live. |
| Resend (email) | `RESEND_API_KEY`, `FROM_EMAIL`, `NOTIFY_EMAIL` | The real key is in `.env.local` too, so local servers send real email. |
| Cloudflare R2 | `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Production only; **not in this workspace**. A private bucket. The token is Object Read & Write, this bucket only, with no IP filter. |
| Google Maps | `GOOGLE_MAPS_API_KEY` | Geocoding only; API-restricted, no application restriction. |
| Google Calendar | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `…_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID` | Production only, Secret. Account `sala-nera-scheduler` in GCP project `sala-nera`. |
| Auth | `AUTH_SECRET`, `ADMIN_EMAILS`, `PORTAL_URL`, `MIGRATE_TOKEN` | `PORTAL_URL` is `http://localhost:3000` locally. |

**R2 details:**
- The CORS policy on the bucket must allow `content-type` as a header, or
  uploads fail their preflight:
  `[{"AllowedOrigins":["https://salanera.com","http://localhost:3000"],"AllowedMethods":["PUT","GET"],"AllowedHeaders":["content-type"],"MaxAgeSeconds":3600}]`.
- The site's CSP in `next.config.mjs` must name the R2 host in `img-src`,
  `media-src` and `connect-src`. It does, built from `R2_ACCOUNT_ID`, and a
  new value needs a redeploy.
- **Both of these fail silently in the browser**, which looks exactly like a
  bad key. Read the CSP header before blaming Cloudflare:
  `curl -sD - -o /dev/null https://salanera.com/book | grep -i content-security`.
- A 403 from R2 is never the signature. `lib/sigv4.ts` matches AWS's reference
  vector (`check:sigv4`). Suspect the account id, bucket name or token scope.
- Secret-type Vercel vars are available at build time; the CSP proves it.

**Google Cloud gotchas, for any future service account under this Workspace:**
- New projects block key downloads. Override the **legacy** org policy
  `iam.disableServiceAccountKeyCreation` ("Managed (Legacy)"), not its
  look-alikes, for the `sala-nera` project. That needs the Organization Policy
  Administrator role.
- Workspace blocks "Make changes" calendar sharing with outside accounts,
  and a service account counts as outside. The fix is in admin.google.com →
  Calendar → Sharing → "External sharing options for secondary calendars" →
  "…and outsiders can change calendars".
- **Credential files:** Nick drops them into `reference/` (gitignored). Read
  them directly and pipe the values into `vercel env add` via temp files.
  Never print them or ask him to paste a key. Leave the file there for the
  length of the work rather than deleting and re-requesting it each time, and
  delete it when done. The calendar key isn't in the workspace now.

---

## 7. Gotchas that cost real time

**Images and layout:**
- **The `<img>` width/height trap.** Width and height attributes are hints
  for *both* dimensions. CSS that sets only `width` leaves the height hint in
  place: the logo became a 96×1070 sliver that looked like empty header. Any
  rule setting an image's width must also set `height: auto`.
- **`.admin-muted` sets `display:block`.** On a `<td>` it silently breaks
  table layout, so use `.ev-dim` in tables. (A guard,
  `.admin-table td.admin-muted`, exists.)
- **Brand colours:** `--oxblood` (#770606) is for fills only, because it fails
  contrast as text. `--ember` (#D4552F) is the text and focus accent (4.72:1,
  which passes AA).

**Server code:**
- **`NextResponse.redirect()` refuses relative URLs**, throwing a 500 only on
  the path that redirects. Resolve against `request.url` first.
- **Anti-spam rules that discard silently** show a success screen while
  sending nothing (§4.1). Never trust the success screen as proof anything
  sent.

**Forms:**
- **A button that switches `type` between renders submits the form.** The
  booking form's Continue → Send button uses distinct `key`s, and `submit()`
  refuses to send before the last step. Keep both.

**Storage and ordering:**
- **Delete rows before bytes**, for photos and listings alike. The worst case
  is then an orphaned object nothing links to, never a gallery tile pointing
  at nothing.
- Read a listing's media and zip keys **before** deleting the listing: its
  rows cascade.
- `max(sort)` comes back as a number, but `count()` comes back as a string
  from Neon. See `nextMediaSort`.

**Environment:**
- `.env.local` is a snapshot pulled from Vercel, not a live link. If local
  behaviour disagrees with production, re-pull before suspecting the code.
- **Downloads and cross-origin R2 links:** the `download` attribute is ignored
  cross-origin, but Chrome still downloads an R2 URL that carries
  `Content-Disposition: attachment`. This was tested on Sep 22. The zip button
  now uses a same-origin link that 302s to R2 anyway, like every other
  download.
