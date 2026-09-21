'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { COPIES_BATCH } from '@/lib/media-view';
import { makeCopiesAction } from './actions';

/**
 * Make copies for a list of photos, a batch per call, reporting each photo as
 * it finishes. Shared by the upload flow and the "Make previews" button.
 *
 * A thrown call (a dropped connection, a function that ran out of time) marks
 * its whole batch failed and carries on with the next, so one bad batch never
 * strands the rest.
 */
export async function runCopies(
  ids: number[],
  onResult: (id: number, error?: string) => void,
): Promise<void> {
  for (let i = 0; i < ids.length; i += COPIES_BATCH) {
    const batch = ids.slice(i, i + COPIES_BATCH);
    try {
      const results = await makeCopiesAction(batch);
      for (const r of results) onResult(r.id, r.error);
    } catch {
      for (const id of batch) onResult(id, 'Connection lost while preparing its preview.');
    }
  }
}

/**
 * Shown on a listing whose photos predate smaller copies, or whose copies
 * failed at upload. Until they are made, the gallery loads those photos'
 * full-size originals — which is exactly the slowness this exists to fix.
 */
export default function MakePreviews({ missingIds }: { missingIds: number[] }) {
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  if (missingIds.length === 0) return null;

  async function start() {
    setBusy(true);
    setDone(0);
    setFailed([]);
    await runCopies(missingIds, (_id, error) => {
      setDone((n) => n + 1);
      if (error) setFailed((list) => [...list, error]);
    });
    setBusy(false);
    router.refresh();
  }

  const count = missingIds.length;

  return (
    <div className="admin-previews" role="status">
      <p>
        {busy
          ? `Making previews… ${done} of ${count}`
          : `${count} ${count === 1 ? 'photo has' : 'photos have'} no preview yet, so the gallery loads ${count === 1 ? 'its' : 'their'} full-size ${count === 1 ? 'original' : 'originals'} — that is what makes it slow.`}
      </p>
      {!busy && (
        <button className="btn btn-outline" type="button" onClick={start}>
          Make previews
        </button>
      )}
      {failed.length > 0 && (
        <ul className="admin-previews-errors">
          {failed.map((message, i) => (
            <li key={i}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
