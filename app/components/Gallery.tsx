'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Media } from '@/lib/schema';

/**
 * Tiles keep their natural aspect ratio, so verticals are never cropped.
 * Round-robin into flex columns means reading order still runs left→right.
 */
function intoColumns(items: Media[], count: number): Media[][] {
  const cols: Media[][] = Array.from({ length: count }, () => []);
  items.forEach((m, i) => cols[i % count].push(m));
  return cols;
}

export default function Gallery({
  media,
  locked,
  invoiceUrl,
}: {
  media: Media[];
  locked: boolean;
  invoiceUrl?: string | null;
}) {
  const [cols, setCols] = useState(3);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

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
              <button className="btn btn-primary btn-sm">Download Selected ({selected.size})</button>
            )}
            {!locked && <button className="btn btn-outline btn-sm">Download All</button>}
            {!locked && <button className="btn btn-outline btn-sm">MLS Photo Download</button>}
            {invoiceUrl && (
              <a className="btn btn-outline btn-sm" href={invoiceUrl}>
                {locked ? 'Pay Invoice →' : 'View Invoice →'}
              </a>
            )}
          </div>
        </div>
      </div>

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
                    <img src={m.r2Key} alt="" width={m.width ?? 1600} height={m.height ?? 1067} loading="lazy" />
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
          <img className="lb-img" src={current.r2Key} alt="" />
          <button className="lb-next" onClick={() => step(1)} aria-label="Next">›</button>
          <div className="lb-meta">
            <span>{current.filename}</span>
            <span>{(lightbox ?? 0) + 1} / {media.length}</span>
            {!locked && <a href={current.r2Key} download>Download</a>}
          </div>
        </div>
      )}
    </>
  );
}
