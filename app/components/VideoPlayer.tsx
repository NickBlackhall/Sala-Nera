'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  /** Shown until play. A video with no still yet shows black with the play button. */
  poster?: string | null;
  /** The video's shape as displayed. Unknown until its still is taken; learned on play if so. */
  width?: number | null;
  height?: number | null;
  label: string;
  /** Start playing as soon as it mounts — only after a click, e.g. opening the lightbox. */
  autoPlay?: boolean;
  /** The unpaid-gallery watermark, the same deterrent the photo tiles carry. */
  watermark?: boolean;
};

const IDLE_MS = 2500;

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/**
 * Sala Nera's own controls over the browser's video element: one look in
 * every browser, no third-party branding, nothing to download from.
 *
 * Sized to the video's own shape — a vertical film stays vertical — and never
 * taller than the screen allows (--vp-max-h). preload="none": nothing is
 * fetched until someone presses play, so a buyer who only wants the photos
 * spends no data on the film.
 *
 * On an iPhone, fullscreen is Apple's own player; element fullscreen is not
 * available there, and that is what people expect anyway.
 */
export default function VideoPlayer({ src, poster, width, height, label, autoPlay, watermark }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [ratio, setRatio] = useState(width && height ? width / height : 16 / 9);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  /** Controls show on any movement, and fade after a pause in it while playing. */
  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
  }, []);

  useEffect(() => () => clearTimeout(idleTimer.current), []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === box.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (autoPlay) video.current?.play().catch(() => {});
  }, [autoPlay]);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused || v.ended) v.play().catch(() => {});
    else v.pause();
  }, []);

  const seekBy = (seconds: number) => {
    const v = video.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + seconds));
  };

  const toggleMute = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    const el = box.current;
    const v = video.current as WebkitVideo | null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else v?.webkitEnterFullscreen?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ' ': toggle,
      k: toggle,
      ArrowRight: () => seekBy(5),
      ArrowLeft: () => seekBy(-5),
      m: toggleMute,
      f: toggleFullscreen,
    };
    const action = keys[e.key];
    // A focused button already acts on Space and Enter; acting here too would
    // play and pause in one keypress. Arrows on the seek bar do come here, so
    // they jump five seconds rather than the bar's tenth-of-a-second step.
    if (!action || (e.target instanceof HTMLButtonElement && e.key === ' ')) return;
    // No page scroll on Space or the arrows. The gallery lightbox around a
    // player ignores keys from inside it (Gallery.tsx), since React's own
    // listener on the document means stopPropagation here would not reach it.
    e.preventDefault();
    action();
    wake();
  };

  const controlsShown = !playing || !idle;
  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <div
      ref={box}
      className={`vp${controlsShown ? '' : ' vp--idle'}`}
      style={{ '--vp-ratio': ratio } as React.CSSProperties}
      role="region"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={wake}
      // Not protection — a determined viewer can still save a stream — but it
      // takes "Save video as…" out of the right-click menu.
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={video}
        src={src}
        poster={poster ?? undefined}
        preload="none"
        playsInline
        onClick={(e) => {
          // On a touchscreen the first tap on a playing film brings the
          // controls back rather than pausing it out from under the viewer.
          if ((e.nativeEvent as PointerEvent).pointerType === 'touch' && idle && playing) wake();
          else toggle();
        }}
        onDoubleClick={toggleFullscreen}
        onPlay={(e) => {
          setStarted(true);
          setPlaying(true);
          wake();
          // One film at a time on a page.
          document.querySelectorAll('video').forEach((v) => v !== e.currentTarget && v.pause());
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onLoadedMetadata={(e) => {
          const { videoWidth, videoHeight } = e.currentTarget;
          if (videoWidth && videoHeight) setRatio(videoWidth / videoHeight);
        }}
      />

      {watermark && <span className="vp-wm" aria-hidden="true">SALA NERA</span>}

      {!playing && (
        <button className="vp-big" onClick={toggle} aria-label={started ? 'Play' : `Play ${label}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
        </button>
      )}

      {waiting && playing && <span className="vp-spin" aria-hidden="true" />}

      {started && (
        <div className="vp-bar" onPointerDown={wake}>
          <button className="vp-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
            )}
          </button>
          <span className="vp-time">{clock(time)} / {clock(duration)}</span>
          <input
            className="vp-seek"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            style={{ '--vp-p': `${progress}%` } as React.CSSProperties}
            onChange={(e) => {
              const v = video.current;
              if (!v) return;
              v.currentTime = Number(e.target.value);
              setTime(v.currentTime);
            }}
            aria-label="Seek"
            aria-valuetext={`${clock(time)} of ${clock(duration)}`}
          />
          <button className="vp-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? (
              <svg className="vp-line" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6" /></svg>
            ) : (
              <svg className="vp-line" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
            )}
          </button>
          <button className="vp-btn" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? (
              <svg className="vp-line" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
            ) : (
              <svg className="vp-line" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
