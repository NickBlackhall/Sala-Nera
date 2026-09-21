import type { Metadata } from 'next';

/**
 * The site's icon set and web-app manifest, shared by the root layout and the
 * branded property website — which sits under a layout that clears both, so
 * the unbranded MLS version and its not-found page carry no Sala Nera icon.
 */
export const SITE_ICONS: Metadata['icons'] = {
  icon: [
    { url: '/favicon.svg', type: 'image/svg+xml' },
    { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
  ],
  apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
};

export const SITE_MANIFEST = '/site.webmanifest';
