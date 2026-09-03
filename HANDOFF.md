# Sala Nera — Handoff (written by Claude, previous session)

Written because the previous session was near its usage limit. Read this
before doing anything else — it resolves a scare from that session that
turned out to be a false alarm, and lays out the one real task remaining.

## The site in one paragraph

Sala Nera is Nick Blackhall's cinematic real-estate media brand (Blackhall
Media Group, Dallas–Fort Worth). The repo is
`github.com/NickBlackhall/Sala-Nera`. Two people have been building it in
parallel without coordinating: **Claude** (this session and its predecessors)
built a Next.js app with a client delivery portal underneath the marketing
site. **Codex**, working separately, kept iterating on the original static
HTML site with new copy, pages, and asset hardening. Nick's instruction,
given right before this session ran low: **use `launch-readiness` as the
visual/content source, port those changes into `nextjs-portal-foundation`.**
That port has not been started. It's the next job.

## First — a false alarm, resolved, don't repeat the panic

Partway through the previous session, `nextjs-portal-foundation` appeared to
have vanished from GitHub, and a screenshot Nick sent showed a site that
matched neither branch. This triggered a real scare about lost work.

**It was never lost.** `git branch -r` and `git fetch --prune` were not
showing branches created after the local clone's last fetch — a stale
remote-tracking list, not a deleted branch. Fetching each branch by exact
name (`git fetch origin <branch>:refs/remotes/origin/<branch>`) revealed all
three branches present and intact:

```
$ git ls-remote origin
2aeec09d...  refs/heads/main
ad936a4c...  refs/heads/launch-readiness
33fd95ef...  refs/heads/nextjs-portal-foundation
```

**If a branch seems to have disappeared, fetch it by exact name before
concluding it's gone.** `git branch -r` after a plain `git fetch` is not
proof of absence.

The screenshot mismatch is still unexplained — it showed different copy and
a different logo layout than either branch. Best guess: a stale browser tab
on an old Vercel preview URL, or output from a different tool entirely
(Nick has Higgsfield's website-builder connected via MCP, which could
plausibly account for it). Not investigated further; not blocking.

## Branch state, as of this handoff

| Branch | What it is | Architecture |
|---|---|---|
| `main` | Old snapshot, predates the Next.js port | Static HTML, no build step |
| `nextjs-portal-foundation` | Claude's work: Next.js port + client portal | Next.js 16, App Router |
| `launch-readiness` | Codex's work: newer copy, pages, hardening | Static HTML, no build step (same architecture as `main`, further evolved) |

**`main` is stale relative to both other branches** — don't treat it as
current. Vercel's Production Branch is currently pointed at
`nextjs-portal-foundation` (changed mid-session so there'd be something
live to look at); that's why the deployed site has Claude's Next.js content
and not Codex's newer copy. This is why Nick's screenshot review looked
"wrong" — he was comparing Codex's local/newer work against a deploy of an
older Claude branch.

## What's on `nextjs-portal-foundation` (Claude's work)

Converted the original static site to Next.js because the client-portal-
builder skill's security model requires a server — payment-locked downloads
need server-side ownership checks and server-minted signed URLs, which
static HTML cannot do. Converted rather than regenerated, so the existing
design decisions carried over.

- `app/page.tsx`, `app/films/page.tsx` — the marketing site, ported from the
  old `index.html`/`films.html`. Still prerender as static content.
- `app/components/Nav.tsx`, `HeroVideo.tsx`, `InquiryForm.tsx` — the old
  imperative DOM script, converted to client components. Same behavior:
  video sources inject only above 641px and never under reduced motion,
  mobile menu locks scroll and closes on Escape, form shows a real error
  with mailto fallback rather than ever claiming false success.
- `app/api/inquiry/route.ts` — the lead-form handler, ported from
  `api/inquiry.js`. Validation, honeypot, length caps, Resend call — see
  below for how this compares to Codex's hardened version.
- `app/globals.css` — the full stylesheet, moved verbatim (diffed
  line-by-line against the original at port time to confirm no drift).
- `lib/schema.ts` — five-table Drizzle/Postgres schema for the client
  portal: `clients`, `listings`, `media`, `invoices`, `downloads`. No media
  bytes stored here — only R2 keys, so a listing with a multi-GB film adds
  a few kilobytes to the database.
