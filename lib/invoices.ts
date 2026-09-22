import 'server-only';

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDatabase } from '@/lib/db';
import { invoiceTotals } from '@/lib/invoice-math';
import { invoices, listings } from '@/lib/schema';
import type { Booking, Invoice, InvoiceLine, Listing } from '@/lib/schema';

/**
 * The usual Dallas–Fort Worth rate: 6.25% state plus 2% local. Confirmed by
 * Nick on Sep 22 as what he charges. It is only the default for a new
 * invoice — every invoice carries its own rate, so changing this never
 * rewrites history, and an exempt client is a rate of zero.
 */
export const DEFAULT_TAX_RATE_BP = 825;

/**
 * The arithmetic lives in lib/invoice-math.ts, which has no server imports, so
 * the editor and the client's gallery can total an invoice the same way this
 * file does. Re-exported here so server code has one place to import from.
 */
export { invoiceMoney, invoiceTotals, taxRateLabel, type InvoiceTotals } from '@/lib/invoice-math';

/**
 * True for the two errors Postgres raises when this code is newer than the
 * database: `42P01` undefined_table and `42703` undefined_column.
 *
 * It exists so a deploy that lands before migration 0009 is run degrades
 * instead of breaking. Without it the admin listing page — the page Nick runs
 * a shoot from — would 500 outright in that window, which is a bad trade for
 * a feature nobody is using yet. Deliberately narrow: any other database error
 * is re-thrown, because "the invoice could not be read" must never quietly
 * become "there is no invoice".
 */
function notYetMigrated(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === '42703';
}

/** The message Nick sees if he reaches an invoice before running the migration. */
export const NEEDS_MIGRATION =
  'Invoices need migration 0009 — run it from /admin, then try again.';

/** A new line, ready to be filled in. */
export function blankLine(): InvoiceLine {
  return { id: randomUUID(), name: '', amount: 0 };
}

/**
 * The lines a new invoice starts with, taken from the booking that made the
 * listing.
 *
 * **Placeholder rates are seeded as names with no amounts.** Every booking
 * records whether the card it was priced from was real (`ratesArePlaceholder`),
 * and while it is not, every figure on it is 999 — an invented number. Copying
 * those into an invoice would put Nick one missed edit away from billing a
 * client $999 for a floor plan. So the services come across, because they are
 * the true part, and the money starts at zero for him to fill in.
 *
 * A listing with no booking — one Nick made by hand — starts empty.
 */
export function seedLines(booking: Booking | null): InvoiceLine[] {
  if (!booking) return [];

  const real = !booking.ratesArePlaceholder;

  return booking.lines.map((line) => ({
    id: randomUUID(),
    name: line.name,
    // `amount` is null on a line that needs a human number, and dollars when
    // it has one; invoices are in cents.
    amount: real && line.amount !== null ? line.amount * 100 : 0,
  }));
}

/**
 * The listing's invoice, creating it from the booking the first time it is
 * asked for.
 *
 * The unique index on `listing_id` is what makes this safe to call from two
 * places at once: a second insert loses rather than making a duplicate, and
 * the loser re-reads the winner's row.
 */
export async function getOrCreateInvoice(
  listing: Listing,
  booking: Booking | null,
): Promise<Invoice> {
  const db = getDatabase();

  const existing = await db.select().from(invoices).where(eq(invoices.listingId, listing.id)).limit(1);
  if (existing[0]) return existing[0];

  const created = await db
    .insert(invoices)
    .values({
      listingId: listing.id,
      lines: seedLines(booking),
      taxRateBp: DEFAULT_TAX_RATE_BP,
    })
    .onConflictDoNothing({ target: invoices.listingId })
    .returning();

  if (created[0]) return created[0];

  // Lost the race. The winner's row is the one that counts.
  const won = await db.select().from(invoices).where(eq(invoices.listingId, listing.id)).limit(1);
  if (!won[0]) throw new Error(`invoice for listing ${listing.id} could not be created or read`);
  return won[0];
}

/**
 * The invoice if there is one. Never creates: for read paths, including the
 * client's. Answers null rather than throwing on a database that has not had
 * migration 0009 yet — see notYetMigrated().
 */
export async function getInvoice(listingId: number): Promise<Invoice | null> {
  const db = getDatabase();
  try {
    const rows = await db.select().from(invoices).where(eq(invoices.listingId, listingId)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    if (notYetMigrated(error)) return null;
    throw error;
  }
}

/**
 * Saves the editable parts. Everything about payment is deliberately not here
 * — see `setInvoicePaid` — so a routine edit can never move an invoice in or
 * out of paid by accident.
 */
export async function saveInvoice(
  listingId: number,
  input: { lines: InvoiceLine[]; taxRateBp: number; note: string | null; paymentUrl: string | null },
): Promise<void> {
  const db = getDatabase();

  await db
    .update(invoices)
    .set({
      lines: input.lines,
      taxRateBp: input.taxRateBp,
      note: input.note,
      paymentUrl: input.paymentUrl,
      updatedAt: new Date(),
    })
    .where(eq(invoices.listingId, listingId));
}

/**
 * Marks an invoice paid or unpaid, and moves the download lock with it.
 *
 * These are two rows in two tables and Neon's HTTP driver has no transaction
 * across them, so the order matters. **The lock is written first.** If the
 * second write fails, the client can download something they have paid for
 * and Nick's invoice looks unpaid — an error he will see and can correct. The
 * other order fails the other way: the invoice says paid, the client still
 * cannot download, and the first Nick hears of it is a complaint.
 */
export async function setInvoicePaid(
  listingId: number,
  paid: boolean,
  method: string | null,
): Promise<void> {
  const db = getDatabase();

  await db.update(listings).set({ downloadLocked: !paid }).where(eq(listings.id, listingId));

  await db
    .update(invoices)
    .set({
      paidAt: paid ? new Date() : null,
      paidMethod: paid ? method : null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.listingId, listingId));
}

/**
 * Whether an invoice is worth showing a client at all.
 *
 * An invoice with no priced lines is one Nick has created but not filled in,
 * and showing an agent "$0.00 due" is worse than showing nothing: it reads as
 * a promise. Both the portal and the email check this before rendering.
 */
export function invoiceIsReady(invoice: Invoice | null): invoice is Invoice {
  if (!invoice) return false;
  const named = invoice.lines.filter((line) => line.name.trim() !== '');
  return named.length > 0 && invoiceTotals(invoice.lines, invoice.taxRateBp).total > 0;
}
