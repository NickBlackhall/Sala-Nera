'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { intoColumns } from '@/app/components/Gallery';
import { useReveal } from '@/app/components/useReveal';
import type { PropertyPhoto } from '@/lib/property-site';

/** Wider than 2:1 — a panorama is lost in a column, so it spans the page instead. */
const isPano = (p: PropertyPhoto) => p.width / p.height >= 2;

/** One section of the page: the ground photos, or the aerials. */
export type PhotoGroup = { id: string; label: string; photos: PropertyPhoto[] };

type Segment = { pano: PropertyPhoto } | { run: PropertyPhoto[] };

/** Consecutive ordinary photos become one run of columns; each panorama breaks the run. */
function segments(photos: PropertyPhoto[]): Segment[] {
  const out: Segment[] = [];
  for (const photo of photos) {
    const last = out[out.length - 1];
    if (isPano(photo)) out.push({ pano: photo });
    else if (last && 'run' in last) last.run.push(photo);
    else out.push({ run: [photo] });
  }
  return out;
}

/**
 * The property website's photos: large, uncropped, in Nick's order read left
 * to right, and click-to-enlarge. Nothing here downloads — that is the
 * delivery page's job, behind a login.
 */
export default function PropertyGallery({ groups, address }: { groups: PhotoGroup[]; address: string }) {
  // One run for the lightbox, in the order the page shows them, so stepping
  // through carries on from the last ground photo into the first aerial.
  const photos = useMemo(() => groups.flatMap((g) => g.photos), [groups]);
  const [cols, setCols] = useState(3);
  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  useReveal(grid, [cols, photos.length]);

  useEffect(() => {
    const set = () => setCols(window.innerWidth < 640 ? 1 : window.innerWidth < 1100 ? 2 : 3);
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, []);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (dir: number) => setOpen((i) => (i === null ? i : (i + dir + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return;
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
  }, [open, close, step]);

  // A tile that spans the page is wider than the grid copy, so it takes the large one.
  const tile = (photo: PropertyPhoto, wide = false) => {
    const i = photos.indexOf(photo);
    return (
      <button
        className="psite-tile"
        data-reveal
        key={photo.id}
        onClick={() => setOpen(i)}
        aria-label={`Enlarge photo ${i + 1} of ${photos.length}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wide ? photo.largeUrl : photo.gridUrl}
          alt={`${address}, photo ${i + 1}`}
          width={photo.width}
          height={photo.height}
          loading={i < 6 ? 'eager' : 'lazy'}
        />
      </button>
    );
  };

  const current = open === null ? null : photos[open];

  return (
    <>
      <div className="psite-groups" ref={grid}>
        {groups.map((group, gi) => (
          <section className="psite-photos" id={group.id} aria-label={group.label} key={group.id}>
            {/* The first section follows the bar and needs no title of its own. */}
            {gi > 0 && <h2 className="psite-group-title">{group.label}</h2>}
            {segments(group.photos).map((segment) =>
              'pano' in segment ? (
                <div className="psite-pano" key={`pano-${segment.pano.id}`}>{tile(segment.pano, true)}</div>
              ) : (
                <div className="psite-cols" key={`run-${segment.run[0].id}`}>
                  {/* Never more columns than photos: two aerials share the row, one fills it. */}
                  {intoColumns(segment.run, Math.min(cols, segment.run.length)).map((col, ci) => (
                    <div className="psite-col" key={ci}>
                      {col.map((photo) => tile(photo, segment.run.length === 1))}
                    </div>
                  ))}
                </div>
              ),
            )}
          </section>
        ))}
      </div>

      {current && open !== null && (
        <div
          className="lb"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${open + 1} of ${photos.length}`}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}
        >
          <button className="lb-close" onClick={close} aria-label="Close">✕</button>
          <button className="lb-prev" onClick={() => step(-1)} aria-label="Previous">‹</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lb-img" src={current.largeUrl} alt={`${address}, photo ${open + 1}`} />
          <button className="lb-next" onClick={() => step(1)} aria-label="Next">›</button>
          <div className="lb-meta">
            <span>{open + 1} / {photos.length}</span>
          </div>
        </div>
      )}
    </>
  );
}
