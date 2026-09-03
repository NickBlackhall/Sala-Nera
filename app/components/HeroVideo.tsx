'use client';

import { useEffect, useRef, useState } from 'react';

type HeroVideoProps = {
  desktopSrc: string;
  mobileSrc: string;
  poster: string;
};

export default function HeroVideo({ desktopSrc, mobileSrc, poster }: HeroVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    const slowConnection = /(^|slow-)2g/.test(connection?.effectiveType ?? '');
    if (reduceMotion || connection?.saveData || slowConnection) return;

    const source = document.createElement('source');
    source.src = window.matchMedia('(max-width: 640px)').matches ? mobileSrc : desktopSrc;
    source.type = 'video/mp4';
    video.appendChild(source);

    const onPlaying = () => setReady(true);
    video.addEventListener('playing', onPlaying);
    video.load();
    video.play().catch(() => {
      /* autoplay blocked — the poster simply stays */
    });

    return () => {
      video.removeEventListener('playing', onPlaying);
      source.remove();
    };
  }, [desktopSrc, mobileSrc]);

  return (
    <div className="hero-video">
      <div className="poster" style={{ backgroundImage: `url(${poster})` }} />
      <video
        ref={ref}
        id="heroVideoEl"
        className={ready ? 'ready' : undefined}
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
      />
    </div>
  );
}
