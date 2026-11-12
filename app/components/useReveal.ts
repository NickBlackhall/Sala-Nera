'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Fades each `[data-reveal]` element inside `ref` in as it scrolls into view.
 *
 * The hidden starting state only applies once this has run and put `reveal`
 * on the container, so a page whose script never loads shows every photo
 * rather than none. `deps` should change whenever the tiles are rebuilt (the
 * column count, the number of photos) so the new ones are watched too.
 */
export function useReveal(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !('IntersectionObserver' in window)) return;
    root.classList.add('reveal');
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -5% 0px' },
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
