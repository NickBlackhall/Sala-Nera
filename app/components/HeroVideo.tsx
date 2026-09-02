'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The clip is attached by JS rather than markup so that phones and anyone with
 * reduced motion enabled download nothing at all. They get the poster layer.
 */
export default function HeroVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bigEnough = window.matchMedia('(min-width: 641px)').matches;
    if (reduceMotion || !bigEnough) return;

    const source = document.createElement('source');
    source.src = src;
    source.type = 'video/mp4';
    video.appendChild(source);

    const onPlaying = () => setReady(true);
    video.addEventListener('playing', onPlaying);
    video.load();
    video.play().catch(() => {
      /* autoplay blocked — the poster simply stays */
    });

    return () => video.removeEventListener('playing', onPlaying);
  }, [src]);

  return (
    <div className="hero-video">
      <div className="poster" />
      <video
        ref={ref}
        id="heroVideoEl"
        className={ready ? 'ready' : undefined}
        muted
        loop
        playsInline
        preload="none"
      />
    </div>
  );
}
