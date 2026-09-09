'use client';

import { useActionState } from 'react';
import type { ActionState } from './actions';
import type { Listing } from '@/lib/schema';

type ClientOption = { id: number; email: string; company: string | null; name: string | null };

export default function ListingForm({
  action,
  clients,
  listing,
  submitLabel,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  clients: ClientOption[];
  listing?: Listing;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);

  // <input type="date"> wants YYYY-MM-DD; the column is a timestamptz.
  const shootDate = listing?.shootDate
    ? new Date(listing.shootDate).toISOString().slice(0, 10)
    : '';

  return (
    <form className="form admin-form" action={formAction}>
      {listing && <input type="hidden" name="id" value={listing.id} />}

      {state.error && <p className="form-error">{state.error}</p>}

      <div className="field">
        <label htmlFor="address">Address</label>
        <input
          id="address"
          name="address"
          defaultValue={listing?.address ?? ''}
          placeholder="4200 Preston Hollow Lane"
          required
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="slug">
          Portal URL {listing ? '' : '(optional — built from the address)'}
        </label>
        <input
          id="slug"
          name="slug"
          defaultValue={listing?.slug ?? ''}
          placeholder="preston-hollow-lane"
          autoComplete="off"
        />
      </div>

      <div className="admin-form-row">
        <div className="field">
          <label htmlFor="city">City</label>
          <input id="city" name="city" defaultValue={listing?.city ?? ''} placeholder="Dallas, TX" />
        </div>

        <div className="field">
          <label htmlFor="shootDate">Shoot date</label>
          <input id="shootDate" name="shootDate" type="date" defaultValue={shootDate} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="clientId">Client</label>
        <select id="clientId" name="clientId" defaultValue={listing?.clientId ?? ''}>
          <option value="">Unassigned — nobody can sign in and see it</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company || c.name || c.email} ({c.email})
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="coverKey">Cover image</label>
        <input
          id="coverKey"
          name="coverKey"
          defaultValue={listing?.coverKey ?? ''}
          placeholder="/demo/elevation-dusk.jpg"
        />
      </div>

      <label className="admin-check">
        <input
          type="checkbox"
          name="downloadLocked"
          value="unlocked"
          defaultChecked={listing ? !listing.downloadLocked : false}
        />
        <span>Downloads unlocked — the client has paid</span>
      </label>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
