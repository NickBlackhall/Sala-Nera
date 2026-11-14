# Sala Nera: the client journey, audited

Written Nov 13, 2026, from the code and the live database as they stand that
day. It follows one agent from ordering a shoot to downloading their media and
paying, then lists what gets in their way, or yours, and how to fix each.

## The short version

**The delivery half is solid. The money half works but runs on you.**

- Booking, the calendar, uploads, the gallery, downloads, floor plans and the
  property website are all built, and most are proven live.
- Four things stand between this and taking real paying clients:
  1. There are no real prices or terms. The order form shows placeholders.
  2. Getting paid has never been run end to end with real money.
  3. After a client pays, nothing happens until you notice and press two
     buttons.
  4. The hosting plan and the privacy page aren't ready for commercial use.
- Everything else on the list below is friction, not a blocker.

Only one real person has been through any of it: Peter, on 600 N Brookside
Drive. He came in the side door. You made his listing by hand, sent him the
link yourself, and marked it paid without an invoice. So the front door
(order form → invoice → payment → delivery email) has only ever been walked
by you, with test bookings.

---

## The journey as it works today

### 1. Ordering (`salanera.com/book`)

**What the agent does:** fills in seven steps: Contact, Property, Details,
Services, Notes, Agreement, Review. They pick a real open slot from your
calendar: Monday to Thursday, starting at 8, 9, 10 or 11am, at least 48 hours
ahead and up to 60 days out.

**What happens behind it, instantly:**
- The slot is claimed. One Sala Nera shoot per day; the database refuses a
  second.
- Your calendar gets an all-day block, so Spiro can't sell the same day.
- A client account is made for the agent, and a locked listing for the
  property.
- You get a lead email. The agent gets a confirmation with their shoot time
  and a link to their page.

**If the calendar can't be read,** the form falls back to "request a date",
and you confirm by hand.

**Status:** proven live with your test bookings. Reschedule and cancel too.

### 2. Between booking and the shoot

**What the agent can do:** sign in to their page (an emailed link, no
password). It says "Shoot booked" with the date and time. They can reschedule
or cancel up to 48 hours before, and fill in Property details (price, beds,
baths, square feet, school district, description).

**What you do:** nothing is required.

**Status:** proven live. The Details box is proven on a delivered listing,
not on a booked one.

### 3. After the shoot: upload and bill

**What you do, in admin:**
1. Upload photos, films and floor plans. Smaller copies are made on their own.
2. Arrange: drag into order, drag aerials into their section, pick the cover.
3. Fill in the invoice: lines, tax (8.25% by default), a note.
4. Make a payment link in Stripe's dashboard and paste it onto the invoice.
5. Press **Send preview email**. It tells the agent their photos are ready to
   preview, names the total and carries the Pay link.

**Status:** uploading and arranging are proven live. The invoice and preview
email have never been used on a real job.

### 4. The agent previews and pays

**What the agent sees:** their gallery with watermarks, no downloads, and
"Amount due" above the photos with a Pay button that goes to Stripe.

**Status:** built and tested with sample data only.

### 5. Unlocking and delivery

**What you do:**
1. Notice the Stripe payment (Stripe emails you).
2. Press **Mark paid**. That records it and unlocks the downloads.
3. Press **Send delivery email**. It builds the two zips first, then sends
   the agent their gallery link, the property website link and the MLS link.

**Status:** Mark paid and the zips are proven live. The delivery email was
sent once, in September, to your own Gmail.

### 6. The agent downloads and shares

**What the agent gets:**
- **Download all photos** as one zip, High res or Low res.
- Single photos, films and floor plans, one at a time.
- A **property website** to share with buyers, and an unbranded twin for the
  MLS. Both exist only once the listing is paid.
- The Property details box, which feeds that website.

**Status:** proven live on Brookside and Rockwall, on a computer.

### 7. Afterwards

Nothing. No thank-you, no request for a review, no nudge to book the next
listing.

---

## Problems and solutions

Sized roughly: **Small** is under an hour of building, **Medium** a session,
**Large** more than one. "Needs you" means I can't start without something
from you.

### A. Must fix before real paying clients

**A1. There are no real prices or terms.**
- *Problem:* every price on the order form is a placeholder, flagged as one.
  The agreement text is a placeholder too. An agent books a day without
  knowing what it costs, and signs terms that aren't yours.
- *Solution:* your real rate card and your real terms go in, and two switches
  flip. Then the form, the confirmation email and the invoice all show real
  numbers on their own.
- *Until then:* invoices already let you type a real price per job, so you
  can quote and collect by hand.
- *Size:* Small once the numbers exist. **Needs you:** the rates and the
  terms.

