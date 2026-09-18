import 'server-only';

import { SignJWT, importPKCS8 } from 'jose';

import { TIME_ZONE, type Interval } from '@/lib/scheduling';

/**
 * When Nick is busy, according to Google Calendar.
 *
 * Same shape as lib/geocode.ts and lib/storage.ts: hasCalendar() is an honest
 * boolean, and the fetch returns a real answer or null — never a guess.
 *
 * Two things about this one are deliberate and should survive future edits:
 *
 * 1. The scope requested is calendar.freebusy, the narrowest Google offers,
 *    not calendar or calendar.readonly. The calendar this reads is Nick's
 *    real one — it carries BMG's client shoots and his own medical
 *    appointments, on purpose, because anything on it should block his working
 *    time. The site has no business knowing what any of them are, and a token
 *    scoped this narrowly *cannot* read an event title even if some later
 *    caller asks it to. The restraint is enforced by Google rather than by
 *    everyone remembering.
 *
 * 2. A failed lookup returns null, never an empty array. Empty means "Nick is
 *    genuinely free"; null means "nobody knows". Collapsing the two would
 *    offer his entire calendar as bookable the moment Google had a bad minute,
 *    and instant booking would confirm it. Callers must treat null as "offer
 *    nothing", which is the safe direction to fail in — a client who cannot
 *    book calls Nick; a client who double-books him does not.
 *
 * Verified against the real calendar on Sep 18 before anything was built on
 * it: the service account authenticated, the free/busy read came back with
 * appointments Nick recognised, and a test event was created and deleted.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';

/**
 * Two scopes, deliberately not one token covering both.
 *
 * Reading availability asks only for free/busy, so that call cannot see an
 * event title whatever it does. Writing a booking needs calendar.events, which
 * can. Merging them into a single token would quietly hand the read the
 * ability to see everything on Nick's calendar — the exact thing the narrow
 * scope was chosen to make impossible — in exchange for saving one cached
 * token. Keeping them apart means the privacy boundary holds even if a future
 * change to the read is careless.
 */
const SCOPES = {
  read: 'https://www.googleapis.com/auth/calendar.freebusy',
  write: 'https://www.googleapis.com/auth/calendar.events',
} as const;

type CalendarConfig = { email: string; privateKey: string; calendarId: string };

function calendarConfig(): CalendarConfig | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!email || !privateKey || !calendarId) return null;
  return { email, privateKey, calendarId };
}

/** Whether the calendar is wired up at all. False means availability cannot be computed. */
export function hasCalendar(): boolean {
  return calendarConfig() !== null;
}

/**
 * The key is stored in Vercel with real newlines, because the JSON field was
 * parsed before it went in. The `.replace(/\\n/g, '\n')` that every Google
 * example carries would be wrong here — there is nothing to unescape, and on
 * a key like this one it is a no-op that only looks reassuring. Left as a
 * note rather than a defensive call so nobody adds one back.
 */
const cachedTokens = new Map<string, { value: string; expiresAt: number }>();

async function accessToken(config: CalendarConfig, scope: string): Promise<string | null> {
  // A minute of headroom: a token that expires mid-request is a 401 that looks
  // exactly like a bad credential.
  const cached = cachedTokens.get(scope);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

  try {
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({ scope })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(config.email)
      .setAudience(TOKEN_URL)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(await importPKCS8(config.privateKey, 'RS256'));

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const body = await res.json();
    if (!res.ok || !body.access_token) {
      console.error('calendar: token request failed', res.status, body.error ?? '', body.error_description ?? '');
      return null;
    }

    cachedTokens.set(scope, {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    });
    return body.access_token as string;
  } catch (err) {
    console.error('calendar: could not sign in', err);
    return null;
  }
}

/**
 * Busy intervals between two instants, or null if the calendar could not be
 * read. See the note above on why that distinction is load-bearing.
 */
