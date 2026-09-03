'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const LOGO = '/brand/sala nera logo cropped dark.svg';

export default function Nav({ solid = false }: { solid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape closes the mobile panel, and the body must not scroll behind it.
  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    const main = document.querySelector('main') as (HTMLElement & { inert: boolean }) | null;
    const footer = document.querySelector('footer') as (HTMLElement & { inert: boolean }) | null;
    if (main) main.inert = open;
    if (footer) footer.inert = open;
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        document.querySelector<HTMLButtonElement>('.nav-toggle')?.focus();
      }
      if (e.key === 'Tab') {
        const panel = document.getElementById('navLinks');
        const toggle = document.querySelector<HTMLButtonElement>('.nav-toggle');
        const links = panel ? Array.from(panel.querySelectorAll<HTMLAnchorElement>('a')) : [];
        const focusable: HTMLElement[] = toggle ? [...links, toggle] : links;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => {
      document.querySelector<HTMLAnchorElement>('#navLinks a')?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      if (main) main.inert = false;
      if (footer) footer.inert = false;
    };
  }, [open]);

  return (
      <nav className={`nav${solid ? ' page-nav' : ''}${scrolled && !solid ? ' scrolled' : ''}`} id="nav" aria-label="Primary">
        <div className="wrap nav-inner">
          <a href="/" className="nav-mark" aria-label="Sala Nera — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo brand-logo--nav" src={LOGO} alt="Sala Nera" width={1669} height={1072} />
          </a>

          <div className={`nav-links${open ? ' open' : ''}`} id="navLinks">
            <a href="/work" aria-current={pathname === '/work' ? 'page' : undefined} onClick={() => setOpen(false)}>Work</a>
            <a href="/#services" onClick={() => setOpen(false)}>Services</a>
            <a href="/contact" aria-current={pathname === '/contact' ? 'page' : undefined} onClick={() => setOpen(false)}>Contact</a>
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
  );
}
