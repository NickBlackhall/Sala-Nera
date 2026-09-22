import { invoiceMoney, invoiceTotals, taxRateLabel } from '@/lib/invoice-math';
import type { Invoice as InvoiceRow } from '@/lib/schema';

/**
 * What the client owes, and how to pay it.
 *
 * This is the gap it exists to close: before it, a locked gallery said
 * "downloads unlock on payment" and stopped — no amount, no method, no
 * instruction. An agent's only move was to guess that replying to the email
 * worked. Now the number and the button are on the same page as the photos
 * they are waiting for.
 *
 * Shown in three situations, which is why `paid` and `locked` are separate
 * arguments: before the shoot as what they ordered, on a locked gallery as
 * what is owed, and after payment as a receipt. A paid invoice never renders
 * a Pay button — that is how people pay twice.
 */
export default function Invoice({
  invoice,
  heading,
}: {
  invoice: InvoiceRow;
  /** Set by the caller, because the same document is a quote, a bill and a receipt. */
  heading: string;
}) {
  const lines = invoice.lines.filter((line) => line.name.trim() !== '');
  const totals = invoiceTotals(invoice.lines, invoice.taxRateBp);
  const paid = invoice.paidAt !== null;

  return (
    <section className="pinv wrap">
      <div className="pinv-head">
        <p className="kicker kicker--accent">{heading}</p>
        {paid && <p className="pinv-paid">Paid</p>}
      </div>

      <dl className="pinv-lines">
        {lines.map((line) => (
          <div key={line.id}>
            <dt>{line.name}</dt>
            <dd>{invoiceMoney(line.amount)}</dd>
          </div>
        ))}
      </dl>

      <dl className="pinv-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{invoiceMoney(totals.subtotal)}</dd>
        </div>
        {/* A zero-rate invoice shows no tax line rather than "$0.00". */}
        {invoice.taxRateBp > 0 && (
          <div>
            <dt>Sales tax ({taxRateLabel(invoice.taxRateBp)})</dt>
            <dd>{invoiceMoney(totals.tax)}</dd>
          </div>
        )}
        <div className="pinv-total">
          <dt>{paid ? 'Paid' : 'Total'}</dt>
          <dd>{invoiceMoney(totals.total)}</dd>
        </div>
      </dl>

      {invoice.note && <p className="pinv-note">{invoice.note}</p>}

      {!paid &&
        (invoice.paymentUrl ? (
          <p className="pinv-pay">
            <a className="btn" href={invoice.paymentUrl} target="_blank" rel="noopener noreferrer">
              Pay {invoiceMoney(totals.total)} →
            </a>
          </p>
        ) : (
          // No link yet is still better than the silence this replaced: it
          // names the number and says who moves next.
          <p className="pinv-note">
            Payment details are on their way by email — or just reply to any
            email from us and we&rsquo;ll sort it out.
          </p>
        ))}
    </section>
  );
}
