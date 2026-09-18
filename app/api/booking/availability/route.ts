import { NextResponse } from 'next/server';

import { confirmedDates } from '@/lib/bookings';
import { busyIntervals, hasCalendar } from '@/lib/calendar';
import { availableSlots, zonedDate, HORIZON_DAYS, TIME_ZONE } from '@/lib/scheduling';

/**
 * The open slots a client can book, from Nick's real calendar.
 *
 * Two sources, because neither can answer the whole question. His calendar
 * says when he is busy — BMG shoots, personal appointments, anything he has
 * blocked out — but not which of those are Sala Nera's, since this app is
 * deliberately not allowed to read event titles. The bookings table says which
 * days Sala Nera has already sold, but knows nothing about the rest of his
 * life. lib/scheduling.ts takes both and applies the rules.
 *
 * **It refuses rather than guesses.** If the calendar cannot be reached, this
 * answers `available: false` with an empty list, never a cheerful set of times
 * derived from "no busy periods found". An outage at Google must not read as a
 * free fortnight, because the next thing that happens is a client booking one
 * of those slots and Nick discovering it when he arrives somewhere else.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Availability changes when Nick's calendar does, which is rarely, and every
 * client loading /book would otherwise cost a free/busy call. A minute is long
 * enough to absorb someone stepping back and forth through the form, short
 * enough that a slot taken elsewhere disappears while they are still deciding.
 * Correctness does not rest on it either way: the claim is what decides, and
 * it is checked against the database, not against this.
 */
const CACHE_MS = 60_000;
let cached: { at: number; body: AvailabilityBody } | null = null;

type AvailabilityBody = {
  available: boolean;
  timeZone: string;
  days: { date: string; label: string; starts: { at: string; label: string }[] }[];
};

const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' }).format(d);
const timeLabel = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', hour12: true }).format(d);

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };

  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json(cached.body, { headers });
  }

  const unavailable: AvailabilityBody = { available: false, timeZone: TIME_ZONE, days: [] };

  if (!hasCalendar()) {
    // Not an error: the honest state before the credential exists, same as
    // hasGeocoding() gating the travel line.
    return NextResponse.json(unavailable, { headers });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);

  const busy = await busyIntervals(now, horizon);
  if (busy === null) return NextResponse.json(unavailable, { headers });

  let takenDates: string[] = [];
  try {
    takenDates = await confirmedDates(zonedDate(now), zonedDate(horizon));
  } catch (error) {
    // The same reasoning as a failed calendar read: without knowing which days
    // are already sold, every answer risks being a double-booking.
    console.error('availability: could not read confirmed bookings', error);
    return NextResponse.json(unavailable, { headers });
  }

  const slots = availableSlots({ from: now, busy, takenDates });

  const days = new Map<string, AvailabilityBody['days'][number]>();
  for (const slot of slots) {
    const day = days.get(slot.date) ?? { date: slot.date, label: dayLabel(slot.start), starts: [] };
    day.starts.push({ at: slot.start.toISOString(), label: timeLabel(slot.start) });
    days.set(slot.date, day);
  }

  const body: AvailabilityBody = { available: true, timeZone: TIME_ZONE, days: [...days.values()] };
  cached = { at: Date.now(), body };
  return NextResponse.json(body, { headers });
}