export async function busyIntervals(from: Date, to: Date): Promise<Interval[] | null> {
  const config = calendarConfig();
  if (!config) return null;

  const token = await accessToken(config, SCOPES.read);
  if (!token) return null;

  try {
    const res = await fetch(FREEBUSY_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: [{ id: config.calendarId }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    const body = await res.json();
    if (!res.ok) {
      console.error('calendar: free/busy failed', res.status, body.error?.message ?? '');
      return null;
    }

    const calendar = body.calendars?.[config.calendarId];
    if (!calendar) {
      // Google answers 200 with the calendar simply missing when the id is
      // wrong, rather than erroring — so this is the shape a typo takes.
      console.error('calendar: no free/busy returned for the configured calendar id');
      return null;
    }
    if (calendar.errors?.length) {
      // "notFound" here is almost always the share having been revoked.
      console.error('calendar: free/busy errors', calendar.errors.map((e: { reason: string }) => e.reason).join(', '));
      return null;
    }

    return (calendar.busy ?? []).map((b: { start: string; end: string }) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }));
  } catch (err) {
    console.error('calendar: free/busy request failed', err);
    return null;
  }
}

/**
 * Puts a confirmed shoot on Nick's calendar.
 *
 * Called only after the slot is claimed in the database, never before. The
 * claim is what decides; this is what tells Nick. Reversing them would leave an
 * event on his real calendar for a booking that lost its race — worse than no
 * event, because he would plan around a shoot that is not happening.
 *
 * Returns the event id to store, or null if the write failed. **A null here
 * must not undo the booking.** The client has been told they have the slot and
 * the day is already blocked in the database, so availability is correct either
 * way; what is missing is Nick's own view of it, which /admin/bookings shows
 * regardless and flags as not on the calendar.
 *
 * The title carries the [Sala Nera] tag Nick asked for: this calendar is shared
 * with his other brand, and at a glance he needs to know which business a
 * booking came from without opening it.
 */
export async function createBookingEvent(booking: {
  address: string;
  startsAt: Date;
  endsAt: Date;
  name: string;
  email: string;
  phone: string | null;
  sqft: number | null;
  services: string[];
  accessNotes: string | null;
  notes: string | null;
}): Promise<string | null> {
  const config = calendarConfig();
  if (!config) return null;

  const token = await accessToken(config, SCOPES.write);
  if (!token) return null;

  // What Nick actually needs on his phone standing outside the house: who to
  // call, how to get in, and what he agreed to shoot.
  const description = [
    `Client:   ${booking.name}`,
    `Email:    ${booking.email}`,
    `Phone:    ${booking.phone || '—'}`,
    booking.sqft ? `Sqft:     ${booking.sqft.toLocaleString('en-US')}` : null,
    '',
    `Services: ${booking.services.join(', ') || '—'}`,
    '',
    'Access notes:',
    booking.accessNotes || '—',
    '',
    'Anything else:',
    booking.notes || '—',
    '',
    'Booked through salanera.com — see /admin/bookings to cancel.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  try {
    const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(config.calendarId)}/events`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        summary: `[Sala Nera] ${booking.address}`,
        location: booking.address,
        description,
        start: { dateTime: booking.startsAt.toISOString(), timeZone: TIME_ZONE },
        end: { dateTime: booking.endsAt.toISOString(), timeZone: TIME_ZONE },
      }),
      signal: AbortSignal.timeout(8000),
    });

    const body = await res.json();
    if (!res.ok) {
      console.error('calendar: could not create event', res.status, body.error?.message ?? '');
      return null;
    }
    return (body.id as string) ?? null;
  } catch (err) {
    console.error('calendar: create event threw', err);
    return null;
  }
}

/**
 * Removes a cancelled shoot's event. Reports whether it is really gone, so a
 * failure can be surfaced rather than leaving Nick holding a day he has given
 * back. A 404 or 410 counts as success: the event is not there, which is the
 * outcome asked for, and Google answers 410 for one already deleted.
 */
export async function deleteBookingEvent(eventId: string): Promise<boolean> {
  const config = calendarConfig();
  if (!config) return false;

  const token = await accessToken(config, SCOPES.write);
  if (!token) return false;

  try {
    const res = await fetch(
      `${EVENTS_URL}/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (res.ok || res.status === 204 || res.status === 404 || res.status === 410) return true;

    console.error('calendar: could not delete event', res.status);
    return false;
  } catch (err) {
    console.error('calendar: delete event threw', err);
    return false;
  }
}
