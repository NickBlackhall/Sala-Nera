'use client';

import { useState } from 'react';

type State = 'idle' | 'sending' | 'sent' | 'error';

export default function InquiryForm() {
  const [state, setState] = useState<State>('idle');
  const [startedAt] = useState(() => Date.now());
  const [requestId] = useState(() =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('sending');

    const payload: Record<string, FormDataEntryValue | string | number> = Object.fromEntries(
      new FormData(e.currentTarget),
    );
    payload.startedAt = startedAt;
    payload.requestId = requestId;
    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState('sent');
    } catch {
      // Never report success we did not get: a lead that silently vanishes is
      // worse than one that tells the sender to email directly.
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div className="form-success show" tabIndex={-1} role="status">
        <h3>Request received.</h3>
        <p>Thank you — we&rsquo;ll follow up shortly to talk through the property.</p>
      </div>
    );
  }

  return (
    <form className="form" id="accessForm" onSubmit={onSubmit}>
      <div className="field">
        <label>Name<input type="text" name="name" autoComplete="name" required placeholder="Your name" /></label>
      </div>
      <div className="field">
        <label>Email<input type="email" name="email" autoComplete="email" required placeholder="you@brokerage.com" /></label>
      </div>
      <div className="field">
        <label>Property<input type="text" name="property" placeholder="Address or neighborhood" /></label>
      </div>
      <div className="field">
        <label>Tell us about it<textarea name="details" placeholder="Timeline, what makes this property worth the collection…" /></label>
      </div>

      {/* Honeypot: only a bot fills this in. */}
      <div className="hp" aria-hidden="true">
        <label>Company<input type="text" name="company" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <button type="submit" className="btn btn-primary" id="submitBtn" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send Inquiry'}
      </button>
      <p className="form-note">
        We respond personally, usually within one business day. By submitting, you allow Blackhall
        Media Group to use these details to respond to your inquiry. <a href="/privacy">Privacy</a>.
      </p>

      {state === 'error' && (
        <p className="form-error" role="alert">
          Something went wrong on our end and your request didn&rsquo;t send. Please email{' '}
          <a href="mailto:nick@blackhallmediagroup.com">nick@blackhallmediagroup.com</a> directly — we
          don&rsquo;t want to miss you.
        </p>
      )}
    </form>
  );
}
