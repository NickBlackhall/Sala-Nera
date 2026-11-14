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

**State (Nov 14):** everything is committed, pushed and deployed; see the
Nov 14 update below for the latest changes. Before those, the last code change was `cd29ba4`, the Photos /
Aerials sections in admin's media grid (item 3c below), **proven live by Nick
and confirmed in the database**. Before it, `4bcb263`, the redesigned Details section, checked
live on Brookside and **approved by Nick ("much better")**. Migrations applied through `0013_listing_price`. Where the
gallery redesign stands and what is open: the Nov 12 update below, items 3–3c.
(Sep 22: the last change then, `05e3297`, the all-day calendar block, is
proven live end to end, §4.2.)

**Read `CLIENT-JOURNEY.md` next (written Nov 13).** It is the audit Nick
asked for: the whole client journey from order to payment as it works today,
every known problem with a proposed fix, what has never been tested for
real, and a suggested order of work. **It is the current to-do list**; the
"Next work" list further down is older and is folded into it. Nick has not
yet read it or picked from it. When he does, start from its "Suggested
order" (first: the Rockwall dollar test, which needs no building). `npx vercel ls` works under auto
mode — it was blocked in one earlier session, but it ran fine on Sep 22 and
showed Production Ready, so use it to confirm a deploy rather than only
serving salanera.com.

**Nov 14 update: small fixes and the privacy page, pushed live.**
- **Done from CLIENT-JOURNEY.md's step 2:** B2 (subject "Your shoot is booked
  — <address>" when a slot is held; "booking request" only on the fallback),
  B3 (Property details mentioned in the confirmation and ready emails), C1,
  C2. **None of the email wording has been sent for real yet**; the next test
  booking shows it.
- **C1 correction:** the audit was wrong that a request read "confirmed". It
  read a faint "<date> wanted". It now reads "needs a date" in red and sorts
  to the top of `/admin/bookings` (checked against production data, read-only:
  booking 1 is first). A cancelled request reads "cancelled".
- **C2, city from Google:** `geocodeAddress` now also returns `place`
  (town, state, `partial`), and `listingPlace` in `lib/booking-listing.ts`
  uses it for new booking listings: "600 N Brookside Dr Dallas TX 75214" →
  street "600 N Brookside Dr", city "Dallas, TX". The agent's own town wins
  when it differs; a town nobody typed is filled only from a full match.
  19 cases pass (`reference/check-listing-place.mjs`). **Not proven against
  real Google answers:** the Maps key in `.env.local` is a Development value
  Google rejects. Production's key works (travel-estimate answered live).
  Nick will try a no-comma test booking when convenient; expect "520
  Cashmere Drive" / "Garland, TX".
- **Privacy page rewritten** (`app/privacy/page.tsx`, A4) to cover bookings,
  accounts, media, invoices, property websites and every provider. It names
  no retention period; add one if Nick sets it.
- **Vercel Pro: Nick will upgrade once the brand launches and is being
  paid. Don't raise it before then.**
- **The check scripts listed in §2 are gone from this workspace** (`reference/`
  held only `pixieset/` on Nov 14). The list below describes what existed.
  A `server-only` import needs stubbing to run a check; see the header of
  `check-listing-place.mjs`.
