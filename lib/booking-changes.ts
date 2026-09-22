import 'server-only';

import { and, eq, gte } from 'drizzle-orm';
import { findOpenSlot, invalidateAvailability } from '@/lib/availability';
import { releaseBookingListing } from '@/lib/booking-listing';
import { createBookingEvent, deleteBookingEvent } from '@/lib/calendar';
import { getDatabase } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { MIN_NOTICE_HOURS, TIME_ZONE } from '@/lib/scheduling';
import { bookings, listings, type Booking } from '@/lib/schema';
import { record } from '@/lib/telemetry';

/**
 * An agent cancelling or moving their own booking, from its listing in the
 * client portal. Nick's rules, Sep 22 2026: only up to 48 hours before the
 * shoot — the same notice a new booking needs, so a freed day can still be
 * sold — and only signed in. Inside the cutoff they contact Nick, who can
 * still cancel anything from /admin/bookings.
 *
 * Who may do it is decided by the caller (app/portal/[slug]/actions.ts); this
 * file only decides whether the booking itself can change, and changes it.
 */

export const CHANGE_CUTOFF_HOURS = MIN_NOTICE_HOURS;
const HOUR_MS = 3_600_000;

/** Whether this booking can still be changed by the agent, as of now. */
export function canChangeBooking(
  booking: Pick<Booking, 'status' | 'startsAt'>,
  now: Date = new Date(),
): boolean {
  return (
    booking.status === 'confirmed' &&
    booking.startsAt !== null &&
    new Date(booking.startsAt).getTime() - now.getTime() >= CHANGE_CUTOFF_HOURS * HOUR_MS
  );
}

/** "Tue, Sep 29, 9:00 AM" in Nick's time zone, where the shoot happens. */
export function shootWhen(d: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(d));
}

export type ChangeError = 'not_found' | 'too_late' | 'slot_taken' | 'changed';
export type ChangeResult = { ok: true; when: string } | { ok: false; error: ChangeError };

/** The earliest start a booking may have and still be changed now. */
const cutoff = () => new Date(Date.now() + CHANGE_CUTOFF_HOURS * HOUR_MS);

async function loadBooking(id: number): Promise<Booking | null> {
  const [row] = await getDatabase().select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return row ?? null;
}

/**
 * Cancels, if the booking is still confirmed, still at the time the agent was
 * looking at, and still outside the cutoff — all three inside the UPDATE
 * itself, so a second click, a reschedule in another tab, or the clock
 * passing the cutoff while they read the confirm dialog cannot slip through.
 *
 * Same release as Nick's admin cancel: the status change frees the day, then
 * the calendar event and the still-empty listing go.
 */
export async function cancelBookingByClient(input: {
  bookingId: number;
  /** The signed-in address doing it — the agent, or a teammate. */
  by: string;
}): Promise<ChangeResult> {
  const booking = await loadBooking(input.bookingId);
  if (!booking || booking.status !== 'confirmed' || !booking.startsAt) return { ok: false, error: 'not_found' };
  if (!canChangeBooking(booking)) return { ok: false, error: 'too_late' };

  const db = getDatabase();
  const [cancelled] = await db
    .update(bookings)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(bookings.id, booking.id),
        eq(bookings.status, 'confirmed'),
        eq(bookings.startsAt, booking.startsAt),
        gte(bookings.startsAt, cutoff()),
      ),
    )
    .returning({ calendarEventId: bookings.calendarEventId });
  if (!cancelled) return { ok: false, error: 'changed' };

  invalidateAvailability();

  const calendarOk = cancelled.calendarEventId ? await deleteBookingEvent(cancelled.calendarEventId) : true;
  try {
    await releaseBookingListing(booking.id);
  } catch (error) {
    console.error('booking change: cancelled but its listing could not be removed', { bookingId: booking.id, error });
  }

  const when = shootWhen(booking.startsAt);
  await notify({
    booking,
    by: input.by,
    nick: {
      subject: `Booking cancelled by the agent — ${booking.address}`,
      lines: [
        `${who(booking, input.by)} cancelled the shoot at ${booking.address}, ${when}.`,
        '',
        'The day is open to new bookings again, and the listing it made is gone.',
        calendarOk
          ? 'The calendar event has been removed.'
          : "! The calendar event could NOT be removed — delete it by hand so the day isn't blocked.",
      ],
    },
    agent: {
      subject: `Your shoot is cancelled — ${booking.address}`,
      lines: [
        `Your shoot at ${booking.address}, ${when}, is cancelled. There's nothing more you need to do.`,
        '',
        `To book another time: ${base()}/book`,
      ],
    },
  });
  await record({
    kind: 'booking', outcome: 'ok', reason: 'client_cancelled',
    detail: `${booking.address}, ${when}, cancelled from the client portal.${calendarOk ? '' : ' Calendar event NOT removed.'}`,
    email: input.by,
  });

  return { ok: true, when };
}

