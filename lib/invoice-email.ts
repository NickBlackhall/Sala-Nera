/**
 * The invoice email, for the first send and for every change after it.
 *
 * One template, two openings. Nick adds a twilight shoot on site, or fixes a
 * service the agent picked by mistake, and presses send again; the client gets
 * the same document with a line saying it changed. A separate "revised
 * invoice" template would drift out of step with this one the first time
 * either was edited.
 *
 * Plain text, like every other email here, and **no column alignment**. An
 * invoice laid out with padded columns falls apart in the phone mail apps
 * where most agents will open it, which is the same reason the delivery email
 * keeps each sentence on one line.
 */

export type InvoiceEmailLine = {
  name: string;
  /** Already formatted — this module does no arithmetic on money. */
  amount: string;
};

export function invoiceEmail(input: {
  /** True once an invoice has been sent before, which changes only the opening. */
  updated: boolean;
  name: string | null;
  address: string;
  slug: string;
  lines: InvoiceEmailLine[];
  subtotal: string;
  tax: string;
  taxLabel: string;
  total: string;
  /** Nick's own words on the invoice, shown under the lines. */
  note: string | null;
  payUrl: string | null;
  paid: boolean;
  base: string;
}): { subject: string; text: string } {
  const { updated, address, slug, lines, note, payUrl, paid, base } = input;
  const firstName = input.name?.trim().split(/\s+/)[0];

  const subject = paid
    ? `Receipt — ${address}`
    : updated
      ? `Your updated invoice — ${address}`
      : `Your invoice — ${address}`;

  const text = [
    `Hi ${firstName || 'there'},`,
    '',
    paid
      ? `Thank you — your payment for ${address} is received. This is your receipt.`
      : updated
        ? `Your invoice for ${address} has changed. Here it is in full:`
        : `Here is your invoice for ${address}:`,
    '',
    ...lines.map((line) => `  ${line.name}: ${line.amount}`),
    '',
    `Subtotal: ${input.subtotal}`,
    `Sales tax (${input.taxLabel}): ${input.tax}`,
    `Total: ${input.total}`,
    '',
    ...(note ? [note, ''] : []),
    // A paid invoice must never carry a live Pay button: that is how someone
    // pays the same job twice.
    ...(!paid && payUrl ? ['You can pay here:', payUrl, ''] : []),
    'Your gallery, and this invoice, are here:',
    `${base}/portal/${slug}`,
    '',
    "There's no password — sign in with this email address and we'll email you a link.",
    '',
    'Questions, or anything to change? Just reply to this email.',
    '',
    '— Sala Nera',
    '  A Blackhall Media Group collection · Dallas–Fort Worth',
  ].join('\n');

  return { subject, text };
}
