'use client';

import { useState, useTransition } from 'react';
import { SlotPicker } from '@/app/book/SlotPicker';
import { cancelMyBookingAction, rescheduleMyBookingAction } from './actions';

/**
 * Reschedule and Cancel, on the agent's "Shoot booked" page. Shown only while
 * the booking can still change (48 hours or more out); inside that, the page
 * says to contact Nick instead. The server re-checks all of it either way.
 */
export default function ManageBooking({
  slug,
  address,
  when,
  canChange,
  cutoffHours,
}: {
  slug: string;
  address: string;
  /** The booked time, already formatted in Nick's time zone. */
  when: string;
  canChange: boolean;
  cutoffHours: number;
}) {
  const [mode, setMode] = useState<'idle' | 'moving'>('idle');
  const [slot, setSlot] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [movedTo, setMovedTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canChange) {
    return (
      <p className="pbooked-manage-note">
        Need to change it? The shoot is less than {cutoffHours} hours away, so please reply to your
        confirmation email, or email{' '}
        <a href="mailto:nblackhall@blackhallmediagroup.com">nblackhall@blackhallmediagroup.com</a>.
      </p>
    );
  }

  const move = () =>
    startTransition(async () => {
      setError(null);
      const result = await rescheduleMyBookingAction(slug, slot);
      if (result.error) {
        setError(result.error);
        // A taken slot is gone from the list only after a fresh look.
        if (result.code === 'slot_taken') setSlot('');
        return;
      }
      setMovedTo(result.movedTo ?? null);
      setMode('idle');
      setSlot('');
    });

  const cancel = () => {
    if (
      !confirm(
        `Cancel your shoot at ${address} on ${when}?\n\nThe time is released and can be booked by someone else.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      // On success this redirects to the listings page; only a refusal returns.
      const result = await cancelMyBookingAction(slug);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="pbooked-manage">
      {movedTo && (
        <p className="pbooked-flash" role="status">
          Moved to {movedTo}. We&rsquo;ve emailed you the new time.
        </p>
      )}

      {mode === 'moving' ? (
        <div className="pbooked-move">
          <SlotPicker value={slot} onChange={setSlot} purpose="reschedule" />
          <div className="pbooked-actions">
            <button className="btn btn-primary" type="button" onClick={move} disabled={!slot || pending}>
              {pending ? 'Moving…' : 'Move my shoot'}
            </button>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => {
                setMode('idle');
                setSlot('');
                setError(null);
              }}
              disabled={pending}
            >
              Keep my time
            </button>
          </div>
        </div>
      ) : (
        <div className="pbooked-actions">
          <button className="btn btn-outline" type="button" onClick={() => setMode('moving')} disabled={pending}>
            Reschedule
          </button>
          <button className="btn btn-outline" type="button" onClick={cancel} disabled={pending}>
            {pending ? 'Cancelling…' : 'Cancel booking'}
          </button>
        </div>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <p className="pbooked-manage-note">
        You can reschedule or cancel here up to {cutoffHours} hours before the shoot.
      </p>
    </div>
  );
}
