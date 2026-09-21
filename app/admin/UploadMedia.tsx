'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addMediaAction, createUploadUrlAction } from './actions';
import { runCopies } from './MakePreviews';

type Row = {
  name: string;
  status: 'uploading' | 'waiting' | 'preparing' | 'done' | 'error';
  detail?: string;
};

/** Upload one file and record it. A photo's id comes back so its copies can follow. */
async function uploadOne(
  listingId: number,
  file: File,
): Promise<{ row: Row; photoId?: number }> {
  const name = file.name;
  const signed = await createUploadUrlAction({
    listingId,
    filename: file.name,
    contentType: file.type,
  });
  if ('error' in signed) return { row: { name, status: 'error', detail: signed.error } };

  const put = await fetch(signed.url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) {
    return { row: { name, status: 'error', detail: `Upload failed (${put.status}).` } };
  }

  const result = await addMediaAction({
    listingId,
    r2Key: signed.key,
    filename: file.name,
    contentType: file.type,
    bytes: file.size,
  });
  if ('error' in result) return { row: { name, status: 'error', detail: result.error } };

  return result.kind === 'photo'
    ? { row: { name, status: 'waiting' }, photoId: result.id }
    : { row: { name, status: 'done' } };
}

export default function UploadMedia({ listingId }: { listingId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const patch = (index: number, next: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r)));

  async function handleFiles(files: FileList) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setBusy(true);
    setRows(list.map((f) => ({ name: f.name, status: 'uploading' })));

    // Every file goes up first, then the previews are made. Server actions
    // run one at a time, so making a preview between uploads would hold up
    // the next file rather than overlap with it.
    //
    // A dropped connection partway through a large video throws rather than
    // returning, so each file is caught on its own: one failure reports on its
    // own row and the rest still go up.
    const photos = new Map<number, number>(); // media id → row index
    for (let i = 0; i < list.length; i++) {
      try {
        const { row, photoId } = await uploadOne(listingId, list[i]);
        patch(i, row);
        if (photoId !== undefined) photos.set(photoId, i);
      } catch {
        patch(i, { status: 'error', detail: 'Connection lost. Try this one again.' });
      }
    }

    const ids = [...photos.keys()];
    ids.forEach((id) => patch(photos.get(id)!, { status: 'preparing' }));
    await runCopies(ids, (id, error) => {
      const index = photos.get(id);
      if (index === undefined) return;
      // The file itself is safely stored either way; only its preview is
      // missing, and the "Make previews" button below can retry it.
      patch(
        index,
        error
          ? { status: 'error', detail: 'Uploaded, but its preview could not be made.' }
          : { status: 'done' },
      );
    });

    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
    router.refresh();
  }

  return (
    <div className="admin-upload">
      <label className="btn btn-outline">
        {busy ? 'Uploading…' : 'Upload photos or video'}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
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
                {row.status === 'waiting' && 'Uploaded'}
                {row.status === 'preparing' && 'Preparing preview…'}
                {row.status === 'done' && 'Done'}
                {row.status === 'error' && (row.detail ?? 'Failed')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
