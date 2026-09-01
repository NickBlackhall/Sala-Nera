# Sala Nera

Static site for the Sala Nera collection (Blackhall Media Group), deployed on Vercel.
No framework, no build step. One HTML file per page plus one serverless function
for the lead form.

```
index.html          the site
films.html          served at /films  (PLACEHOLDER — replace with the real films page)
brand/              logo assets (mark only so far — lockups pending the wordmark font)
api/inquiry.js      lead form handler → emails via Resend
vercel.json         clean URLs, cache headers, security headers
media/              hero video, poster, collection stills
og-sala-nera.jpg    1200×630 link preview image  (TODO: add)
favicon.svg
```

---

## 1. Deploy

**Recommended — connect a git repo:**

1. Push this folder to a GitHub repo.
2. Vercel → Add New → Project → Import that repo.
3. Framework Preset: **Other**. No build command, no output directory.
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

Then find-and-replace `https://salanera.com` throughout `index.html`, `films.html`,
`robots.txt`, and `sitemap.xml` with your real domain.

---

## Content still to add

- [ ] **Hero video** — 20s loop, under 5 MB, as `media/sala-nera-hero.mp4`
      (plus `.webm` if you can export one — ~30% smaller and browsers prefer it).
      HandBrake, "Fast 1080p30" preset.
- [ ] **Hero poster** — a still of the first frame as `media/hero-poster.jpg` (~150 KB).
      This is what phones and reduced-motion users see; the video never loads for them.
- [ ] **Collection grid** — REMOVED for launch (no finished property sets yet). When you
      have 2–3, it goes back as a row of larger cards. Ask and it's a ten-minute edit.
- [ ] **OG image** — `og-sala-nera.jpg` at exactly 1200×630. This is the link preview
      when you text the site to an agent.
- [ ] **Client list** — the `.proof-row` list, relabelled "Past clients include".
      Only names you have actually shot for.
- [ ] **Testimonial** — a real name and brokerage, or delete the section.
- [ ] **Phone number** — currently the `(214) 555-0000` placeholder in two places.
- [ ] **Films page** — rename your real `sala_nera_films.html` to `films.html`,
      replacing the placeholder.

Every one of these is marked with a `TODO` comment in the source.

---

## Notes for whoever edits this next

- `--oxblood` (#6F0F01) is for **fills only** — it fails contrast badly as text.
  `--ember` (#D4552F) is the text and focus accent, measured at 4.72:1 on the ink
  background, which clears WCAG AA. Don't use oxblood for type.
- The hero video is injected by JS and only on screens above 640px, and never when
  the visitor has reduced motion enabled. Phones get the poster image.
- All anchored sections use `scroll-margin-top` so the fixed nav doesn't cover
  headings when you jump to them.


---

## Brand assets (`brand/`)

Generated from the same geometry as the site's mark, so they can't drift from it.

| file | use |
|---|---|
| `mark-light.svg` / `-512.png` / `-1024.png` | dark backgrounds — the site, dark decks, film slates |
| `mark-dark.svg` / `-512.png` / `-1024.png` | **light backgrounds** — email signatures, invoices, white listing decks, print |

The dark-background-only logo you had would vanish on anything white; `mark-dark` is that gap closed.

**Still to come:** the horizontal and vertical lockups (mark + "SALA NERA"). Those need the
wordmark's typeface, weight and tracking from the original Photoshop file — without them the
letterspacing would be a guess rather than your design.
