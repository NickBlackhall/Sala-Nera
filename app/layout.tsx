import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE = 'https://salanera.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Sala Nera — A Curated Collection',
  description:
    'Sala Nera is a limited collection of cinematic property films and imagery by Blackhall Media Group.',
  alternates: { canonical: '/' },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: 'Sala Nera',
  description: 'Cinematic real estate media collection from Blackhall Media Group.',
  url: SITE,
  parentOrganization: {
    '@type': 'Organization',
    name: 'Blackhall Media Group',
    url: 'https://www.blackhallmediagroup.com',
  },
  email: 'nblackhall@blackhallmediagroup.com',
  areaServed: { '@type': 'Place', name: 'Dallas–Fort Worth, Texas' },
  address: { '@type': 'PostalAddress', addressRegion: 'TX', addressCountry: 'US' },
  serviceType: ['Real estate videography', 'Architectural photography', 'Aerial cinematography'],
};

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