- **Still open, in order:** the Rockwall dollar test (Nick), the pre-shoot
  reminder (B1), sign-in links in emails (B4, needs Nick's yes), then rates
  and Stripe.

**Nov 12 update (the rest of this file is as of Sep 22):**
- **A real sample listing exists: `n-brookside-drive`.** Nick uploaded a real
  client's photos (all horizontal), added that client (Peter) in admin, and
  sent him the link. It is the first time anyone but Nick has been given a
  Sala Nera link. He trusts these clients to give feedback, and says the
  whole site is still a preview, so **new design work is built straight on
  the live site** (checked locally in demo mode before each push).
- **Gallery redesign, modelled on a Pixieset gallery Nick likes. Dark look
  stays.** Agreed steps:
  1. **The look — done and live, `078ec6f`.** Full-screen cover in a thin
     frame with the mark, a lighter headline and an underlined "View gallery"
     link. On `/p/<slug>` a slim pinned bar (`PropertyBar.tsx`) with the
     address, Photos / Film / Contact tabs and Share. The client gallery's
     download bar gained the address. Thin gaps, and tiles fade in on scroll
     (`useReveal.ts`). The MLS version has the same layout with no mark, name
     or agent. Checked live on Brookside's public page at desktop and phone
     sizes. **Signed-in `/portal/n-brookside-drive` checked live by Nick,
     Nov 13: correct** (unlocked state; locked and booked still demo-only).
  2. **Tabs: Photos / Aerials / Film — done and live (Nov 12).** A photo
     whose filename starts `DJI_` is an aerial (`isAerial` in
     `lib/property-site.ts`; only a yes/no reaches the page). On `/p/<slug>`
     the aerials leave Nick's order and gather in their own section after
     the ground photos, with a tab each. The split only happens when a
     listing has both kinds. The lightbox runs through both sections. A run
     of one or two photos gets one or two columns, not three. The client
     gallery (`/portal/<slug>`) is not split. No database change.
  3. **Floor plans — built and live; migration `0011_floorplans_details`
     applied Nov 13, 15:27 UTC** (verified: `floorplans` table, the
     `listings` detail columns and `media.aerial` all exist; 0 plans).
     **Nov 13: first real upload proven on the property site.** Nick put
     three plans on Brookside (1st floor, 2nd floor, all floors; JPG
     4000×3000, no labels). All three rows have copies; `/p/n-brookside-drive`
     and `/mls` show the Floor plans tab and section, and the grid copies
     load. **Delivery-page Download proven Nov 13, 15:37 UTC:** Nick
     downloaded the 1st-floor plan from `/portal/n-brookside-drive`
     (unlocked); logged as `download:ok reason=floorplan` and in `events`.
     **Labels are automatic (Nov 13):** `labelFromFilename`
     (`lib/floorplan-label.ts`) names a plan from its filename ("1st_floor_…"
     → "First floor", "all_floors_…" → "All floors", plus basement, garage,
     guest house, casita, site plan, main/upper/lower), worked out when the
     page is shown, so nothing is stored. An ordinal only counts next to a
     floor word, so "100 1st Street" is ignored. A label Nick types wins. The
     admin box starts filled with the automatic name; saving it unchanged or
     blank stores null (stays automatic). No match → "Floor plan 2" as before.
     Brookside's three now read First floor / Second floor / All floors.
     Nick doesn't want to label plans by hand: keep it that way.
     **With and without dimensions:** Nick often delivers both versions,
     named `…_with_dim.jpg` and `…_without_dim.jpg` (`dimensionsFromFilename`).
     When a listing has the same floor twice, each gets "(with dimensions)" /
     "(no dimensions)"; a file that says neither takes the other kind of its
     twin. With one version the name stays plain. `floorplanTitle` now lives
     in `lib/floorplan-label.ts` and takes the whole plan list.
     Earlier note: **Not yet proven with a real upload** — this workspace can't reach the
     bucket's writes safely, so the first real JPG Nick uploads is the test:
     it should show a preview in admin, a Floor plan tab on `/p/<slug>` and
     `/mls`, and a Download on the delivery page.
     - **Their own table, `floorplans`** (`lib/floorplans.ts`), not media
       rows, so no photo query, zip, count or cover can pick one up. `0010`
       was an earlier media-row shape, replaced before anyone ran it.
     - **Admin:** a "Floor plans" section on the listing page
       (`app/admin/Floorplans.tsx`, `floorplan-actions.ts`). Several image
       files at once, a label per plan, delete. Copies are made in the same
       call as the upload, on white, with **no copyright notice written in**
       (`makePlanCopies`) because the MLS version shows them.
     - **Property website:** a Floor plan(s) tab and section on both
       versions (`PropertyPlans.tsx`), on a white sheet, click to enlarge.
       A plan with no label reads "Floor plan" / "Floor plan 2".
     - **Delivery page:** thumbnails with Download (the file as uploaded)
       through `/api/portal/download/floorplan`, behind the same
       `authorizeListing` gate. While locked it shows one line and no
       picture. Downloads are logged as events (`reason='floorplan'`), not
       in the `downloads` table.
     - **Nick's answers (Nov 12):** files are generally JPGs; all plans are
       unbranded for MLS, so all show on both versions; labels wanted, exact
       wording to be worked out; agents download from the delivery page, not
       the property site. **Assumed, not asked:** downloads sit behind
       payment like the photos.
     - Demo mode has two sample plans (`public/demo/floorplan-*.svg`).
  3b. **Details tab — built and live Nov 13** (migration `0012_school_district`
     applied 16:09 UTC). Nick's rule: **the agent controls the facts, Sala
     Nera controls the look**. No layout, cover or photo settings for agents;
     add one only if agents ask. No For sale / Sold status for now
     (Nick: later, if enough agents ask).
     - **Listing price (Nov 13, migration `0013_listing_price` applied
       16:44 UTC):** `listings.price`, whole dollars, optional, top of the
       form. Plain dollar amounts only ("$1,250,000" / "1250000"); Nick
       declined "1.25M"/"950k" shorthand. Shown on the branded site only:
       **left off the MLS version** (Nick), stripped before it reaches the
       page, like the agent.
     - **Live save proven Nov 13:** Nick saved Brookside's details (4 bd /
       4 ba / 3,500 sq ft, "Dallas", test description); they show on the
       delivery page and the property site.
     - **Presentation (Nov 13):** price · beds · baths · sq ft sit in one
       line of small caps under the address on the cover (`coverFacts` in
       `PropertyDetails.tsx`, `.pcover-facts`), fading up half a second after
       load (off for reduced motion). On phones the price takes its own line.
       Nick asked about a modal instead; I recommended against hiding the
       numbers behind a click. MLS: same line, no price.
     - **Details section redesigned (Nov 13; Nick: it looked generic,
       "very Claude").** A brochure spread in the homepage's editorial
       language: left-aligned "Details" kicker and the address as a display
       headline, beside the description (its first paragraph set larger as
       a lede). Below, a ruled spec table opened by a short oxblood rule
       (the mark's red bar): a figures row (Offered at, Bedrooms, Bathrooms,
       Interior) in large light type, then a quieter row (School district,
       Location = city + "View on map ↗"). Each row splits its width
       equally, so it is never half-filled. Phones: figures 2×2, the rest
       stacked. Styles: `.pdet*` in `globals.css`. Proven live on
       Brookside and approved by Nick, Nov 13.
     - Brookside's `city` was "DALLAS" (it shouted in the Location cell);
       Nick fixed it in admin Nov 13, now "Dallas". No code change.
     - **Delivery page proven live Nov 13 (Nick):** the new look, all 22
       photos in one grid, the Property details box with his saved values
       and Listing price first, and the three floor plans. Nothing open.
     - **Next, if Nick wants it:** the Details redesign is done; nothing
       else on the property site was asked for. **3c below (drag photos into Aerials in admin)
       is built and proven. Nothing on the gallery redesign is waiting to be
       built; item 4 (favourites, slideshow) only if Nick asks.**
     - **What Nick is checking on the delivery page** (told him Nov 13):
       the new look (address in the download bar, thin gaps, fade-in), the
       Property details box with his saved values and Listing price first
       (edit one, save, see the property site update), floor plans still
       showing.
     - Fields on `listings`: `beds`, `baths` (text), `sqft`, `school_district`,
       `description`, all optional (`lib/listing-details.ts`).
     - **Property site:** a Details section and tab after the photos, on both
       versions: beds / baths / sq ft in a row, school district, description,
       and a "View on map" link (a Google Maps search URL built from
       address + city; no embed, no key). Always present, because the map
       link always is; blank facts are left out.
     - **Who fills it in:** the agent on the delivery page ("Property
       details", any state: booked, locked or paid) and Nick in admin
       (Details section). One form, `app/components/DetailsForm.tsx`; the
       agent's action re-checks ownership like the page does. Last save wins.
     - **Order form unchanged** (instant booking stays short). Its square
       footage now starts the listing's `sqft` for new bookings
       (`ensureBookingListing`). Existing listings were not backfilled.
     - Demo mode: Rockwall has sample details.
  3c. **Aerials: drag between sections in admin — built, live and PROVEN
     Nov 13 (Nick's test, then my read-only check).** Problem it solves: on
     Brookside the two `DJI_` photos (media ids 67, 68) are eye-level shots
     of the patio and bocce court; Nick flies the drone low sometimes.
     - Admin's photo grid (`app/admin/MediaGrid.tsx`) is **two sections,
       Photos (with any film) and Aerials**. Dragging a photo, or a ticked
       group, across sets `media.aerial` true/false. No re-upload, no
       re-render: that was Nick's main point, so never make it a separate
       upload box. An empty section shows a permanent drop target.
     - `DJI_` filename is the first guess only (`media.aerial` null = go by
       filename); a drag stores Nick's call and it sticks. One rule,
       `isAerialPhoto` in `lib/media-arrange.ts`, used by the grid, the save
       and the property site. Videos are never aerials. `media.aerial` is in
       `lib/schema.ts` now (the column dates from 0011; no migration).
     - Save: `arrangeMediaAction` → `arrangeMedia` (`lib/admin-queries.ts`)
       takes the whole order plus the ids in Aerials, writes only what
       differs (so untouched photos stay null), and discards the zips only
       when the order changed. `reorderMediaAction` is gone.
     - Order: one running order as before; the delivery page shows it as
       **one grid, unsplit** (Nick: not public). A photo dropped on a tile
       lands before it; into an empty section it keeps its place.
     - **Mouse only; touch planned, not built** (Nick: edge case for now).
       Every drop goes through `place()` → `moveMedia` (pure, in
       `lib/media-arrange.ts`), free of drag events, so a pointer-event
       handler can call the same thing.
     - **Checked:** 16 cases of `moveMedia`/`isAerialPhoto`; the grid
       locally against the real database with every write blocked (Brookside
       shows Photos 16 / Aerials 2; a drop moved the tile at once, sent the
       action, and reverted with the error when it was cut off). The
       database write itself has not run.
     - **Proven live Nov 13:** Nick dragged the two eye-level DJI shots
       (67, 68) into Photos, uploaded four real aerials (ids 77–80,
       `DJI_…`), and tried the rearranging; he reports every function
       behaved as expected and the site shows them as expected. Database
       agrees: 67 and 68 have `aerial = false` and sit among the photos
       (sort 16 and 10); 77–80 have `aerial` null, so they are in Aerials by
       filename alone (sort 18–21); `IMG_8092` has an explicit `false` (a
       photo dragged in and back out, which is correct). Brookside now has
       22 media and its property site has the Aerials tab.
  4. **Favourites and slideshow** — parked.
- **Property site: no new features for now (Nick, Nov 13).** "It's on the
  verge of getting too busy as is." Don't propose additions to `/p/<slug>`
  (sections, tabs, widgets, favourites, slideshow) unless Nick raises them;
  fixes and polish to what's there are fine.
- **Parked: Nick is fine with both as they are (Nov 12).** Don't change
  either unless he raises it again:
  - The mark is faint over bright sky on Brookside's cover. If he wants it
    fixed: a soft shadow behind the mark (my pick, leaves the photo alone)
    or darken the top of the photo.
  - The cover photo is also the first tile in the grid, kept because a phone
    crops the cover to a tall slice. Could be dropped later.

**Waiting on Nick (his test, then my read-only check):**
1. **The first real invoice end to end** (§4.9). Migration 0009 is applied and
   verified (Sep 22, 20:38 UTC: right columns, the unique index, the legacy
   Stripe columns gone, 0 rows). What is untested is the feature itself. On
   Rockwall: add lines, paste a Stripe payment link, Save, Send invoice, then
   pay it and check Mark paid unlocks the downloads. **Rockwall is locked
   as of Nov 13 and has no invoice row, so it is ready for this as it
   stands** (CLIENT-JOURNEY.md A2, "the dollar test"). The only invoice row
   in production is Brookside's: zero lines, marked paid Nov 12, which is
   how Nick unlocked it. No invoice or preview email has ever been sent. Check read-only with `select lines, tax_rate_bp, payment_url,
   paid_at from invoices`.
2. **Download all photos on his phone.** Open Rockwall
   (`/portal/rockwall-shores-drive`) signed in as his Gmail and download both
   zips. On an iPhone they should land in Files and open as a folder of 32
   photos. Then check read-only:
   `select reason, detail, at from events where kind='download' order by at desc limit 5`.
3. **A horizontal film upload.** It should record about 1920×1080 and get a
   still (`grid_key`/`large_key` set). The only film so far is vertical (media
   56). Check: `select id, width, height, grid_key is not null from media where kind='video'`.
4. **A fresh photo upload that makes its own copies** without pressing Make
   previews. That proves new photos get copies, and the copyright notice, on
   their own; Rockwall's 32 existing copies predate the notice. The latest
   media id is 56, so anything above it is new.
   **Looks settled Nov 13:** every photo in production has its copies,
   including Brookside's 22 (ids 57–80, the last four uploaded Nov 13 and
   on the site minutes later). Not known: whether Nick ever pressed Make
   previews on Brookside. Ask if it matters.

**Client-journey audit, Nov 13 (`CLIENT-JOURNEY.md`). New since the list
below was written:**
- **Only one real person has used the site, and not through the front
  door.** Peter (Brookside) got a hand-made listing, a link Nick sent
  himself, and a mark-paid with an empty invoice. The order form → invoice →
  payment → delivery email path has only been walked by Nick with tests. The
  one delivery email ever sent was Rockwall's "ready", Sep 22, to Nick's
  Gmail.
- **Bug, found by reading, not yet fixed or shown to Nick on screen:**
  `/admin/bookings` labels every non-cancelled booking "confirmed"
  (`app/admin/bookings/page.tsx`, the status cell), so a fallback
  `requested` booking, which has no slot and still needs an answer, reads as
  settled. Booking 1 is one. Fix: label it "needs a date" and sort it first.
- **Nobody tells the agent the Property details box exists**: no email
  mentions it, and the property site it feeds only exists once paid.
- **Every email link lands on the sign-in screen** (two emails to see
  photos; link good 15 min, session 30 days). Proposed: a listing-scoped
  sign-in link inside the delivery/preview/invoice emails, good for a week.
  Needs Nick's yes: a forwarded email would open the gallery (downloads stay
  behind payment).
