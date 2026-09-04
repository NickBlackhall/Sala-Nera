'use client';

import { useState } from 'react';

export default function LoginForm({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    try {
      const r = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(r.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  // Deliberately identical whether or not the address is a client on file.
  if (state === 'sent') {
    return (
      <p className="plogin-sent">
        If that address is on file, a sign-in link is on its way. It expires in
        15 minutes.
      </p>
    );
  }

  return (
    <form className="form plogin-form" onSubmit={submit}>
      {expired && (
        <p className="form-error">That link has expired. Enter your email for a new one.</p>
      )}
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          autoComplete="email"
          required
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@brokerage.com"
        />
      </div>
      <button className="btn" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {state === 'error' && (
        <p className="form-error">
          Something went wrong. Email{' '}
          <a href="mailto:nick@blackhallmediagroup.com">nick@blackhallmediagroup.com</a> directly.
        </p>
      )}
    </form>
  );
}
