/**
 * Which slots Sala Nera can actually offer.
 *
 * Pure and synchronous: it takes Nick's busy time as an argument rather than
 * fetching it, so the rules below can be tested against fixtures without a
 * Google credential (see scripts/check-scheduling.mjs). lib/calendar.ts is
 * the half that talks to Google; this is the half that decides.
 *
 * Every number here came from Nick directly (Sep 18) rather than being
 * inferred, because a wrong duration double-books a real person — unlike a
 * wrong price, which is only embarrassing:
 *
 *   - Monday to Thursday only. No Fridays, no weekends.
 *   - 8am to 5pm, Central time.
 *   - One Sala Nera shoot per day, blocked out at a flat six hours. He
 *     deliberately chose a single conservative number over a duration model
 *     keyed to square footage and services: this brand points at larger
 *     luxury homes, and if a booking turns out to be photos-only he would
 *     rather call the client and shorten it himself than have the site guess
 *     short and strand him. Finishing early is a good outcome; running over
 *     into someone else's slot is not.
 *   - A flat hour of buffer either side of a shoot, so a booking never butts
 *     up against another commitment.
 *   - 48 hours' notice minimum.
 *
 * Note on the buffer: an earlier plan had it scaling with the distance
 * between consecutive shoots, and lib/distance.ts still describes itself as
 * serving that. Nick chose a flat hour when asked directly. Distance is
 * currently used for pricing only — there is no drive-time component in
 * scheduling, and adding one would need his say-so, not just the geocode
 * that already exists.
 */

export type Interval = { start: Date; end: Date };

export type Slot = {
  start: Date;
  end: Date;
  /** The local calendar day this slot belongs to, YYYY-MM-DD in TIME_ZONE. */
  date: string;
};

/**
 * Nick works one time zone and the site runs in UTC, so every rule below is
 * expressed in his local wall-clock time and converted at the edges. The
 * booking horizon routinely crosses a daylight-saving boundary, which is
 * exactly when "just add hours to a UTC timestamp" silently shifts every
 * slot by an hour.
 */
export const TIME_ZONE = 'America/Chicago';

/** Sunday is 0, matching Date.getDay(). Monday through Thursday. */
export const WORKING_DAYS = [1, 2, 3, 4];
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 17;
export const START_HOURS = [8, 9, 10, 11];
export const SHOOT_HOURS = 6;
export const BUFFER_HOURS = 1;
export const MIN_NOTICE_HOURS = 48;
export const HORIZON_DAYS = 60;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * How far the zone is ahead of UTC at a given instant, in milliseconds.
 * Derived from Intl rather than a table of offsets, so it stays correct when
 * daylight-saving rules change without this file being touched.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  // Midnight formats as hour 24 in some ICU versions; 24 % 24 is the 0 we want.
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asIfUtc - instant.getTime();
}

/** The instant at which a given wall-clock time occurs in the zone. */
export function zonedTime(date: string, hour: number, timeZone = TIME_ZONE): Date {
  const [year, month, day] = date.split('-').map(Number);
  const asIfUtc = Date.UTC(year, month - 1, day, hour);

  // The offset has to be sampled at the instant we are solving for, not the
  // one we guessed with, or times near a DST switch land an hour out. Sample,
  // correct, then re-sample: if the correction moved us across the boundary,
  // the second reading is the authoritative one.
  const first = new Date(asIfUtc - zoneOffsetMs(new Date(asIfUtc), timeZone));
  const second = zoneOffsetMs(first, timeZone);
  return new Date(asIfUtc - second);
}

/** The local calendar day an instant falls on, as YYYY-MM-DD. */
export function zonedDate(instant: Date, timeZone = TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Which weekday a local date falls on, Sunday 0. */
function weekdayOf(date: string, timeZone = TIME_ZONE): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(zonedTime(date, 12, timeZone));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export type AvailabilityInput = {
  /** Usually now. Slots start MIN_NOTICE_HOURS after this. */
  from: Date;
  /**
   * Busy intervals from Nick's calendar — start and end only. This calendar
   * carries his personal appointments as well as BMG's shoots, on purpose, so
   * every interval is a hard block and none of them should be filtered by
   * what they are. It is also why nothing here takes an event title: it has
   * no business knowing.
   */
  busy: Interval[];
  /**
   * Local dates (YYYY-MM-DD) already holding a Sala Nera booking, which are
   * dropped entirely under the one-a-day rule. Passed in rather than queried
   * because the bookings table does not yet record a confirmed slot — it
   * stores desired_date as free text, a request. Wire this up when that
   * schema lands.
   */
  takenDates?: readonly string[];
  horizonDays?: number;
};

/** Every slot a client can actually book, soonest first. */
export function availableSlots({
  from,
  busy,
  takenDates = [],
  horizonDays = HORIZON_DAYS,
}: AvailabilityInput): Slot[] {
  const earliest = new Date(from.getTime() + MIN_NOTICE_HOURS * HOUR_MS);
  const taken = new Set(takenDates);
  const slots: Slot[] = [];

  // Walk local days rather than adding 24h repeatedly: a DST day is 23 or 25
  // hours long, and stepping by a fixed day would eventually skip or repeat one.
  for (let i = 0; i <= horizonDays; i++) {
    const date = zonedDate(new Date(from.getTime() + i * DAY_MS));
    if (taken.has(date)) continue;
    if (!WORKING_DAYS.includes(weekdayOf(date))) continue;

    const dayEnd = zonedTime(date, DAY_END_HOUR);

    for (const hour of START_HOURS) {
      const start = zonedTime(date, hour);
      const end = new Date(start.getTime() + SHOOT_HOURS * HOUR_MS);

      if (start < earliest) continue;
      if (end > dayEnd) continue;

      // The buffer is protection against butting up against another
      // commitment, so it applies when testing the calendar — not against the
      // start of the working day, where there is nothing to travel from.
      const guarded = {
        start: new Date(start.getTime() - BUFFER_HOURS * HOUR_MS),
        end: new Date(end.getTime() + BUFFER_HOURS * HOUR_MS),
      };
      if (busy.some((b) => overlaps(guarded, b))) continue;

      slots.push({ start, end, date });
    }
  }

  return slots;
}

/** Whether a specific start is still bookable — the server-side re-check before confirming. */
export function isSlotAvailable(start: Date, input: AvailabilityInput): boolean {
  return availableSlots(input).some((slot) => slot.start.getTime() === start.getTime());
}
