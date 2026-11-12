'use client';

import { useEffect, useState } from 'react';

export type BarTab = { id: string; label: string };

/**
 * The slim bar that pins to the top of the property website once the cover
 * has scrolled away: the address, a tab per section of the page, and Share.
 *
 * Everything it shows is handed in. On the MLS version that means the address
 * and nothing else — this component must never add a name of its own.
 */
export default function PropertyBar({ title, sub, tabs }: { title: string; sub?: string | null; tabs: BarTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? null);
  const [copied, setCopied] = useState(false);

  // The current tab is the last section whose top has passed under the bar.
  useEffect(() => {
    if (tabs.length < 2) return;
    const onScroll = () => {
      let current = tabs[0].id;
      for (const tab of tabs) {
        const el = document.getElementById(tab.id);
        if (el && el.getBoundingClientRect().top <= 140) current = tab.id;
      }
      // The last section is often too short to reach the top of the screen.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = tabs[tabs.length - 1].id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [tabs]);

  async function share() {
    const url = window.location.href;
    // The phone's own share sheet where there is one; a copied link elsewhere.
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Dismissing the sheet is not an error worth showing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <div className="pbar" id="gallery">
      <div className="pbar-inner">
        <div className="pbar-title">
          <strong>{title}</strong>
          {sub && <span>{sub}</span>}
        </div>
        {tabs.length > 1 && (
          <nav className="pbar-tabs" aria-label="Sections">
            {tabs.map((tab) => (
              <a key={tab.id} href={`#${tab.id}`} aria-current={active === tab.id ? 'true' : undefined}>
                {tab.label}
              </a>
            ))}
          </nav>
        )}
        <button className="pbar-share" onClick={share}>
          {copied ? 'Link copied' : 'Share'}
        </button>
      </div>
    </div>
  );
}