- **After payment the agent waits on Nick twice** (Mark paid, then Send
  delivery email). Proposed with Stripe stage 3: unlock on the webhook, and
  let the ready email send itself then. That bends his "I press the button"
  rule (§3), so it is his call.
- **Spam trap is working:** 23 honeypot discards on the contact form in 60
  days, about one a day, against 1 real inquiry. All read as bots.
- **Test data in production is now:** listing 1 (Preston Hollow), listing 7
  (Cashmere Drive, empty, locked, from booking 6), bookings 1–6 (1
  `requested`, 2–5 cancelled, **6 still `confirmed` for Oct 5, now past**),
  client 5 (no listings). Keep listing 2 (Rockwall) and listing 8
  (Brookside, real: client 10 is Peter).
- **Suggested order in the file:** dollar test → one session of small fixes
  (confirmation subject, Details mentions in emails, "needs a date", city
  from the geocoder) → pre-shoot reminder → sign-in links in emails → real
  rates/terms + order summary → Stripe stages 2–3 → launch housekeeping.
- The audit queries were read-only; nothing in production was changed.

**Next work (the Sep 22 list; see CLIENT-JOURNEY.md for the current one).
Nick picks the order:**
- **UI tweaks he wants to discuss**:
  - The download area, now the zips work.
  - The agent's reschedule/cancel screens. UI only; see the rule in §3.
  - The Low res label (a second agent suggested "Best for phone, web and social").