**A2. Payment has never been run with real money.**
- *Problem:* the only "paid" listing, Brookside, was marked paid with an
  empty invoice. No invoice has been sent to anyone, no Pay button has been
  clicked on the live site, and no payment has unlocked a gallery.
- *Solution:* one ten-minute test on Rockwall, which is locked right now and
  so is ready for it. Add a line for a dollar, paste a Stripe link, Save,
  Send invoice, pay it, press Mark paid, check the downloads unlock.
- *Size:* no building. **Needs you:** ten minutes.

**A3. After a client pays, the gallery stays locked until you act.**
- *Problem:* three steps depend on you. You make the Stripe link by hand and
  its amount has to match the invoice by hand. Then, when the client pays,
  nothing happens until you see Stripe's email, press Mark paid and press
  Send delivery email. An agent who pays at 9pm waits for you, looking at a
  locked gallery they've paid for. A mistyped link amount bills the wrong sum.
- *Solution:* the two unbuilt Stripe stages. The app makes the payment link
  from the invoice, so the amounts can't differ. Stripe then tells the app
  the moment it's paid, and the gallery unlocks itself.
- *Your call:* whether the delivery email also sends itself at that moment.
  Your rule is that you press the button. Here you'd already have checked
  the photos before sending the preview, so I'd let it send.
- *Size:* Large. **Needs you:** Stripe keys added to Vercel.

**A4. The hosting plan and privacy page aren't ready for business.**
- *Problem:* Vercel's Hobby plan is for non-commercial use. The privacy page
  doesn't mention saved bookings, client accounts or stored media.
- *Solution:* upgrade to Pro; rewrite the privacy page to match what the
  site stores.
- *Size:* Small. **Needs you:** the upgrade, and a yes on the wording.

### B. Friction for the agent

**B1. No reminder before the shoot.**
- *Problem:* a shoot can be booked 60 days out and the agent hears nothing
  until you arrive. No reminder, nothing about access, lockbox codes or
  getting the house ready. This is the gap most likely to cost a shoot day.
- *Solution:* an automatic email two or three days before, with the time, a
  short prep list and the reschedule link. It's sent before the 48-hour
  cutoff on purpose, so they can still move it themselves.
- *Size:* Medium. Needs nothing from you but the prep list wording.

**B2. The confirmation email's subject says "request" when it's confirmed.**
- *Problem:* the subject is "We've got your booking request" even when the
  slot is locked in and the email body says so. Instant booking is the
  selling point and the subject undersells it.
- *Solution:* "Your shoot is booked" when confirmed; keep "request" for the
  fallback path.
- *Size:* Small.

**B3. Nobody tells the agent the Property details box exists.**
- *Problem:* the box sits at the bottom of their page. No email mentions it.
  And the property website it feeds doesn't exist until they've paid, so
  before then they can't see what they're filling it in for.
- *Solution:* one line in the confirmation email and one in the delivery
  email: "Add the price, beds and baths for your property website here."
- *Size:* Small.

**B4. Every email link lands on a sign-in screen first.**
- *Problem:* the agent clicks "your photos are ready", gets a sign-in page,
  types their email, waits for a second email, and clicks a link that
  expires in 15 minutes. Two emails to see their photos. They stay signed in
  for 30 days after that, on that device only.
- *Solution:* put a personal sign-in link in the delivery, preview and
  invoice emails themselves, good for a week and for that listing only.
- *Trade-off:* anyone the email is forwarded to can open the gallery.
  Downloads stay behind payment either way. I think that's the right trade
  for agents, who forward things to assistants anyway.
- *Size:* Medium. **Needs you:** a yes on the trade-off.

**B5. The agent can't see what they ordered, or the cost, before the shoot.**
- *Problem:* their "Shoot booked" page shows the date. It shows the order
  and the price only if you've already filled in an invoice.
- *Solution:* show the services they picked straight from the booking, and
  the total once prices are real.
- *Size:* Small. Best done with A1.

**B6. Reschedule has two dead ends.**
- *Problem:* an agent can't move to a different time on the same day, and
  inside 48 hours the page just tells them to email you.
- *Solution:* allow same-day time changes. The 48-hour rule is yours and
  should stay.
- *Size:* Medium. Low priority.

**B7. On an iPhone the zip lands in Files, not Photos.**
- *Problem:* agents post from their phones. A zip in the Files app is three
  taps from being usable, and the phone download has never been tested.
- *Solution:* first test it (see the untested list). Later, a "Save to
  Photos" button per photo on phones.
- *Size:* Medium. Parked by you in September.

**B8. Nothing happens after delivery.**
- *Problem:* no thank-you, no review request, no easy "book another". It
  also isn't written anywhere how long a gallery stays online.
