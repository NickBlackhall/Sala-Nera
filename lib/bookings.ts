import 'server-only';

import { sql } from 'drizzle-orm';
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
