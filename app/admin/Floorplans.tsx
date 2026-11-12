'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addFloorplanAction,
  createFloorplanUploadUrlAction,
  deleteFloorplanAction,
  renameFloorplanAction,
} from './floorplan-actions';

export type PlanView = {
  id: number;
  filename: string;
  label: string | null;
  width: number | null;
  height: number | null;
  /** Null when its smaller copy could not be made; it then stays off the site. */
  previewUrl: string | null;
};

type Row = { name: string; status: 'uploading' | 'done' | 'error'; detail?: string };

async function uploadOne(listingId: number, file: File): Promise<Row> {
  const name = file.name;
  const signed = await createFloorplanUploadUrlAction({ listingId, filename: name, contentType: file.type });
  if ('error' in signed) return { name, status: 'error', detail: signed.error };

  const put = await fetch(signed.url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!put.ok) return { name, status: 'error', detail: `Upload failed (${put.status}).` };

  const added = await addFloorplanAction({ listingId, r2Key: signed.key, filename: name, bytes: file.size });
  return added.error ? { name, status: 'error', detail: added.error } : { name, status: 'done' };
}

/** One plan: its picture, a label Nick can change, and Delete. */
function Plan({ plan }: { plan: PlanView }) {
  const [label, setLabel] = useState(plan.label ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const router = useRouter();
  const changed = label.trim() !== (plan.label ?? '');

  async function save() {
    setState('saving');
    const result = await renameFloorplanAction({ id: plan.id, label });
    setState(result.error ? 'error' : 'saved');
    if (!result.error) router.refresh();
  }

  return (
    <li>
      {plan.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={plan.previewUrl} alt="" loading="lazy" />
      ) : (
        <span className="admin-media-novideo">No preview</span>
      )}
      <div>
        <label className="admin-plan-label">
          <span className="admin-muted">Label shown to visitors</span>
          <input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setState('idle');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && changed) save();
            }}
            placeholder="e.g. First floor"
            maxLength={80}
          />
        </label>
        <span className="admin-muted">
          {plan.filename}
          {plan.width && plan.height ? ` · ${plan.width}×${plan.height}` : ''}
        </span>
        <div className="admin-media-actions">
          <button type="button" onClick={save} disabled={!changed || state === 'saving'}>
            {state === 'saving' ? 'Saving…' : state === 'saved' && !changed ? 'Saved' : state === 'error' ? 'Try again' : 'Save label'}
          </button>
          <form
            action={deleteFloorplanAction}
            onSubmit={(e) => {
              if (!window.confirm(`Delete ${plan.label || plan.filename}? This removes the file.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={plan.id} />
            <button type="submit" className="admin-media-delete">Delete</button>
          </form>
        </div>
      </div>
    </li>
  );
}

/**
 * The floor plans on a listing: upload several at once, label each, delete.
 * `canUpload` is false until storage is connected, like the media uploader.
 */
export default function Floorplans({
  listingId,
  plans,
  canUpload,
  needsMigration = false,
}: {
  listingId: number;
  plans: PlanView[];
  canUpload: boolean;
  needsMigration?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFiles(files: FileList) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    setRows(list.map((f) => ({ name: f.name, status: 'uploading' })));
    for (let i = 0; i < list.length; i++) {
      let row: Row;
      try {
        row = await uploadOne(listingId, list[i]);
      } catch {
        row = { name: list[i].name, status: 'error', detail: 'Connection lost. Try this one again.' };
      }
      setRows((prev) => prev.map((r, j) => (j === i ? row : r)));
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
    router.refresh();
  }

  return (
    <section className="admin-section">
      <h2>Floor plans ({plans.length})</h2>
      <p className="admin-muted admin-media-hint">
        JPG or PNG, as many versions as you like. They show on the property website (both versions) and
        the client downloads them from their delivery page once the listing is unlocked. Use files with
        no logo or agent name on them: the MLS version shows them too.
      </p>

      {canUpload && (
        <div className="admin-upload">
          <label className="btn btn-outline">
            {busy ? 'Uploading…' : 'Upload floor plans'}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={busy}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              hidden
            />
          </label>
          {rows.length > 0 && (
            <ul className="admin-upload-rows">
              {rows.map((row, i) => (
                <li key={`${row.name}-${i}`} className={`admin-upload-row admin-upload-${row.status}`}>
                  <span>{row.name}</span>
                  <span className="admin-muted">
                    {row.status === 'uploading' && 'Uploading…'}
                    {row.status === 'done' && 'Done'}
                    {row.status === 'error' && (row.detail ?? 'Failed')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {needsMigration ? (
        <p className="admin-empty">
          Floor plans need one database update before they can be uploaded (migration 0011). The upload
          button appears here as soon as it has run.
        </p>
      ) : plans.length === 0 ? (
        <p className="admin-empty">No floor plans yet.</p>
      ) : (
        <ul className="admin-media admin-plans">
          {plans.map((plan) => (
            <Plan key={plan.id} plan={plan} />
          ))}
        </ul>
      )}
    </section>
  );
}
