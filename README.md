# Sala Nera

Next.js site for the Sala Nera collection (Blackhall Media Group), deployed on Vercel.
It includes the public marketing site, a Resend-backed inquiry endpoint, and the
client-portal foundation with demo galleries.

```
app/                    App Router pages, components, and API routes
app/portal/[slug]/      client gallery route (demo data until services are connected)
lib/                    portal demo data and database schema
public/brand/           official lockups and standalone mark assets
public/media/           responsive hero reels and poster
public/og-sala-nera.jpg 1200×630 link preview image
next.config.mjs         cache and security headers
```

---

## 1. Deploy

**Recommended — connect a git repo:**

1. Push this folder to a GitHub repo.
2. Vercel → Add New → Project → Import that repo.
3. Framework Preset: **Next.js**. The defaults are correct.
4. Deploy.

Every push to `main` then goes to production. Every push to any other branch gets
its own preview URL you can send to someone before it goes live.

**Quick look without git:** `npx vercel` for a preview, `npx vercel --prod` to promote.

> Vercel's Hobby tier is for personal projects. This is a commercial lead-gen site,
> so use **Pro** ($20/mo, which includes $20 of usage credit — it covers this site's
> bandwidth and function calls many times over).

## 2. Set up the lead form

The form posts to `/api/inquiry`, which sends you an email through Resend.

1. Create a free account at **resend.com**.
2. Add your sending domain and paste the three DNS records Resend gives you into
   your registrar. Wait for it to verify (usually minutes).
3. Create an API key.
4. In Vercel → Settings → Environment Variables, add all three:

   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | `re_...` from step 3 |
   | `NOTIFY_EMAIL` | `nick@blackhallmediagroup.com` |
   | `FROM_EMAIL` | `Sala Nera <inquiries@salanera.com>` |

   Set them for Production, Preview, and Development.
5. Redeploy (env vars only apply to new deployments).

**Test it both ways before launch:**
- Submit the form for real → the email should land in your inbox, and hitting Reply
  should address the agent, not yourself.
- Temporarily break `RESEND_API_KEY` in Vercel, redeploy, and submit again → you
  should see the red "email nick@… directly" message, **not** a success screen.
  Then restore the key. This is the path that matters; a silent failure loses leads.

Spam is handled by a hidden honeypot field. If you ever get flooded, Vercel's
firewall rules can add rate limiting on top.

## 3. Custom domain

Vercel → Settings → Domains → add the domain, then create the DNS record it prints
(`A` for an apex domain, `CNAME` for a subdomain). TLS is automatic.

Then update `https://salanera.com` in `app/layout.tsx`, `public/robots.txt`, and
`public/sitemap.xml` if the final domain differs.

---

## Content still to add

- [x] **Desktop hero video** — `public/media/sala-nera-hero.mp4` (1920x1080 H.264 Main,
      22.8s, 6.3 MB, no audio track). Replace that file to swap the clip.
- [x] **Mobile hero video** — `public/media/sala-nera-hero-mobile.mp4` (4.3 MB).
- [x] **Hero poster** — `public/media/hero-poster.jpg` (~167 KB), used before playback
      and whenever reduced-motion or data-saving settings suppress the reel.
- [ ] **Collection grid** — REMOVED for launch (no finished property sets yet). When you
      have 2–3, it goes back as a row of larger cards. Ask and it's a ten-minute edit.
- [x] **OG image** — `public/og-sala-nera.jpg` at exactly 1200×630. This is the link preview
      when you text the site to an agent.
- [ ] **Client list** — the `.proof-row` list, relabelled "Past clients include".
      Only names you have actually shot for.
- [ ] **Testimonial** — a real name and brokerage, or delete the section.
- [ ] **Films page** — replace the `/films` holding page when the first collection is ready.

The public work grid intentionally remains restrained until the first finished property sets exist.

---

## Notes for whoever edits this next

- `--oxblood` (#770606) is for **fills only** — it fails contrast badly as text.
  `--ember` (#D4552F) is the text and focus accent, measured at 4.72:1 on the ink
  background, which clears WCAG AA. Don't use oxblood for type.
- The hero component selects the 4.3 MB mobile reel at 640px and below. Reduced-motion,
  data-saving, and slow-connection visitors get the poster instead.
- All anchored sections use `scroll-margin-top` so the fixed nav doesn't cover
  headings when you jump to them.


---

## Brand assets (`brand/`)

Generated from the same geometry as the site's mark, so they can't drift from it.

| file | use |
|---|---|
| `mark-source.svg` | the original artwork, exactly as exported. Source of truth. |
| `mark.svg` / `mark-512.png` / `mark-1024.png` | dark backgrounds — site, dark decks, film slates |
| `mark-dark.svg` / `mark-dark-512.png` / `-1024.png` | **light backgrounds** — email signatures, invoices, white listing decks, print |
| `sala nera logo cropped dark.svg` | official full logo for dark backgrounds — used by the website |
| `sala nera logo cropped light.svg` | official full logo for light backgrounds |

The standalone mark variants are derived from `mark-source.svg`, so they cannot drift from it.
The two cropped files are the supplied official full-logo lockups.

**Brand values, taken from the artwork:**
- Mark aspect ratio **1.127:1** (six bars, second one filled)
- Red **#770606**
- Stroke **#FEFEFE**

Note the site's `--paper` is **#F4EFE6** (warm cream) while the artwork strokes are **#FEFEFE**
(neutral white). The site currently draws the mark in `--paper` so it matches the surrounding
type. Switching it to #FEFEFE would be more literally on-brand but slightly colder than
everything around it — an open call.

The website uses the heavier approved web lockup so the bar outlines remain legible at nav size.

The website uses the official dark-background full lockup directly. Keep both cropped SVGs
unchanged: their wordmarks are outlined, so they do not depend on a visitor having the source
typeface installed.

<!-- trigger: production branch is now nextjs-portal-foundation; this nudges Vercel to build it -->
