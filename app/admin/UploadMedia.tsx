'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addMediaAction, createUploadUrlAction } from './actions';

type Row = { name: string; status: 'uploading' | 'done' | 'error'; detail?: string };

/** Dimensions for a photo, read in the browser before upload. Video is left null — no cheap way to read it client-side. */
function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return Promise.resolve(null);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

async function uploadOne(listingId: number, file: File): Promise<Row> {
  const signed = await createUploadUrlAction({
    listingId,
    filename: file.name,
    contentType: file.type,
  });
  if ('error' in signed) return { name: file.name, status: 'error', detail: signed.error };

  const put = await fetch(signed.url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) {
    return { name: file.name, status: 'error', detail: `Upload failed (${put.status}).` };
  }

  const size = await imageSize(file);
  const result = await addMediaAction({
    listingId,
    r2Key: signed.key,
    filename: file.name,
    contentType: file.type,
    bytes: file.size,
    width: size?.width ?? null,
    height: size?.height ?? null,
  });
  if (result.error) return { name: file.name, status: 'error', detail: result.error };

  return { name: file.name, status: 'done' };
}

export default function UploadMedia({ listingId }: { listingId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFiles(files: FileList) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setBusy(true);
    setRows(list.map((f) => ({ name: f.name, status: 'uploading' })));

    // A dropped connection partway through a large video throws rather than
    // returning, so each file is caught on its own: one failure reports on its
    // own row and the rest still go up.
    for (let i = 0; i < list.length; i++) {
      let row: Row;
      try {
        row = await uploadOne(listingId, list[i]);
      } catch {
        row = { name: list[i].name, status: 'error', detail: 'Connection lost. Try this one again.' };
      }
      setRows((prev) => prev.map((r, idx) => (idx === i ? row : r)));
    }

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