/**
 * Moves a booking to another open slot.
 *
 * One UPDATE does the move, so the new day is taken and the old one given back
 * in the same instant: there is never a moment where the agent holds neither,
 * and never one where they hold both. If someone else booked the new day first,
 * the one-confirmed-booking-a-day index refuses the UPDATE and nothing changes
 * — the agent keeps their original time and is asked to pick again.
 *
 * Nick's calendar follows: a new event at the new time first, then the old one
 * removed. The database is what holds the day; the calendar is his view of it.
 */
export async function rescheduleBookingByClient(input: {
  bookingId: number;
  newStart: Date;
  by: string;
}): Promise<ChangeResult> {
  const booking = await loadBooking(input.bookingId);
  if (!booking || booking.status !== 'confirmed' || !booking.startsAt) return { ok: false, error: 'not_found' };
  if (!canChangeBooking(booking)) return { ok: false, error: 'too_late' };

  // Re-checked against the calendar rather than believed, as a new booking is.
  const open = Number.isFinite(input.newStart.getTime()) ? await findOpenSlot(input.newStart) : null;
  if (!open) return { ok: false, error: 'slot_taken' };

  const db = getDatabase();
  let moved: { id: number } | undefined;
  try {
    [moved] = await db
      .update(bookings)
      .set({ startsAt: open.start, endsAt: open.end, shootDate: open.date })
      .where(
        and(
          eq(bookings.id, booking.id),
          eq(bookings.status, 'confirmed'),
          eq(bookings.startsAt, booking.startsAt),
          gte(bookings.startsAt, cutoff()),
        ),
      )
      .returning({ id: bookings.id });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: 'slot_taken' };
    throw error;
  }
  if (!moved) return { ok: false, error: 'changed' };

  invalidateAvailability();

  // The listing's shoot date follows, stored at midday UTC as everywhere else.
  try {
    await db
      .update(listings)
      .set({ shootDate: new Date(`${open.date}T12:00:00Z`) })
      .where(eq(listings.bookingId, booking.id));
  } catch (error) {
    console.error('booking change: moved but the listing date was not updated', { bookingId: booking.id, error });
  }

  const newEventId = await createBookingEvent({
    address: booking.address,
    startsAt: open.start,
    endsAt: open.end,
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    sqft: booking.sqft,
    services: booking.lines.filter((l) => !l.automatic).map((l) => l.name),
    accessNotes: booking.accessNotes,
    notes: booking.notes,
  });
  // Null when the new event could not be written: /admin/bookings then flags
  // the booking as not on the calendar, rather than pointing at an event that
  // is about to be deleted.
  try {
    await db.update(bookings).set({ calendarEventId: newEventId }).where(eq(bookings.id, booking.id));
  } catch (error) {
    console.error('booking change: new calendar event id not saved', { bookingId: booking.id, newEventId, error });
  }
  const oldRemoved = booking.calendarEventId ? await deleteBookingEvent(booking.calendarEventId) : true;

  const from = shootWhen(booking.startsAt);
  const to = shootWhen(open.start);
  const [listing] = await db
    .select({ slug: listings.slug })
    .from(listings)
    .where(eq(listings.bookingId, booking.id))
    .limit(1);

  await notify({
    booking,
    by: input.by,
    nick: {
      subject: `Booking moved by the agent — ${booking.address}`,
      lines: [
        `${who(booking, input.by)} moved the shoot at ${booking.address}.`,
        '',
        `Was: ${from}`,
        `Now: ${to}`,
        '',
        newEventId
          ? 'Your calendar has the new time.'
          : '! The new time could NOT be added to your calendar — add it by hand.',
        oldRemoved ? null : '! The old calendar event could NOT be removed — delete it by hand.',
      ],
    },
    agent: {
      subject: `Your shoot is moved — ${booking.address}`,
      lines: [
        `Your shoot at ${booking.address} is now ${to}. It was ${from}.`,
        'This is confirmed. Please allow around six hours on site.',
        ...(listing
          ? ['', `You can reschedule or cancel up to ${CHANGE_CUTOFF_HOURS} hours before the shoot:`, `${base()}/portal/${listing.slug}`]
          : []),
      ],
    },
  });
  await record({
    kind: 'booking', outcome: 'ok', reason: 'client_rescheduled',
    detail: `${booking.address}: ${from} → ${to}, from the client portal.${
      newEventId && oldRemoved ? '' : ' Calendar NOT fully updated.'
    }`,
    email: input.by,
  });

  return { ok: true, when: to };
}

