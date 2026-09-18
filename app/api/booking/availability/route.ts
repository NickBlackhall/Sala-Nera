import { NextResponse } from 'next/server';

import { getAvailability } from '@/lib/availability';
import { TIME_ZONE } from '@/lib/scheduling';

/**
 * The open slots the booking form shows. Thin on purpose — lib/availability.ts
 * holds the logic, because app/api/booking/route.ts has to re-check the same
 * thing before it confirms anything, and two copies of "what is open" is two
 * answers waiting to disagree.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' }).format(d);
const timeLabel = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', hour12: true }).format(d);

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  const slots = await getAvailability();

  // Not an error, and deliberately not an empty-but-cheerful list: the form
  // falls back to asking for a preferred date when it sees this.
  if (slots === null) {
    return NextResponse.json({ available: false, timeZone: TIME_ZONE, days: [] }, { headers });
  }

  const days = new Map<string, { date: string; label: string; starts: { at: string; label: string }[] }>();
  for (const slot of slots) {
    const day = days.get(slot.date) ?? { date: slot.date, label: dayLabel(slot.start), starts: [] };
    day.starts.push({ at: slot.start.toISOString(), label: timeLabel(slot.start) });
    days.set(slot.date, day);
  }

  return NextResponse.json({ available: true, timeZone: TIME_ZONE, days: [...days.values()] }, { headers });
}
