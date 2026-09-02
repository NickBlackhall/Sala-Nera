'use client';

import { useEffect, useState } from 'react';

const LOGO = '/brand/sala nera logo cropped dark.svg';

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape closes the mobile panel, and the body must not scroll behind it.
  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div className="topstrip" aria-hidden="true">
        <span /><span className="lit" /><span /><span /><span /><span />
      </div>

      <nav className={`nav${scrolled ? ' scrolled' : ''}`} id="nav" aria-label="Primary">
        <div className="wrap nav-inner">
          <a href="#top" className="nav-mark" aria-label="Sala Nera — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo brand-logo--nav" src={LOGO} alt="Sala Nera" width={1669} height={1070} />
          </a>

          <div className={`nav-links${open ? ' open' : ''}`} id="navLinks">
            <a href="/films" onClick={() => setOpen(false)}>Films</a>
            <a href="#process" onClick={() => setOpen(false)}>Process</a>
            <a href="#access" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>
              Request Availability
            </a>
          </div>

          <button
            className="nav-toggle"
            id="navToggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="navLinks"
            onClick={() => setOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>
    </>
  );
}