// ------------------------------------------------------------------ helpers

function base(): string {
  return process.env.PORTAL_URL ?? 'https://salanera.com';
}

/** "Jane Agent (jane@…)", plus who actually did it when a teammate did. */
function who(booking: Booking, by: string): string {
  const booker = `${booking.name} (${booking.email})`;
  return by.toLowerCase() === booking.email.toLowerCase() ? booker : `${by}, for ${booker},`;
}

/**
 * One email to Nick and one to the agent. Neither may undo a change that has
 * already happened, so a failed send is logged, not raised.
 */
async function notify(input: {
  booking: Booking;
  by: string;
  nick: { subject: string; lines: (string | null)[] };
  agent: { subject: string; lines: string[] };
}): Promise<void> {
  const { booking } = input;
  const nickTo = process.env.NOTIFY_EMAIL;
  const firstName = booking.name.trim().split(/\s+/)[0] || 'there';

  const sentToNick = nickTo
    ? await sendEmail({
        to: nickTo,
        replyTo: booking.email,
        subject: input.nick.subject,
        text: [...input.nick.lines.filter((l): l is string => l !== null), '', '— sent from the Sala Nera client portal'].join('\n'),
      })
    : false;

  const sentToAgent = await sendEmail({
    to: booking.email,
    replyTo: nickTo,
    subject: input.agent.subject,
    text: [
      `Hi ${firstName},`,
      '',
      ...input.agent.lines,
      '',
      'Questions? Just reply to this email.',
      '',
      '— Sala Nera',
      '  A Blackhall Media Group collection · Dallas–Fort Worth',
    ].join('\n'),
  });

  if (!sentToNick || !sentToAgent) {
    await record({
      kind: 'booking', outcome: 'failed', reason: 'change_email_failed',
      detail: `${booking.address}: ${[!sentToNick && 'Nick', !sentToAgent && 'the agent'].filter(Boolean).join(' and ')} not emailed about "${input.nick.subject}".`,
      email: input.by,
    });
  }
}

/** Postgres 23505, however the driver or Drizzle wraps it. */
function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error, i = 0; e && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    if ((e as { code?: unknown }).code === '23505') return true;
  }
  return false;
}
