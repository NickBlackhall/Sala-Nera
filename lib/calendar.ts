import 'server-only';

import { SignJWT, importPKCS8 } from 'jose';

import type { Interval } from '@/lib/scheduling';

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
const SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy';

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
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(config: CalendarConfig): Promise<string | null> {
  // A minute of headroom: a token that expires mid-request is a 401 that looks
  // exactly like a bad credential.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  try {
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({ scope: SCOPE })
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

    cachedToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return cachedToken.value;
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

  const token = await accessToken(config);
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
