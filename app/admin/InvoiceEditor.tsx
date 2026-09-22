'use client';

import { useActionState, useState } from 'react';
import { centsToInput, invoiceMoney, invoiceTotals } from '@/lib/invoice-math';
import {
  saveInvoiceAction,
  sendInvoiceAction,
  setInvoicePaidAction,
  type InvoiceState,
} from './actions';

/**
 * One row as the editor holds it. The amount is kept as **the text Nick
 * typed**, not a number: a box that reformats "12" into "12.00" under the
 * cursor, or refuses a half-typed "1250.", is a box nobody can type in. It
 * becomes cents once, on the server, when the form is saved.
 */
type Row = { id: string; name: string; amount: string };

/** Enough of a line to render; the server owns the real shape. */
export type EditorLine = { id: string; name: string; amount: number };

const empty = (): Row => ({
  id: globalThis.crypto.randomUUID(),
  name: '',
  amount: '',
});

/** What a row's typed amount is worth, for the running total. Junk counts as zero. */
function cents(amount: string): number {
  const n = Number(amount.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * The invoice Nick edits, on the listing page.
 *
 * Built around the thing he actually does: a client adds a twilight shoot on
 * site, or picks the wrong package on the form, and the invoice has to change
 * after the fact. So every line is editable, lines can be added and removed,
 * and nothing reaches the client until Send is pressed.
 *
 * The totals update as he types, because an invoice you cannot check before
 * sending is an invoice you send wrong.
 */
export default function InvoiceEditor({
  id,
  lines,
  taxRateBp,
  note,
  paymentUrl,
  paidAt,
  paidMethod,
  hasClient,
  sentCount,
  seeded,
}: {
  id: number;
  lines: EditorLine[];
  taxRateBp: number;
  note: string | null;
  paymentUrl: string | null;
  /** Already formatted on the server, so the date cannot differ between server and browser. */
  paidAt: string | null;
  paidMethod: string | null;
  hasClient: boolean;
  sentCount: number;
  /** True when these lines came from the booking and have never been saved. */
  seeded: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    lines.length > 0
      ? lines.map((line) => ({ id: line.id, name: line.name, amount: centsToInput(line.amount) }))
      : [empty()],
  );
  const [rate, setRate] = useState(() => (taxRateBp / 100).toFixed(2).replace(/\.?0+$/, ''));

  const [saveState, save, saving] = useActionState<InvoiceState, FormData>(saveInvoiceAction, {});
  const [paidState, setPaid, settingPaid] = useActionState<InvoiceState, FormData>(setInvoicePaidAction, {});
  const [sendState, send, sending] = useActionState<InvoiceState, FormData>(sendInvoiceAction, {});

  const rateBp = Math.round((Number(rate.replace(/[%\s]/g, '')) || 0) * 100);
  const totals = invoiceTotals(rows.map((row) => ({ amount: cents(row.amount) })), rateBp);
  const paid = paidAt !== null;

  const setRow = (rowId: string, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));

  return (
    <section className="admin-section inv">
      <h2>Invoice</h2>

      {seeded && (
        <p className="admin-muted inv-seeded">
          Started from what they booked. The services are theirs; the amounts are
          zero because the rate card is still placeholders, so put your real
          prices in before you send it.
        </p>
      )}

      <form action={save}>
        <input type="hidden" name="id" value={id} />

        <div className="inv-lines">
          {rows.map((row) => (
            <div className="inv-line" key={row.id}>
              <input type="hidden" name="line-id" value={row.id} />
              <input
                className="inv-name"
                name={`line-${row.id}-name`}
                value={row.name}
                onChange={(e) => setRow(row.id, { name: e.target.value })}
                placeholder="Twilight photos, floor plan, discount…"
                aria-label="Description"
              />
              <div className="inv-amount">
                <span aria-hidden="true">$</span>
                <input
                  name={`line-${row.id}-amount`}
                  value={row.amount}
                  onChange={(e) => setRow(row.id, { amount: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label="Amount in dollars"
                />
              </div>
              <button
                type="button"
                className="inv-remove"
                onClick={() => setRows((c) => (c.length === 1 ? [empty()] : c.filter((r) => r.id !== row.id)))}
                aria-label={`Remove ${row.name || 'this line'}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows((c) => [...c, empty()])}>
          Add a line
        </button>

        <p className="admin-muted inv-hint">
          A negative amount is a discount — type <code>-50</code> for $50 off.
        </p>

        <div className="inv-totals">
          <div>
            <span>Subtotal</span>
            <span>{invoiceMoney(totals.subtotal)}</span>
          </div>
          <div>
            <label htmlFor="inv-rate">Sales tax</label>
            <span className="inv-rate">
              <input
                id="inv-rate"
                name="taxRate"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="decimal"
                aria-label="Tax rate, percent"
              />
              <span aria-hidden="true">%</span>
            </span>
            <span>{invoiceMoney(totals.tax)}</span>
          </div>
          <div className="inv-total">
            <span>Total</span>
            <span>{invoiceMoney(totals.total)}</span>
          </div>
        </div>

        <label className="inv-field">
          <span>Payment link</span>
          <input
            name="paymentUrl"
            defaultValue={paymentUrl ?? ''}
            placeholder="https://buy.stripe.com/…"
            inputMode="url"
          />
          <small className="admin-muted">
            Make a payment link in Stripe for the total above, then paste it here.
            The client gets a Pay button in the email and on their gallery. Leave
            it empty and they just see the invoice.
          </small>
        </label>

        <label className="inv-field">
          <span>Note to the client</span>
          <textarea name="note" defaultValue={note ?? ''} rows={2} placeholder="Optional — due on receipt, thanks, anything." />
        </label>

        <div className="inv-actions">
          <button className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save invoice'}
          </button>
          {saveState.saved && <span className="inv-ok">{saveState.saved}</span>}
          {saveState.error && <span className="inv-bad">{saveState.error}</span>}
        </div>
      </form>

      <div className="inv-foot">
        <form action={setPaid} className="inv-paid">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="paid" value={paid ? 'false' : 'true'} />
          {paid ? (
            <>
              <p>
                <strong>Paid</strong> {paidAt}
                {paidMethod ? ` · ${paidMethod}` : ''} · downloads are unlocked.
              </p>
              <button className="btn btn-outline btn-sm" disabled={settingPaid}>
                {settingPaid ? 'Working…' : 'Mark unpaid and relock'}
              </button>
            </>
          ) : (
            <>
              <label className="inv-method">
                <span>How they paid</span>
                <input name="method" placeholder="Stripe, check, Zelle…" />
              </label>
              <button className="btn" disabled={settingPaid}>
                {settingPaid ? 'Working…' : 'Mark paid and unlock downloads'}
              </button>
            </>
          )}
          {paidState.saved && <span className="inv-ok">{paidState.saved}</span>}
          {paidState.error && <span className="inv-bad">{paidState.error}</span>}
        </form>

        <form action={send} className="inv-send">
          <input type="hidden" name="id" value={id} />
          <button className="btn btn-outline" disabled={sending || !hasClient}>
            {sending ? 'Sending…' : sentCount > 0 ? 'Send updated invoice' : 'Send invoice'}
          </button>
          {!hasClient && <span className="admin-muted">Assign an agent first.</span>}
          {sentCount > 0 && hasClient && (
            <span className="admin-muted">
              Sent {sentCount} {sentCount === 1 ? 'time' : 'times'} already — save your
              changes first, then send again.
            </span>
          )}
          {sendState.sent && <span className="inv-ok">{sendState.sent}</span>}
          {sendState.error && <span className="inv-bad">{sendState.error}</span>}
        </form>
      </div>
    </section>
  );
}
