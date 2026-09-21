import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE_ICONS, SITE_MANIFEST } from '@/lib/site-metadata';

const SITE = 'https://salanera.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Sala Nera — A Curated Collection',
  description:
    'Sala Nera is a limited collection of cinematic property films and imagery by Blackhall Media Group.',
  alternates: { canonical: '/' },
  manifest: SITE_MANIFEST,
  icons: SITE_ICONS,
  openGraph: {
    type: 'website',
    siteName: 'Sala Nera',
    title: 'Sala Nera — A Curated Collection',
    description:
      'A limited collection of cinematic property films and imagery by Blackhall Media Group.',
    url: '/',
    images: [{ url: '/og-sala-nera.jpg', width: 1200, height: 630, alt: 'Sala Nera — cinematic real estate media' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sala Nera — A Curated Collection',
    description:
      'A limited collection of cinematic property films and imagery by Blackhall Media Group.',
    images: ['/og-sala-nera.jpg'],
  },
};

export const viewport: Viewport = { themeColor: '#0F0E0D' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@600;700&family=Inter:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
