'use client';

import { useEffect, useState } from 'react';

/**
 * Picking a real slot off Nick's real calendar.
 *
 * Every time shown here is one the server said was open, and picking one is a
 * booking rather than a request. The old free-text date field is still in this
 * file, though, as the fallback: if availability cannot be loaded — Google
 * unreachable, the credential not yet set, the database refusing — the form
 * quietly returns to asking for a preferred date and Nick confirms it by hand,
 * exactly as it worked before any of this existed.
 *
 * That fallback is the point rather than an afterthought. The alternative is a
 * booking form that dead-ends on an outage, and a lost lead is worse than a
 * lead that needs a phone call.
 */

type Availability = {
  available: boolean;
  timeZone: string;
  days: { date: string; label: string; starts: { at: string; label: string }[] }[];
};

const VISIBLE_DAYS = 8;

export function SlotPicker({
  value,
  onChange,
  fallbackDate,
  onFallbackDate,
  onLive,
  today,
}: {
  value: string;
  onChange: (slot: string) => void;
  fallbackDate: string;
  onFallbackDate: (date: string) => void;
  /**
   * Whether real times are on offer. The form needs this to know if a missing
   * slot is something to stop the client for, or simply the fallback doing its
   * job — in which case there is no slot to pick and never was.
   */
  onLive: (live: boolean) => void;
  today: string;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/booking/availability');
        if (!res.ok) throw new Error(String(res.status));
        const body: Availability = await res.json();
        if (!live) return;
        if (!body.available || body.days.length === 0) {
          onLive(false);
          return setState('unavailable');
        }
        setAvailability(body);
        setState('ready');
        onLive(true);
      } catch {
        if (!live) return;
        onLive(false);
        setState('unavailable');
      }
    })();
    return () => {
      live = false;
    };
    // Fetched once per mount. onLive is a setState wrapper and stable enough in
    // practice, but listing it would refetch on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'loading') {
    return (
      <div className="field">
        <p className="bk-slot-label">Choose a date</p>
        <p className="field-hint">Checking which dates are open…</p>
      </div>
    );
  }

  if (state === 'unavailable' || !availability) {
    return (
      <div className="field">
        <label>
          Preferred date
          <input type="date" value={fallbackDate} onChange={(e) => onFallbackDate(e.target.value)} min={today} />
        </label>
        <p className="field-hint">
          We can&rsquo;t show live availability just now, so this is a{' '}
          <strong>request, not a confirmation</strong> — we&rsquo;ll come back to you with the
          date or the nearest alternatives.
        </p>
      </div>
    );
  }

  const days = showAll ? availability.days : availability.days.slice(0, VISIBLE_DAYS);
  const chosen = availability.days.find((d) => d.starts.some((s) => s.at === value));
  const active = openDate ?? chosen?.date ?? null;
  const activeDay = availability.days.find((d) => d.date === active);

  return (
    <div className="field">
      <p className="bk-slot-label">Choose a date</p>

      <div className="bk-slot-days">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            className={`bk-slot-day${day.date === active ? ' is-open' : ''}${
              day.date === chosen?.date ? ' is-on' : ''
            }`}
            onClick={() => {
              setOpenDate(day.date);
              // Changing day abandons a time chosen on a different one, rather
              // than leaving a selection the client can no longer see.
              if (chosen && chosen.date !== day.date) onChange('');
            }}
            aria-pressed={day.date === chosen?.date}
          >
            {day.label}
          </button>
        ))}
      </div>

      {!showAll && availability.days.length > VISIBLE_DAYS && (
        <button type="button" className="bk-slot-more" onClick={() => setShowAll(true)}>
          Show all {availability.days.length} available dates
        </button>
      )}

      {activeDay && (
        <>
          <p className="bk-slot-label bk-slot-label-times">Start time on {activeDay.label}</p>
          <div className="bk-slot-times">
            {activeDay.starts.map((start) => (
              <button
                key={start.at}
                type="button"
                className={`bk-slot-time${start.at === value ? ' is-on' : ''}`}
                onClick={() => onChange(start.at)}
                aria-pressed={start.at === value}
              >
                {start.label}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="field-hint">
        {value ? (
          <>
            Booking <strong>{chosen?.label}</strong> at{' '}
            <strong>{chosen?.starts.find((s) => s.at === value)?.label}</strong>. This is{' '}
            <strong>confirmed on the spot</strong> — the slot is held for you as soon as you send
            this. Allow around six hours on site.
          </>
        ) : (
          <>Pick a date, then a start time. Allow around six hours on site.</>
        )}
      </p>
    </div>
  );
}
