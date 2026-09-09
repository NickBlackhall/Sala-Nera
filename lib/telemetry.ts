import 'server-only';

import { getDatabase, hasDatabase } from '@/lib/db';
import { events } from '@/lib/schema';

/**
 * The record of what actually happened.
 *
 * This exists because of a specific bad day: three separate anti-spam rules
 * each threw away real bookings while showing the sender a success screen, and
 * nothing anywhere knew. The form looked fine. The only evidence was absence.
 *
 * Two rules govern everything here:
 *
 *   1. **Telemetry must never break the thing it observes.** Every write is
 *      wrapped, every failure is swallowed after being logged to the console.
 *      A booking must never fail because we could not record that it happened.
 *
 *   2. **Every terminal outcome gets recorded, especially the silent ones.**
 *      A submission we deliberately discard is exactly the case that needs a
 *      trace, because it is indistinguishable from success at the other end.
 */

export type EventKind = 'booking' | 'inquiry' | 'download' | 'auth';

export type EventOutcome =
  /** It worked, all the way through. */
  | 'ok'
  /** We threw it away on purpose — bot suspicion. The dangerous one. */
  | 'discarded'
  /** We refused it and said so: validation, wrong origin, not allowed. */
  | 'rejected'
  /** We tried and something broke. */
  | 'failed';

export type EventInput = {
  kind: EventKind;
  outcome: EventOutcome;
  reason?: string;
  detail?: string;
  email?: string | null;
  requestId?: string | null;
};

/** Keeps one bad field from failing the insert that carries the diagnosis. */
const trim = (v: string | null | undefined, limit: number): string | null => {
  if (!v) return null;
  return v.replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, limit) || null;
};

/**
 * Record one event. Awaited, but never rejects.
 *
 * The console line goes out first and unconditionally: `vercel logs` works when
 * the database is unreachable, unmigrated, or absent in local development, and
 * a diagnosis that depends on the healthy path is no diagnosis at all.
 */
export async function record(input: EventInput): Promise<void> {
  const { kind, outcome, reason, detail, email, requestId } = input;

  const line = [
    `${kind}:${outcome}`,
    reason ? `reason=${reason}` : null,
    email ? `email=${email}` : null,
    requestId ? `req=${requestId}` : null,
    detail ? `— ${detail}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  // Discards and failures are the ones worth spotting in a wall of log lines.
  if (outcome === 'ok') console.log(line);
  else console.warn(line);

  if (!hasDatabase()) return;

  try {
    await getDatabase().insert(events).values({
      kind,
      outcome,
      reason: trim(reason, 60),
      detail: trim(detail, 1000),
      email: trim(email, 200),
      requestId: trim(requestId, 100),
    });
  } catch (error) {
    // Deliberately swallowed. The console line above already carries the
    // diagnosis, and nothing the caller is doing should fail over this.
    console.error('telemetry: could not record event', error);
  }
}
