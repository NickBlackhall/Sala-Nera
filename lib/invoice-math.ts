/**
 * Invoice arithmetic and formatting, with no server imports.
 *
 * Split out of lib/invoices.ts, which is `server-only`, because the editor
 * totals an invoice live as Nick types and the client's gallery renders one
 * too. The alternative — restating the arithmetic in the component, the way
 * SendDelivery restates ZipStatus — is fine for a shape but not for money:
 * two implementations of a tax calculation are two answers waiting to differ.
 *
 * Everything here works in **cents**, and takes anything with an `amount`, so
 * it needs no reference to the database row type.
 */

export type Priced = { amount: number };

export type InvoiceTotals = {
  subtotal: number;
  tax: number;
  total: number;
};

/**
 * What is owed, in cents.
 *
 * Tax is taken on the subtotal as a whole rather than line by line, so a
 * discount reduces the tax with it — which is what a discount means. Rounding
 * happens once, here, at the only point where a fraction of a cent exists.
 */
export function invoiceTotals(lines: Priced[], taxRateBp: number): InvoiceTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  // Math.round, not a truncation: half a cent belongs to whoever it is nearer.
  const tax = Math.round((subtotal * taxRateBp) / 10000);
  return { subtotal, tax, total: subtotal + tax };
}

/**
 * Cents to "$1,081.42".
 *
 * Not lib/quote.ts's `money()`, which prints whole dollars: that is right for
 * a quote assembled from a rate card of round numbers, and wrong the moment
 * tax introduces cents.
 */
export function invoiceMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 825 → "8.25%". Trailing zeros trimmed, so 800 reads "8%" rather than "8.00%". */
export function taxRateLabel(bp: number): string {
  return `${(bp / 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

/** Cents to what belongs in a text box Nick edits: "1250.50", no symbol, no commas. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
