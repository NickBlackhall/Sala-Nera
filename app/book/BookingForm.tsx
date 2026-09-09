'use client';

import { useMemo, useState } from 'react';
import { money, quote } from '@/lib/quote';
import { RATES_ARE_PLACEHOLDER, RATE_NOTES, SERVICES } from '@/lib/rates';

/**
 * Five steps, because a single long form is where bookings go to be abandoned.
 * The running estimate is visible from the moment it can say anything true —
 * showing a price is the whole point of the form, and it is what filters out
 * the agents who were never going to pay it.
 *
 * The estimate here is a courtesy, not a contract. app/api/booking/route.ts
 * recomputes it from the same rate card before anything reaches Nick's inbox.
 */

type State = 'idle' | 'sending' | 'sent' | 'error';

const STEPS = ['Contact', 'Property', 'Services', 'Notes', 'Review'] as const;

const CORE = SERVICES.filter((s) => s.group === 'core');
const ADDONS = SERVICES.filter((s) => s.group === 'addon');

/** Today in the local timezone, as the date input wants it. */
function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function BookingForm() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  const [startedAt] = useState(() => Date.now());
  const [requestId] = useState(
    () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const [f, setF] = useState({
    name: '', email: '', phone: '', brokerage: '',
    address: '', sqft: '', accessNotes: '', desiredDate: '',
    notes: '', company: '', // company is the honeypot
  });
  const [services, setServices] = useState<string[]>([]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const sqftNumber = useMemo(() => {
    const n = Number(f.sqft.replace(/[^0-9]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [f.sqft]);

  const estimate = useMemo(() => quote(sqftNumber, services), [sqftNumber, services]);

  function toggle(id: string) {
    setServices((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  /** Each step names what it needs, so nobody reaches Review missing an email. */
  function problemWith(index: number): string | null {
    if (index === 0) {
      if (!f.name.trim()) return 'Your name, so we know who we are talking to.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return 'A valid email address.';
    }
    if (index === 1 && !f.address.trim()) return 'The property address.';
    if (index === 2 && services.length === 0) return 'At least one service.';
    return null;
  }

  function next() {
    const problem = problemWith(step);
    if (problem) return setError(problem);
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    for (let i = 0; i < STEPS.length; i += 1) {
      const problem = problemWith(i);
      if (problem) {
        setStep(i);
        return setError(problem);
      }
    }

    setState('sending');
    setError(null);

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          sqft: sqftNumber,
          services,
          estimate: estimate.total,
          startedAt,
          requestId,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState('sent');
    } catch {
      // Never claim a booking landed when it did not — a lost lead that thinks
      // it was received is the worst outcome this form has.
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div className="form-success show" tabIndex={-1} role="status">
        <h3>Booking request received.</h3>
        <p>
          We&rsquo;ll confirm {f.desiredDate ? `${f.desiredDate} ` : 'your date '}
          or offer the nearest alternatives, usually within one business day. Nothing is
          locked in until you hear back from us.
        </p>
      </div>
    );
  }

  return (
    <form className="bk" onSubmit={submit} noValidate>
      <ol className="bk-steps" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`bk-step${i === step ? ' is-current' : ''}${i < step ? ' is-done' : ''}`}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="bk-step-n">{i + 1}</span>
            <span className="bk-step-l">{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <fieldset className="bk-panel">
          <legend className="bk-legend">Who are we working with?</legend>
          <div className="field">
            <label>Name<input type="text" value={f.name} onChange={set('name')} autoComplete="name" required placeholder="Your name" /></label>
          </div>
          <div className="field">
            <label>Email<input type="email" value={f.email} onChange={set('email')} autoComplete="email" required placeholder="you@brokerage.com" /></label>
          </div>
          <div className="field">
            <label>Phone<input type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder="Optional, but faster" /></label>
          </div>
          <div className="field">
            <label>Brokerage<input type="text" value={f.brokerage} onChange={set('brokerage')} autoComplete="organization" placeholder="Optional" /></label>
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="bk-panel">
          <legend className="bk-legend">The property</legend>
          <div className="field">
            <label>Address<input type="text" value={f.address} onChange={set('address')} required placeholder="Street, city" /></label>
          </div>
          <div className="field">
            <label>
              Square footage
              <input type="text" inputMode="numeric" value={f.sqft} onChange={set('sqft')} placeholder="e.g. 3,200" />
            </label>
            <p className="field-hint">Square footage sets the tier, so the estimate moves as you type.</p>
          </div>
          <div className="field">
            <label>
              Preferred date
              <input type="date" value={f.desiredDate} onChange={set('desiredDate')} min={today()} />
            </label>
            <p className="field-hint">
              This is a <strong>request, not a confirmation</strong> — we&rsquo;ll come back to you
              with the date or the nearest alternatives.
            </p>
          </div>
          <div className="field">
            <label>
              Access notes
              <textarea value={f.accessNotes} onChange={set('accessNotes')} placeholder="Lockbox, gate code, tenant occupied, pets, parking…" />
            </label>
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="bk-panel">
          <legend className="bk-legend">What should we shoot?</legend>

          <p className="bk-group-label">The shoot</p>
          <div className="bk-cards">
            {CORE.map((s) => (
              <ServiceCard key={s.id} id={s.id} name={s.name} blurb={s.blurb}
                price={priceLabel(s.id, estimate)} on={services.includes(s.id)} onToggle={() => toggle(s.id)} />
            ))}
          </div>

          <p className="bk-group-label">Add-ons</p>
          <div className="bk-cards">
            {ADDONS.map((s) => (
              <ServiceCard key={s.id} id={s.id} name={s.name} blurb={s.blurb}
                price={priceLabel(s.id, estimate)} on={services.includes(s.id)} onToggle={() => toggle(s.id)} />
            ))}
          </div>

          <ul className="bk-notes">
            {RATE_NOTES.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </fieldset>
      )}

      {step === 3 && (
        <fieldset className="bk-panel">
          <legend className="bk-legend">Anything else?</legend>
          <div className="field">
            <label>
              <span className="sr-only">Anything else</span>
              <textarea value={f.notes} onChange={set('notes')} rows={7}
                placeholder="Timeline, listing date, what makes this property worth the collection, anything unusual about the space…" />
            </label>
          </div>
        </fieldset>
      )}

      {step === 4 && (
        <fieldset className="bk-panel">
          <legend className="bk-legend">Look it over</legend>
          <dl className="bk-review">
            <Row k="Name" v={f.name} />
            <Row k="Email" v={f.email} />
            <Row k="Phone" v={f.phone} />
            <Row k="Brokerage" v={f.brokerage} />
            <Row k="Address" v={f.address} />
            <Row k="Square footage" v={sqftNumber ? sqftNumber.toLocaleString('en-US') : ''} />
            <Row k="Preferred date" v={f.desiredDate ? `${f.desiredDate} — requested, not confirmed` : ''} />
            <Row k="Access notes" v={f.accessNotes} />
            <Row k="Anything else" v={f.notes} />
          </dl>

          <p className="bk-group-label">Selected</p>
          <ul className="bk-lines">
            {estimate.lines.map((l) => (
              <li key={l.id}>
                <span>{l.name}</span>
                <span className={l.amount === null ? 'bk-tbd' : undefined}>
                  {l.amount === null ? (l.note ?? 'Quoted after') : money(l.amount)}
                </span>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {/* Honeypot: only a bot fills this in. */}
      <div className="hp" aria-hidden="true">
        <label>Company<input type="text" name="company" value={f.company} onChange={set('company')} tabIndex={-1} autoComplete="off" /></label>
      </div>

      {step >= 1 && (
        <div className="bk-total" aria-live="polite">
          <div>
            <span className="bk-total-k">Estimate</span>
            <span className="bk-total-v">{money(estimate.total)}</span>
            {estimate.hasQuotedItems && <span className="bk-total-plus">+ items quoted after</span>}
          </div>
          {estimate.tierLabel && <span className="bk-total-tier">{estimate.tierLabel}</span>}
        </div>
      )}

      {RATES_ARE_PLACEHOLDER && (
        <p className="bk-placeholder" role="note">
          <strong>Indicative only.</strong> These figures are placeholders while the rate card is
          finalised — your real quote comes back with our reply.
        </p>
      )}

      {error && <p className="form-error" role="alert">We still need {error}</p>}

      {state === 'error' && (
        <p className="form-error" role="alert">
          Something went wrong on our end and your request didn&rsquo;t send. Please email{' '}
          <a href="mailto:nblackhall@blackhallmediagroup.com">nblackhall@blackhallmediagroup.com</a>{' '}
          directly — we don&rsquo;t want to miss you.
        </p>
      )}

      <div className="bk-nav">
        {step > 0 && (
          <button type="button" className="btn btn-outline" onClick={back}>← Back</button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={next}>Continue →</button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Send booking request'}
          </button>
        )}
      </div>

      <p className="form-note">
        Submitting sends us a brief and reserves nothing. By submitting, you allow Blackhall Media
        Group to use these details to respond. <a href="/privacy">Privacy</a>.
      </p>
    </form>
  );
}

/** The price to show on a card — its own line if chosen, its list price if not. */
function priceLabel(id: string, estimate: ReturnType<typeof quote>): string {
  const line = estimate.lines.find((l) => l.id === id);
  if (line) return line.amount === null ? (line.note ?? 'Quoted after') : money(line.amount);

  const service = SERVICES.find((s) => s.id === id);
  if (!service) return '';
  if (service.pricing.kind === 'flat') return money(service.pricing.price);
  if (service.pricing.kind === 'quoted') return 'Quoted after';
  const cheapest = service.pricing.tiers.find((t) => t.price !== null);
  return cheapest?.price ? `from ${money(cheapest.price)}` : 'Quoted after';
}

function ServiceCard({
  id, name, blurb, price, on, onToggle,
}: {
  id: string; name: string; blurb: string; price: string; on: boolean; onToggle: () => void;
}) {
  return (
    <label className={`bk-card${on ? ' is-on' : ''}`} htmlFor={`svc-${id}`}>
      <input id={`svc-${id}`} type="checkbox" checked={on} onChange={onToggle} />
      <span className="bk-card-body">
        <span className="bk-card-name">{name}</span>
        <span className="bk-card-blurb">{blurb}</span>
      </span>
      <span className="bk-card-price">{price}</span>
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className={v ? undefined : 'bk-empty'}>{v || '—'}</dd>
    </>
  );
}
