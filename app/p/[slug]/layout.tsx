import type { Metadata } from 'next';

/**
 * Neutral defaults for both property website versions, replacing the main
 * site's title, link preview, canonical, icon and manifest. The pages set
 * their own on top; a not-found keeps these, so an MLS link to a listing that
 * is no longer shown never turns into a Sala Nera tab or preview.
 */
export const metadata: Metadata = {
  title: 'Property not available',
  description: 'This property page is not available.',
  robots: { index: false, follow: false },
  alternates: {},
  openGraph: { title: 'Property not available' },
  twitter: { card: 'summary', title: 'Property not available' },
  icons: { icon: [], apple: [] },
  manifest: null,
};

export default function PropertyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
