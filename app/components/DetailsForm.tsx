'use client';

import { useActionState } from 'react';
import { DETAIL_LIMITS, type ListingDetails } from '@/lib/listing-details';

export type DetailsState = { error?: string; saved?: boolean };

/**
 * The Details form, shared by the agent's delivery page and Nick's admin
 * page. Each passes its own server action, which decides who may save.
 * Every field is optional; a blank one is left off the property website.
 */
export default function DetailsForm({
  action,
  initial,
  note,
}: {
  action: (prev: DetailsState, form: FormData) => Promise<DetailsState>;
  initial: ListingDetails;
  /** One line under the heading, saying where these show. */
  note: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form className="form details-form" action={formAction}>
      <p className="details-form-note">{note}</p>
      {state.error && <p className="form-error">{state.error}</p>}

      <div className="details-form-row">
        <div className="field">
          <label htmlFor="details-beds">Bedrooms</label>
          <input id="details-beds" name="beds" inputMode="numeric" defaultValue={initial.beds ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="details-baths">Bathrooms</label>
          <input
            id="details-baths"
            name="baths"
            defaultValue={initial.baths ?? ''}
            maxLength={DETAIL_LIMITS.baths}
          />
        </div>
        <div className="field">
          <label htmlFor="details-sqft">Square feet</label>
          <input
            id="details-sqft"
            name="sqft"
            inputMode="numeric"
            defaultValue={initial.sqft !== null ? initial.sqft.toLocaleString('en-US') : ''}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="details-school">School district</label>
        <input
          id="details-school"
          name="schoolDistrict"
          defaultValue={initial.schoolDistrict ?? ''}
          placeholder="e.g. Highland Park ISD"
          maxLength={DETAIL_LIMITS.schoolDistrict}
        />
      </div>

      <div className="field">
        <label htmlFor="details-description">Description</label>
        <textarea
          id="details-description"
          name="description"
          rows={6}
          defaultValue={initial.description ?? ''}
          placeholder="A few lines about the home, as you'd write them for the listing."
          maxLength={DETAIL_LIMITS.description}
        />
      </div>

      <div className="details-form-actions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Saving…' : 'Save details'}
        </button>
        {state.saved && !pending && <span className="details-form-saved">Saved</span>}
      </div>
    </form>
  );
}
