'use client';

import { useActionState } from 'react';
import type { ActionState } from './actions';
import type { Client } from '@/lib/schema';

export default function ClientForm({
  action,
  client,
  submitLabel,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  client?: Client;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);

  return (
    <form className="form admin-form" action={formAction}>
      {client && <input type="hidden" name="id" value={client.id} />}

      {state.error && <p className="form-error">{state.error}</p>}

      <div className="field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={client?.email ?? ''}
          placeholder="agent@brokerage.com"
          required
          autoComplete="off"
        />
      </div>

      <div className="admin-form-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" defaultValue={client?.name ?? ''} />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" defaultValue={client?.phone ?? ''} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="company">Brokerage</label>
        <input id="company" name="company" defaultValue={client?.company ?? ''} />
      </div>

      <div className="field">
        <label htmlFor="team">Team</label>
        <input
          id="team"
          name="team"
          defaultValue={client?.team ?? ''}
          placeholder="briggs-freeman"
        />
      </div>
      <p className="form-note">
        Clients sharing a team see and download each other&rsquo;s listings. Leave
        it blank unless you mean that — an empty team never matches another
        empty one.
      </p>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