- `lib/demo.ts` + `app/portal/[slug]/page.tsx` + `app/components/Gallery.tsx`
  — a working client gallery running on demo data (`IS_DEMO = !process.env.
  DATABASE_URL`), so it can be reviewed with zero accounts created. Two demo
  listings: `/portal/preston-hollow-lane` (locked/unpaid — watermarked,
  no download buttons) and `/portal/rockwall-shores-drive` (paid — clean
  images, download buttons, selection checkboxes). Verified: the gate
  correctly flips every visible affordance between the two states.
  **This is only the UI half of the gate — no server-side enforcement
  exists yet.** Nothing here should be treated as protecting a real file
  until Neon + R2 + the ownership check land.
- `public/` — brand assets, demo images, the wired hero video
  (`sala-nera-hero.mp4`, confirmed via container parsing: H.264 Main L4.2,
  1920×1080, 22.79s, no audio track — never actually played in this sandbox
  since Playwright's Chromium here has no proprietary codecs).

A real regression was introduced and caught during the port: extracting CSS
pulled `films.html`'s unscoped `main{flex:1;display:flex}` into the global
stylesheet, collapsing `.hero` to zero width and blowing the mobile layout
out to 1168px. Fixed by scoping the films-specific rule to `.films-main`.
Verified old vs. new side by side under an iPhone 13 descriptor before
trusting the fix — a stale `next start` process nearly caused a second,
false "still broken" reading.

## What's on `launch-readiness` (Codex's work) — the port target

Stayed on the static-HTML architecture and pushed the content/asset layer
further:

**New copy** (`index.html`):
- Headline: *"For properties that stand apart."* (replaces *"Not every
  listing earns this."*)
- Subhead: *"Film and imagery shaped by architecture, atmosphere, and
  light."*
- Hero buttons: **"View the Collection"** (primary, → `/work.html`) and
  **"Begin a Conversation"** (outline, → `/contact.html`)

**New pages** — the site grew from 2 pages to 6:
- `work.html` — new, replaces the in-page `#collection` anchor
- `contact.html` — new, the inquiry form appears to have moved to its own
  page rather than living in a `#access` section on the home page
- `privacy.html` — new
- `404.html` — new, a real not-found page instead of Vercel's default

**Nav structure changed:** links now point at `/work.html` and
`/contact.html` as real pages, not `#work`/`#access` anchors. This is a
structural difference from what's on `nextjs-portal-foundation`, not just a
copy change — it affects the App Router layout (each becomes its own
`app/<name>/page.tsx`).

**Real media, properly named:**
- `media/hero-poster.jpg` — 167 KB, actually exists (on
  `nextjs-portal-foundation` this was still a TODO, so mobile/reduced-motion
  visitors saw a bare gradient)
- `media/sala-nera-hero-mobile.mp4` — a real, properly-named mobile variant
  (no spaces in the filename, unlike the placeholder file from earlier in
  the project that turned out to be 2 bytes of CRLF)

**A fuller favicon/icon set:** `favicon-32x32.png`, `apple-touch-icon.png`,
`icon-192.png`, `icon-512.png` — `nextjs-portal-foundation` only has
`favicon.svg`.

**"Use heavier web logo variant"** (commit `690430d`) — worth comparing
against whichever logo file `nextjs-portal-foundation` currently references
in the nav/hero/footer; may be a different weight/file than what's wired up
there now.

**Hardened `api/inquiry.js`** (commit `ad936a4`, "harden inquiry flow") —
genuinely good additions worth porting into `app/api/inquiry/route.ts`:
- Enforces `Content-Type` is `application/json` or
  `application/x-www-form-urlencoded`, rejects anything else with 415
- Rejects bodies over 12,000 bytes with 413
- Origin/Host check: if an `Origin` header is present, its host must match
  the request's `Host` header, or 403 — basic CSRF hardening
- **Time-based honeypot**: the client is expected to send a `startedAt`
  timestamp; if the form was submitted in under 1.8 seconds or the field is
  unreasonable, silently return 200 without sending — catches bots that
  fill and submit instantly, which the existing hidden-field honeypot alone
  doesn't
- `cleanInline()` strips control characters from single-line fields
  (name/phone/property) in addition to the existing trim+length-cap
- Adds an `Idempotency-Key` header on the Resend call, keyed off a
  client-supplied `requestId`, so a retried submission doesn't double-send

None of this exists yet on `nextjs-portal-foundation`'s `route.ts`. It's a
Node/Express-style handler (`module.exports = async (req, res) => {...}`),
so the logic needs adapting to `route.ts`'s `NextResponse` conventions, not
copied verbatim — but every check should carry over.

## The actual next task

Port `launch-readiness`'s content and hardening into
`nextjs-portal-foundation`'s Next.js structure. Not a `git merge` — the two
branches are different architectures (static HTML vs. App Router) built
from a shared ancestor, so a merge would produce broken output. This is a
manual, page-by-page port:

1. **Hero copy** — new headline/subhead/button labels into `app/page.tsx`
2. **New pages** — `work.html`, `contact.html`, `privacy.html`, `404.html`
   each become an `app/<name>/page.tsx` (or Next's built-in `app/not-found.
   tsx` for the 404). Decide whether the contact form move (page → its own
   route) is intentional and matches what Nick wants, since it changes the
   site's information architecture, not just its styling.
3. **Nav** — update `Nav.tsx` to link real routes instead of in-page anchors
4. **Media** — copy `hero-poster.jpg` and the mobile hero variant in, wire
   the poster into the CSS (currently a TODO on `nextjs-portal-foundation`),
   restore `data-webm`/mobile source handling if the mobile file is meant
   to be used (check: `HeroVideo.tsx` currently serves **no** video below
   641px by design — confirm whether the new mobile-specific file changes
   that intent or is meant for some other use)
5. **Favicons/icons** — add the fuller icon set, wire into `app/layout.tsx`
   metadata
6. **Logo variant** — compare `690430d`'s logo file against what's
   currently referenced; decide which is correct
7. **`api/inquiry/route.ts`** — port every hardening check listed above

After porting: rebuild, verify locally (the project has Playwright available
in past sessions' sandboxes — screenshot key states, check no regressions
the way the CSS-leak bug was caught last time), commit, push to
`nextjs-portal-foundation`, then a fresh Vercel deploy should show the
correct combined site.

## Portal work — status, unaffected by the above

The client-portal-builder skill's build order (steps 1 and 3 of its
sequence) is done and demo-tested; steps 2, 4–9 are not started. Genuinely
blocked on real accounts, not on more demo-data work:

- **Neon Postgres** — via Vercel's Marketplace integration once the Vercel
  project exists properly (it does now — `bmg/sala-nera` on Vercel, Hobby
  plan, upgrade to Pro deferred until Nick starts offering the portal to
  real clients, which is the right call)
- **Cloudflare R2** — for media storage. Chosen over Supabase Storage
  specifically because Supabase's free tier pauses projects after
  inactivity and requires manual restore, which is a bad failure mode for
  a client-facing gallery link. R2 has zero egress fees, which matters
  because clients download gigabytes.
- **Resend** — for both the lead form (already coded, needs
  `RESEND_API_KEY`/`NOTIFY_EMAIL`/`FROM_EMAIL` env vars in Vercel) and the
  portal's magic-link login (not yet built)
- **Stripe** — Nick confirmed he invoices through Stripe, so the full
  automation path applies: import existing clients from invoice history,
  `invoice.paid` webhook auto-unlocks downloads. Not started.

Do **not** create any of these accounts without Nick present — each is a
real signup with real implications (billing, DNS records for Resend, a
Stripe webhook touching his real invoicing).

## Things to know that aren't obvious from the code

- **`--` in filenames**: several brand/media files have literal spaces in
  their names (`"sala nera logo cropped dark.svg"`, `"sala nera hero reel 2
  mobile.mp4"` before it was fixed). This has caused real bugs before
  (percent-encoding issues, a shell quoting mistake). Both branches still
  have some of these — worth normalizing to hyphens during the port rather
  than propagating the spaces further.
- **The brand red is `#770606`**, confirmed against Nick's actual Illustrator
  export (`brand/mark-source.svg`), not `#6F0F01` which was an earlier
  guess baked into the original draft and briefly shipped before the
  correction.
- **`--ember:#D4552F`** is the text/focus accent (4.72:1 contrast on the ink
  background, passes WCAG AA) — never use `--oxblood`/`#770606` for text,
  it's ~2:1 and fails badly. This distinction exists because the original
  draft used one dark-red for everything, including body text, which was
  close to invisible.
- **This sandbox's Chromium (Playwright) has no H.264/proprietary codec
  support and no `next`/`vercel.app` network access** — video playback and
  live-deploy checks were verified by other means (container-format
  parsing for the video; asking Nick to check the live URL directly). Don't
  waste time re-discovering this; work around it the same way.
- **Vercel Hobby plan's terms don't cover commercial use** — Nick is aware
  and will upgrade `bmg` to Pro before going live with real clients, not
  before. Don't nag about this again unless he brings it up.

## Recommended first move in the new session

Read this file, confirm current branch state with `git ls-remote origin`
and `git fetch origin <branch>:refs/remotes/origin/<branch>` for all three
branches (don't trust a plain `git fetch --prune` alone), then start the
port from the top of the task list above. Confirm the contact-page/nav
restructuring with Nick before assuming it's wanted — it's a real
information-architecture change, not just styling, and worth one question
rather than a guess.
