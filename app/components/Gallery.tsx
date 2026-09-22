'use client';

import { useCallback, useEffect, useState } from 'react';
import VideoPlayer from '@/app/components/VideoPlayer';
import { formatSize, type MediaView } from '@/lib/media-view';

/**
 * Tiles keep their natural aspect ratio, so verticals are never cropped.
 * Round-robin into flex columns means reading order still runs left→right.
 */
export function intoColumns<T>(items: T[], count: number): T[][] {
  const cols: T[][] = Array.from({ length: count }, () => []);
  items.forEach((m, i) => cols[i % count].push(m));
  return cols;
}

/** What the zip route answers — see app/api/portal/download/archive/route.ts. */
type ZipAnswer =
  | { status: 'ready'; url: string; filename: string; bytes: number | null }
  | { status: 'preparing' }
  | { status: 'failed'; error: string };

type Sizes = { high: number | null; low: number | null };
type Available = { high: boolean; low: boolean };

/** How often to ask whether a zip being made is ready, and for how long. */
const POLL_MS = 3000;
const GIVE_UP_MS = 6 * 60_000;

export default function Gallery({
  slug,
  media,
  locked,
  invoiceUrl,
  zipSizes,
}: {
  slug: string;
  media: MediaView[];
  locked: boolean;
  invoiceUrl?: string | null;
  /** Each "Download all photos" zip's size, when it has been made. */
  zipSizes: Sizes;
}) {
  const [cols, setCols] = useState(3);
  const [lightbox, setLightbox] = useState<number | null>(null);
  // Every download on the page — all photos, or one from the lightbox — comes
  // at this size. Starts on high: the full file is what agents expect.
  const [resolution, setResolution] = useState<'high' | 'low'>('high');
  const [sizes, setSizes] = useState<Sizes>(zipSizes);
  const [available, setAvailable] = useState<Available>({
    high: zipSizes.high !== null,
    low: zipSizes.low !== null,
  });
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photos = media.filter((m) => m.kind === 'photo');
  const films = media.filter((m) => m.kind === 'video');

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
      // Arrows inside a video player skip through the film. React listens on
      // the document too, so the player cannot stop this handler; it has to
      // step aside here instead.
      if (e.target instanceof Element && e.target.closest('.vp')) return;
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

  /**
   * Every photo, as one zip at the chosen size. The zip is normally made
   * before the client ever arrives; if it is not, the route starts making it
   * and this asks again every few seconds until it is, then saves it.
   *
   * Nothing here decides whether the download is allowed — the route
   * re-checks ownership and the payment lock, so hiding this button is
   * presentation, not the gate.
   */
  async function downloadAllPhotos() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setPrepared(false);
    const giveUp = Date.now() + GIVE_UP_MS;

    try {
      for (;;) {
        const response = await fetch('/api/portal/download/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, resolution }),
        });

        if (!response.ok) {
          // A 404 here is the deliberately ambiguous answer from the route, so it
          // gets the generic wording rather than a guess at which cause it was.
          setError(
            response.status === 403
              ? 'This gallery is awaiting payment.'
              : 'That download is not available. Try signing in again.',
          );
          return;
        }

        const answer = (await response.json()) as ZipAnswer;
        if (answer.status === 'ready') {
          // Do not synthesize a click on the cross-origin R2 URL. Once this
          // status request says it is ready, render a real same-origin link;
          // the user follows it and the route redirects to R2 like every
          // working single-photo and film download.
          setAvailable((a) => ({ ...a, [resolution]: true }));
          if (answer.bytes) setSizes((s) => ({ ...s, [resolution]: answer.bytes }));
          setPrepared(true);
          return;
        }
        if (answer.status === 'failed') {
          setError(answer.error);
          return;
        }

        setPreparing(true);
        if (Date.now() > giveUp) {
          setError('Your photos are still being prepared. Try again in a few minutes.');
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    } catch {
      setError('The download could not be started. Check your connection.');
    } finally {
      setBusy(false);
      setPreparing(false);
    }
  }

  const columns = intoColumns(media, cols);
  const current = lightbox === null ? null : media[lightbox];
  const archiveUrl = `/api/portal/download/archive?slug=${encodeURIComponent(slug)}&res=${resolution}`;

  return (
    <>
      <div className="gal-bar">
        <div className="gal-bar-inner wrap">
          <span className="gal-count">
            {media.length} images
            {locked && <span className="gal-lock">· previews — downloads unlock on payment</span>}
          </span>
          <div className="gal-actions">
            {!locked && photos.length > 0 && (
              <>
                <div className="gal-res" role="group" aria-label="Download size">
                  <button
                    type="button"
                    aria-pressed={resolution === 'high'}
                    onClick={() => {
                      setResolution('high');
                      setPrepared(false);
                    }}
                    disabled={busy}
                    title="Full size, under 19MB each: MLS and print"
                  >
                    High res{sizes.high ? ` · ${formatSize(sizes.high)}` : ''}
                  </button>
                  <button
                    type="button"
                    aria-pressed={resolution === 'low'}
                    onClick={() => {
                      setResolution('low');
                      setPrepared(false);
                    }}
                    disabled={busy}
                    title="2400px, a fraction of the size: web, social and email"
                  >
                    Low res{sizes.low ? ` · ${formatSize(sizes.low)}` : ''}
                  </button>
                </div>
                {available[resolution] ? (
                  <a
                    className="btn btn-primary btn-sm"
                    href={archiveUrl}
                  >
                    Download all photos
                  </a>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={downloadAllPhotos} disabled={busy}>
                    {preparing ? 'Preparing your photos…' : busy ? 'Starting…' : 'Download all photos'}
                  </button>
                )}
              </>
            )}
            {/* A film is one file, so it downloads on its own, never in the zip. */}
            {!locked &&
              films.map((film) => (
                <a className="btn btn-outline btn-sm" key={film.id} href={`/api/portal/download/${film.id}`}>
                  {films.length === 1 ? 'Download film' : `Download ${film.filename.replace(/\.[^.]*$/, '')}`}
                  {film.bytes ? ` · ${formatSize(film.bytes)}` : ''}
                </a>
              ))}
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
      {preparing && !error && (
        <div className="wrap">
          <p className="gal-note" role="status">
            Preparing your photos for download. The first time can take a minute or two, so keep this page open.
          </p>
        </div>
      )}
      {prepared && available[resolution] && !error && (
        <div className="wrap">
          <p className="gal-note" role="status">
            Your photos are ready. <a href={archiveUrl}>Download them now</a>.
            {' '}On an iPhone the zip is saved to the Files app.
          </p>
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
                    {m.kind === 'video' ? (
                      // Its still in its own shape, or black until it has one.
                      <span
                        className="tile-video"
                        style={m.width && m.height ? ({ '--tile-ratio': `${m.width} / ${m.height}` } as React.CSSProperties) : undefined}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {m.previewUrl && <img src={m.previewUrl} alt="" loading="lazy" />}
                        <span className="tile-play" aria-hidden="true">
                          <svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg>
                        </span>
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.previewUrl ?? undefined} alt="" width={m.width ?? 1600} height={m.height ?? 1067} loading="lazy" />
                    )}
                    {locked && <span className="tile-wm" aria-hidden="true">SALA NERA</span>}
                  </button>
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
          {current.kind === 'video' && current.videoUrl ? (
            <div className="lb-video">
              {/* Keyed, so stepping to another video starts it fresh. Opened by
                  a click, so it may start with sound. */}
              <VideoPlayer
                key={current.id}
                src={current.videoUrl}
                poster={current.largeUrl}
                width={current.width}
                height={current.height}
                label={current.filename}
                watermark={locked}
                autoPlay
              />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="lb-img" src={current.largeUrl ?? undefined} alt="" />
          )}
          <button className="lb-next" onClick={() => step(1)} aria-label="Next">›</button>
          <div className="lb-meta">
            <span>{current.filename}</span>
            <span>{(lightbox ?? 0) + 1} / {media.length}</span>
            {/* Straight to the route, not the preview URL: it re-checks the lock
                and records the download, which a link to the image would skip.
                A film has one size, so it gets no size in its label. */}
            {!locked && (
              <a href={`/api/portal/download/${current.id}${resolution === 'low' ? '?res=low' : ''}`}>
                {current.kind === 'video' ? 'Download' : `Download ${resolution} res`}
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
