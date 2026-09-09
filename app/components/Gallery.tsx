'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MediaView } from '@/lib/media-view';

/**
 * Tiles keep their natural aspect ratio, so verticals are never cropped.
 * Round-robin into flex columns means reading order still runs left→right.
 */
function intoColumns(items: MediaView[], count: number): MediaView[][] {
  const cols: MediaView[][] = Array.from({ length: count }, () => []);
  items.forEach((m, i) => cols[i % count].push(m));
  return cols;
}

type SignedFile = { id: number; filename: string; url: string };

/**
 * Saving several files means several navigations, spaced out. Browsers cancel
 * downloads fired in one tick and some treat a burst as a popup attack, so this
 * paces them. The `download` attribute only binds same-origin — for R2 URLs it
 * is the signed Content-Disposition that names the file, which is why the
 * download route bothers to set one.
 */
async function saveAll(files: SignedFile[]): Promise<void> {
  for (const file of files) {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (files.length > 1) await new Promise((r) => setTimeout(r, 300));
  }
}

export default function Gallery({
  slug,
  media,
  locked,
  invoiceUrl,
}: {
  slug: string;
  media: MediaView[];
  locked: boolean;
  invoiceUrl?: string | null;
}) {
  const [cols, setCols] = useState(3);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<null | 'selected' | 'all'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const set = () => setCols(window.innerWidth < 640 ? 2 : window.innerWidth < 1100 ? 3 : 4);
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, []);

  const close = useCallback(() => setLightbox(null), []);
  const step = useCallback(
    (dir: number) =>
      setLightbox((i) => (i === null ? i : (i + dir + media.length) % media.length)),
    [media.length],
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('menu-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('menu-open');
    };
  }, [lightbox, close, step]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /**
   * Ask the server to mint signed URLs, then save them. Nothing here decides
   * whether the download is allowed — the route re-checks ownership and the
   * payment lock, so hiding these buttons is presentation, not the gate.
   */
  async function download(which: 'selected' | 'all') {
    if (busy) return;
    setBusy(which);
    setError(null);

    try {
      const response = await fetch('/api/portal/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          ids: which === 'selected' ? [...selected] : undefined,
        }),
      });

      if (!response.ok) {
        // A 404 here is the deliberately ambiguous answer from the route, so it
        // gets the generic wording rather than a guess at which cause it was.
        const message =
          response.status === 403
            ? 'This gallery is awaiting payment.'
            : 'That download is not available. Try signing in again.';
        setError(message);
        return;
      }

      const { files } = (await response.json()) as { files: SignedFile[] };
      await saveAll(files);
      if (which === 'selected') setSelected(new Set());
    } catch {
      setError('The download could not be started. Check your connection.');
    } finally {
      setBusy(null);
    }
  }

  const columns = intoColumns(media, cols);
  const current = lightbox === null ? null : media[lightbox];

  return (
    <>
      <div className="gal-bar">
        <div className="gal-bar-inner wrap">
          <span className="gal-count">
            {media.length} images
            {locked && <span className="gal-lock">· previews — downloads unlock on payment</span>}
          </span>
          <div className="gal-actions">
            {selected.size > 0 && !locked && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => download('selected')}
                disabled={busy !== null}
              >
                {busy === 'selected'
                  ? 'Preparing…'
                  : `Download Selected (${selected.size})`}
              </button>
            )}
            {!locked && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => download('all')}
                disabled={busy !== null}
              >
                {busy === 'all' ? 'Preparing…' : 'Download All'}
              </button>
            )}
            {!locked && (
              <button
                className="btn btn-outline btn-sm"
                disabled
                title="MLS-size exports arrive with the upload pipeline — these are full resolution."
              >
                MLS Photo Download
              </button>
            )}
            {invoiceUrl && (
              <a className="btn btn-outline btn-sm" href={invoiceUrl}>
                {locked ? 'Pay Invoice →' : 'View Invoice →'}
              </a>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="wrap">
          <p className="gal-error" role="alert">{error}</p>
        </div>
      )}

      <div className="gal-cols wrap">
        {columns.map((col, ci) => (
          <div className="gal-col" key={ci}>
            {col.map((m) => {
              const i = media.indexOf(m);
              return (
                <figure className={`tile${locked ? ' tile--locked' : ''}`} key={m.id}>
                  <button
                    className="tile-open"
                    onClick={() => setLightbox(i)}
                    aria-label={`Open ${m.filename}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.previewUrl} alt="" width={m.width ?? 1600} height={m.height ?? 1067} loading="lazy" />
                    {locked && <span className="tile-wm" aria-hidden="true">SALA NERA</span>}
                  </button>
                  {!locked && (
                    <label className="tile-check">
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggle(m.id)}
                      />
                      <span className="sr-only">Select {m.filename}</span>
                    </label>
                  )}
                </figure>
              );
            })}
          </div>
        ))}
      </div>

      {current && (
        <div className="lb" role="dialog" aria-modal="true" aria-label={current.filename}>
          <button className="lb-close" onClick={close} aria-label="Close">✕</button>
          <button className="lb-prev" onClick={() => step(-1)} aria-label="Previous">‹</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lb-img" src={current.previewUrl} alt="" />
          <button className="lb-next" onClick={() => step(1)} aria-label="Next">›</button>
          <div className="lb-meta">
            <span>{current.filename}</span>
            <span>{(lightbox ?? 0) + 1} / {media.length}</span>
            {/* Straight to the route, not the preview URL: it re-checks the lock
                and records the download, which a link to the image would skip. */}
            {!locked && <a href={`/api/portal/download/${current.id}`}>Download</a>}
          </div>
        </div>
      )}
    </>
  );
}
