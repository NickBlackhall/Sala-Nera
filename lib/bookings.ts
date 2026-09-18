import 'server-only';

import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { getDatabase } from '@/lib/db';
import { bookings, clients } from '@/lib/schema';

export type ClientAccount = { id: number; created: boolean };

/**
 * The client account behind a booking's email — created if new, reused if not.
 * On an existing client a booking only fills blanks: anyone can type any name
 * into the form, so it must never overwrite what Nick has saved.
 */
export async function ensureClient(input: {
  email: string;
  name: string;
  phone: string;
  company: string;
}): Promise<ClientAccount> {
  const blank = (v: string) => v.trim() || null;

  const [row] = await getDatabase()
    .insert(clients)
    .values({
      email: input.email.trim().toLowerCase(),
      name: blank(input.name),
      phone: blank(input.phone),
      company: blank(input.company),
    })
    .onConflictDoUpdate({
      target: clients.email,
      set: {
        name: sql`coalesce(${clients.name}, excluded.name)`,
        phone: sql`coalesce(${clients.phone}, excluded.phone)`,
        company: sql`coalesce(${clients.company}, excluded.company)`,
      },
    })
    // xmax is 0 only on a row this statement inserted, not one it updated.
    .returning({ id: clients.id, created: sql<boolean>`(xmax = 0)` });

  return row;
}

/** Saves one delivered booking. A retry carrying the same requestId is a no-op. */
export async function saveBooking(record: typeof bookings.$inferInsert): Promise<void> {
  await getDatabase().insert(bookings).values(record).onConflictDoNothing({ target: bookings.requestId });
}

/**
 * Local dates (YYYY-MM-DD) already holding a confirmed Sala Nera booking, for
 * feeding availableSlots({ takenDates }) — the one-shoot-a-day rule.
 *
 * Only Sala Nera's own bookings are counted here. Nick's other commitments,
 * BMG's included, come from his calendar instead: this table has no idea they
 * exist, and the calendar has no idea which of its entries are Sala Nera's
 * without reading titles it is deliberately not allowed to read. Two sources,
 * each answering the question it can actually answer.
 *
 * Text comparison is correct for YYYY-MM-DD, which sorts lexicographically in
 * date order — the reason lib/scheduling.ts settled on that format.
 */
export async function confirmedDates(from: string, to: string): Promise<string[]> {
  const rows = await getDatabase()
    .select({ shootDate: bookings.shootDate })
    .from(bookings)
    .where(and(eq(bookings.status, 'confirmed'), gte(bookings.shootDate, from), lte(bookings.shootDate, to)));

  return rows.map((r) => r.shootDate).filter((d): d is string => d !== null);
}

export type ClaimResult =
  | { claimed: true; id: number }
  | { claimed: false };

/**
 * Takes a slot, or reports that somebody else already has it.
 *
 * The check-then-insert this replaces cannot be made safe: between deciding a
 * Thursday is free and writing the row is exactly where a second booking
 * fits, and two agents confirming in the same second is not a rare case for a
 * form that shows everyone the same short list of openings. So the decision is
 * the insert, and bookings_one_confirmed_per_day either accepts it or does
 * not. Nothing reaches Nick's calendar until this returns claimed.
 *
 * Conflicts are swallowed rather than thrown because two different ones are
 * possible and only one is a failure: losing the day, and the same submission
 * arriving twice. A retry that finds its own requestId already saved has not
 * lost anything — the booking landed the first time — so it is reported as the
 * success it is, and the client sees a confirmation rather than a slot they
 * apparently missed by a second.
 */
export async function claimSlot(record: typeof bookings.$inferInsert): Promise<ClaimResult> {
  const db = getDatabase();

  const [row] = await db
    .insert(bookings)
    .values({ ...record, status: 'confirmed' })
    .onConflictDoNothing()
    .returning({ id: bookings.id });

  if (row) return { claimed: true, id: row.id };

  if (record.requestId) {
    const [existing] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.requestId, record.requestId))
      .limit(1);
    if (existing) return { claimed: true, id: existing.id };
  }

  return { claimed: false };
}