- *Solution:* a follow-up email a few days after delivery with a Book again
  link. Decide and state how long you keep galleries.
- *Size:* Small. **Needs you:** the retention answer.

### C. Friction for you

**C1. A date request shows as "confirmed" in admin.**
- *Problem:* when the calendar can't be read, the form saves a request with
  no confirmed slot. The Bookings page labels anything that isn't cancelled
  "confirmed", so a request you still owe an answer on looks settled. The
  old Cashmere request from September shows this way now.
- *Solution:* show "needs a date" for those, at the top of the list.
- *Size:* Small. Found by reading the code; I haven't looked at the page.

**C2. An address typed without a comma loses its city.**
- *Problem:* you then tidy the city by hand, as you did with Brookside's
  "DALLAS".
- *Solution:* the site already looks the address up on Google for travel
  pricing. Take the city from that answer.
- *Size:* Small.

**C3. A hand-made listing bypasses the whole front door.**
- *Problem:* for Peter you created the client and listing yourself and sent
  the link yourself. That works, but he got no confirmation, no delivery
  email and no invoice, and making a listing by hand for a shoot that was
  also booked online creates a duplicate.
- *Solution:* nothing to build. For hand-made listings, still use Send
  delivery email so the agent gets the property website links and there's a
  record.

**C4. Test data is sitting in the live database.**
- *What's there:* Preston Hollow (a made-up agent on a real brokerage's
  domain), an empty Cashmere Drive listing, a Cashmere test booking still
  marked confirmed for Oct 5, five older test bookings, and one client with
  no listings.
- *Solution:* one clean-out at launch. Keep Rockwall until the tests below
  are done. There's no Delete for a booking, so this needs a careful
  one-off.
- *Size:* Small. **Needs you:** a go-ahead, because it edits live data.

**C5. The Spiro link is quietly fragile.**
- *Problem:* Spiro puts its shoots on your calendar through your own Google
  login. If that connection is ever dropped, salanera.com would start
  selling days you're already booked, with no warning.
- *Solution:* re-check after any change to your Google account or Spiro's
  settings. No building.

**C6. The order form has no limit on how often it can be sent.**
- *Problem:* a script could flood your inbox with fake bookings and take
  days off your calendar. The contact form's spam trap is working: it has
  caught about one bot a day for the last two weeks, 23 in 60 days.
- *Solution:* a simple per-visitor limit on the order form.
- *Size:* Small.

### D. Protection before payment

**D1. Watermarks are laid over the photo, not baked in.**
- *Problem:* a determined agent can get the clean 2400px preview out of the
  browser without paying.
- *Solution:* make a watermarked copy of each photo for unpaid galleries.
- *Size:* Medium. Parked by you in September.

**D2. An unpaid gallery still streams the whole film.**
- *Problem:* the player is watermarked, but the full file is sent. It can be
  saved.
- *Solution:* show only the still until paid, or a short low-quality preview.
- *Size:* Small for the still, Large for a preview clip.

---

## Never tested for real

| What | Why it matters | How to test |
|---|---|---|
| A real payment end to end | It's the whole point (A2) | The Rockwall dollar test |
| Downloading the zips on a phone | Most agents will | Open Rockwall on your iPhone once it's unlocked |
| A horizontal film upload | The only film so far is vertical | Upload one to Rockwall |
| The locked and "Shoot booked" pages with real data | Only the paid page was checked after the redesign | Look at Rockwall (locked) and a new test booking |
| Property details on a booked, unshot listing | Same form, different page state | Fill it in on that test booking |
| The preview email on a real job | It carries the money | Comes with the dollar test |
| Dragging photos on a tablet or phone | Mouse only, by design | Not needed yet |

One item on the old list looks settled: all 22 Brookside photos, including
the four aerials uploaded today, have their smaller copies, so new uploads
are making their own.

---

## Suggested order

1. **The Rockwall dollar test (A2).** Ten minutes, no building, and it tells
   us whether the money half works at all.
2. **The small fixes in one session:** the confirmation subject (B2), the
   Details mentions (B3), "needs a date" in admin (C1), the city fix (C2).
   **Done Nov 14**, along with the privacy page from A4.
3. **The pre-shoot reminder (B1).**
4. **Sign-in links in emails (B4),** if you agree with the trade-off.
5. **Real rates and terms (A1),** whenever they exist, with the order
   summary (B5).
6. **Stripe automation (A3).** The biggest job and the biggest relief.
7. **Launch housekeeping:** Pro plan and privacy page (A4), test-data
   clean-out (C4), the order form limit (C6).

D1, D2, B6, B7 and B8 can wait until agents are actually using it.
