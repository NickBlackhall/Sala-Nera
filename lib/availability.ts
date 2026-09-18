import 'server-only';

import { confirmedDates } from '@/lib/bookings';
import { busyIntervals, hasCalendar } from '@/lib/calendar';
import { availableSlots, zonedDate, type Slot, HORIZON_DAYS } from '@/lib/scheduling';

/**
 * What is actually open, assembled from the two sources that each know half.
 *
 * Nick's calendar says when he is busy — BMG's shoots, his own appointments,
 * anything he has blocked out — but not which of those are Sala Nera's, since
 * this app is deliberately not allowed to read event titles. The bookings
 * table says which days Sala Nera has already sold, and knows nothing about
 * the rest of his life. lib/scheduling.ts applies the rules to both.
 *
 * Shared by the endpoint the booking form reads and the route that confirms a
 * booking, because the second must re-check what the first offered. The
 * browser's chosen slot is a claim, not a fact — the same reasoning that makes
 * app/api/booking/route.ts re-price every submission rather than trusting the
 * estimate it is sent.
 *
 * **null means "could not find out", and is never an empty list.** If Google
 * or the database cannot be reached, callers must offer nothing and confirm
 * nothing. An outage that reads as a free fortnight ends with a client at a
 * house Nick does not know about.
 */

/**
 * Long enough to absorb a client stepping back and forth through the form,
 * short enough that a slot taken elsewhere disappears while they decide — and
 * invalidated outright the moment a booking claims a day, so the common case
 * of "somebody just took that" corrects immediately rather than on a timer.
 * Correctness never rests on this: the claim is decided by a unique index.
 */
const CACHE_MS = 60_000;

let cached: { at: number; slots: Slot[] } | null = null;

/** Called after a successful claim, so the next form to ask sees the day gone. */
export function invalidateAvailability(): void {
  cached = null;
}

export async function getAvailability(): Promise<Slot[] | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.slots;
  if (!hasCalendar()) return null;

  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);

  const busy = await busyIntervals(now, horizon);
  if (busy === null) return null;

  let takenDates: string[];
  try {
    takenDates = await confirmedDates(zonedDate(now), zonedDate(horizon));
  } catch (error) {
    console.error('availability: could not read confirmed bookings', error);
    return null;
  }

  const slots = availableSlots({ from: now, busy, takenDates });
  cached = { at: Date.now(), slots };
  return slots;
}

/** The slot starting at this exact instant, if it is genuinely open. */
export async function findOpenSlot(startsAt: Date): Promise<Slot | null> {
  const slots = await getAvailability();
  if (slots === null) return null;
  return slots.find((s) => s.start.getTime() === startsAt.getTime()) ?? null;
}