- **Client-journey gaps** (the payment dead end is closed — §4.9):
  1. **No reminder before the shoot.** A booking can be 60 days out and the
     agent hears nothing in between: no reminder, no prompt to confirm access.
     Nothing in the code sends one. This is the gap most likely to cost a real
     shoot day, and it is not blocked on anything. **Nick agreed gap 1 (the
     payment dead end) first, Sep 22; this was the other half of that
     recommendation.**
  2. **The agent can never see what they ordered** — fixed for anyone with an
     invoice (§4.9), still true for a listing that has none.
  3. **The confirmation email's subject says "booking request"** even when the
     slot is confirmed and the body says so. Instant booking is the selling
     point; the subject gives it away. It reads that way because one subject
     covers the fallback request path too. Make it conditional.
  4. **Real prices and terms.** Both are placeholders
     (`RATES_ARE_PLACEHOLDER`, `TERMS_ARE_PLACEHOLDER`). **Sala Nera's rates
     don't exist yet, and they are not the Spiro ones.** Nick's Spiro page
     (`book.blackhallmediagroup.com/order/bmg/residential`: Silver $250, Gold
     $400, Platinum $820) is Blackhall Media Group's volume-client pricing, a
     different business aimed at a different buyer. Sala Nera is the premium
     cinematic brand. Don't copy the Spiro numbers across, and don't start
     this until Nick says the rates exist (Sep 22: "not ready to do rates
     yet"). **Invoices unblock the money without it** (§4.9): a number Nick
     types per job is his real price, not a placeholder, so he can quote and
     collect on real shoots while the card catches up.
  5. **Stripe stages 2 and 3** — the app creating payment links, and a
     webhook that unlocks downloads on payment without Nick touching
     anything (§4.9). Stage 1 is live.

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
- (Nov 12: `.env.local` does appear to hold R2 settings now — a local server signed bucket URLs and showed the upload button. Not tested further; treat a prod-backed local server as able to reach the real bucket.)
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
  `0001`–`0009` and `0011` (`0011_floorplans_details` on Nov 13; `0010` was
  never run, it was replaced by 0011).
- **`AUTH_SECRET` is also the Development value since the Nov 12 pull**, so
  a minted admin cookie no longer works on salanera.com (307 to login).
  Signed-in live checks need Nick, unless the production secret is put back
  in `.env.local`. Don't rotate the production secret to fix this: that
  signs everyone out and kills outstanding login links.
- **`MIGRATE_TOKEN` gotcha.** `vercel env pull` rewrites `.env.local` with
  the *Development* values, and Production's token is a hidden secret that
  can't be pulled, so after a pull the one-liner returns "Unauthorized".
  That happened on Nov 12. Fixed Nov 13: a new random token was put in
  Production and in `.env.local`, then a redeploy. If it recurs, do the same
  thing again: `vercel env rm MIGRATE_TOKEN --environment production
  --confirm-name MIGRATE_TOKEN`, `vercel env add MIGRATE_TOKEN production
  --sensitive` (piped from `.env.local`), `vercel redeploy <latest prod url>
  --target production`. Ask Nick first, because it changes a live setting.
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
  - **Invoice editor** (`InvoiceEditor.tsx`), under the delivery panel — see
    §4.9. Editable lines, tax, payment link, Mark paid, Send invoice.
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
- **Locked:** watermarked previews **on the grid and in the lightbox**, a
  watermark over the player, no downloads — and, when there is one, the
  invoice above the photos with what is owed and a Pay button (§4.9).
  - The lightbox watermark was missing until Sep 22: the grid was protected
    and opening a photo showed it clean at 2400px. A film was always covered,
    through the player, so photos fell between the two cases.
  - **It is cream at 50% with a hard dark shadow**, chosen by Nick on Sep 22
    over a darker, prettier wordmark. The shadow is the point: a pale mark on
    a white-walled interior and a dark mark on a twilight exterior each vanish
    on half his work, and twilight is something he sells. The grid tiles are
    still the older, fainter treatment — match them if he asks.
  - Still an **overlay, not baked into the pixels**; see the parked
    protection-strength item. **Unpaid galleries still stream the full video file**
  (a known gap, parked with the "protection strength" polish item).
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
- **Stage 2, not built, and parked** (Nick, Sep 22): "lets hold off on stage 2
  for now — possibly in the polish pass." With Stage 1 live, selecting a
  subset is convenience only, so don't build it unprompted. Download Selected.
  The tick boxes are hidden in Stage 1. The agreed design:
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

### 4.9 Invoices and payment
- **The invoice is Nick's document, not a copy of Stripe's.** One per listing
  (`invoices`, migration 0009). He edits the lines, the tax rate, a note and a
  payment link; the client sees the result in the portal and by email. The
  table it replaced was keyed on `stripe_invoice_id` and held only what Stripe
  reported, which can't answer "add the twilight shoot we agreed on site".
- **The booking is never edited.** A new invoice seeds from the booking that
  made the listing, then goes its own way. What someone asked for
  (`bookings.lines`) and what they were billed (`invoices.lines`) stay separate
  facts — the same reason `desired_date` survives next to `starts_at`.
  - **While rates are placeholders it seeds names with zero amounts**, using
    the booking's own `rates_are_placeholder`. Copying 999s across would put
    Nick one missed edit from billing someone $999 for a floor plan.
- **Money is cents here**, not the whole dollars `lib/quote.ts` uses: 8.25% of
  $999 is $82.42. The arithmetic is in `lib/invoice-math.ts`, which has **no
  server imports**, so the editor, the portal and the email all total the same
  way rather than three ways.
- **Tax:** a per-invoice rate in basis points, defaulting to **825 (8.25%)** —
  6.25% Texas state plus 2% local, confirmed by Nick on Sep 22. Zero it for an
  exempt client. Tax is taken on the subtotal as a whole, so a discount (a
  negative line) reduces the tax with it. Per-line exemptions are not built.
- **The editor** is `InvoiceEditor.tsx` on `/admin/listings/[id]`, under the
  delivery panel. Totals update as he types. Three separate actions:
  - **Save** — lines, tax, note, payment link. Never touches paid.
  - **Mark paid** — records the payment **and unlocks the downloads in one
    action**, because remembering to do both is what a person forgets on a
    Friday. `listings.download_locked` is still the gate every download path
    reads; the lock is written **first**, so a half-failure leaves a client able
    to download what they paid for rather than the reverse.
  - **Send invoice / Send updated invoice** — nothing reaches the client until
    it is pressed, the same rule as the delivery emails. History shares the
    `delivery_emails` table, kind `'invoice'`.
- **What the client sees** (`app/portal/[slug]/Invoice.tsx`), the same document
  answering three questions:
  - Before the shoot: **"Your order"** — what they booked and what it costs.
  - On a locked gallery: **"Amount due"**, above the photos, with a Pay button.
  - Once paid: **"Your invoice"**, below the photos, marked Paid. **A paid
    invoice never renders a Pay button** — that is how people pay twice.
- **An invoice with no priced lines is treated as absent** (`invoiceIsReady`).
  Showing an agent "$0.00 due" reads as a promise and is worse than silence.
  A deliberately comped job is caught by the same rule and shows nothing.
- **The preview email carries the money.** It names the total and links to
  payment. The ready email does not: by then they have paid.
- **Stripe, in three stages.** Nick has an account (Sep 22).
  1. **Live now:** he makes a payment link in Stripe's dashboard and pastes it
     onto the invoice.
  2. **Not built:** the app creates the link from the invoice lines.
  3. **Not built, and the real prize:** a webhook marks the invoice paid and
     unlocks the downloads with nobody pressing anything.
  `clients.stripe_customer_id` and `invoices.stripe_invoice_id` exist unused,
  for stages 2 and 3.
- **The code is safe to deploy before migration 0009 is run.** `getInvoice()`
  answers null on Postgres `42P01`/`42703` only, so the window where the code
  is newer than the database costs the invoice, not the listing page. Verified
  against production on Sep 22. Any other database error is re-thrown.

---

## 5. Open items and known gaps

**Nick's decisions or tasks:**
- Real rates and terms (placeholders). Sala Nera's own rates don't exist
  yet and aren't the Spiro ones; see §1.
- **Stripe stage 1 is live** (§4.9): Nick pastes a payment link onto an
  invoice and the client gets a Pay button. Stages 2 and 3 — the app creating
  the link, and a webhook that unlocks downloads on payment — are not built,
  and need his Stripe keys in Vercel.
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
  validator exist. Less urgent since invoices (§4.9): Nick can charge real
  money per job without it. A sketch and the `rates.md` question are in the old
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
