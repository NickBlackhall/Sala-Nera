'use client';

import { useState } from 'react';

type Version = 'branded' | 'mls';

/**
 * On the delivery page, once a listing is paid: the two property website
 * links an agent sends out. Built from the page's own origin, so a copy made
 * on a preview deployment points at that deployment, not production.
 */
export default function PropertyLinks({ slug }: { slug: string }) {
  const [copied, setCopied] = useState<Version | null>(null);
  const paths: Record<Version, string> = { branded: `/p/${slug}`, mls: `/p/${slug}/mls` };

  async function copy(version: Version) {
    const url = new URL(paths[version], window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(version);
      setTimeout(() => setCopied((v) => (v === version ? null : v)), 2000);
    } catch {
      // Clipboard access can be refused (older browsers, some in-app webviews);
      // the link is still one long-press away.
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <div className="plinks">
      <div className="plinks-inner wrap">
        <span className="plinks-label">Property website</span>
        <div className="plinks-actions">
          <a className="btn btn-outline btn-sm" href={paths.branded} target="_blank" rel="noopener">
            View ↗
          </a>
          <button className="btn btn-outline btn-sm" onClick={() => copy('branded')}>
            {copied === 'branded' ? 'Copied' : 'Copy link'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => copy('mls')}>
            {copied === 'mls' ? 'Copied' : 'Copy MLS link'}
          </button>
        </div>
      </div>
    </div>
  );
}
