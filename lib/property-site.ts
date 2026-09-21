import 'server-only';

import type { Metadata } from 'next';
import { cache } from 'react';
import { DEMO_CLIENT, DEMO_LISTINGS, DEMO_MEDIA, IS_DEMO } from '@/lib/demo';
import { getListingBySlug, type ListingBundle } from '@/lib/portal-queries';
import { SITE_ICONS, SITE_MANIFEST } from '@/lib/site-metadata';
import { isLocalKey, mediaUrl, PUBLIC_TTL } from '@/lib/storage';

/**
 * The public property website: /p/<slug>, and /p/<slug>/mls without branding.
 *
 * A show-off page an agent sends to buyers and other agents — no login, no
 * downloads. It exists only once the listing is paid for (downloadLocked is
 * false); before that, and for a slug that was never a listing, the answer is
 * the same "not found", so the page reveals nothing about unpaid work.
 *
 * Only the smaller copies ever reach this page. The original is the paid
 * download, and at 10MB+ far too heavy for a page anyone can open, so a photo
 * whose copies are not made yet is left off rather than shown full-size.
 * Everything handed to the page is a URL; no storage key leaves the server.
 */

export type PropertyPhoto = {
  id: number;
  width: number;
  height: number;
  gridUrl: string;
  largeUrl: string;
};

export type PropertyAgent = {
  name: string | null;
  company: string | null;
  phone: string | null;
  email: string;
};

export type PropertySite = {
  slug: string;
  address: string;
  city: string | null;
  coverUrl: string;
  photos: PropertyPhoto[];
  agent: PropertyAgent | null;
};

/** Demo rows live under /public and are served as they are, signed or not. */
function url(key: string): string {
  return isLocalKey(key) ? key : mediaUrl(key, { expiresIn: PUBLIC_TTL });
}

export function toPropertySite({ listing, media, client }: ListingBundle): PropertySite | null {
  if (listing.downloadLocked) return null;

  const shown = media.filter(
    (m) => m.kind === 'photo' && (isLocalKey(m.r2Key) || (m.gridKey && m.largeKey)),
  );
  if (shown.length === 0) return null;

  const photos = shown.map((m) => ({
    id: m.id,
    width: m.width ?? 1600,
    height: m.height ?? 1067,
    gridUrl: url(m.gridKey ?? m.r2Key),
    largeUrl: url(m.largeKey ?? m.r2Key),
  }));

  // The cover Nick chose, if it is one of the photos shown; otherwise the first.
  const cover = shown.findIndex((m) => m.r2Key === listing.coverKey);

  return {
    slug: listing.slug,
    address: listing.address,
    city: listing.city,
    coverUrl: photos[Math.max(cover, 0)].largeUrl,
    photos,
    agent: client
      ? { name: client.name, company: client.company, phone: client.phone, email: client.email }
      : null,
  };
}

/** Cached per request: the page and its metadata both ask, and share one set of signed URLs. */
export const getPropertySite = cache(async (slug: string): Promise<PropertySite | null> => {
  if (IS_DEMO) {
    const listing = DEMO_LISTINGS.find((l) => l.slug === slug);
    return listing ? toPropertySite({ listing, media: DEMO_MEDIA, client: DEMO_CLIENT }) : null;
  }
  const bundle = await getListingBySlug(slug);
  return bundle ? toPropertySite(bundle) : null;
});

/**
 * Link-only: kept out of search so a seller's home is not findable under
 * Nick's name long after it sells. app/p/[slug]/layout.tsx starts every page
 * here unbranded — no site name, icon or manifest, each of which says "Sala
 * Nera" somewhere a viewer can see it — and the branded version puts the icon
 * and manifest back. A not-found keeps the layout's neutral defaults: Next
 * drops a page's own metadata when it calls notFound().
 */
export function propertyMetadata(site: PropertySite | null, branded: boolean): Metadata {
  if (!site) return {};
  const robots = { index: false, follow: false };

  const place = [site.address, site.city].filter(Boolean).join(', ');
  const presenter = site.agent && [site.agent.name, site.agent.company].filter(Boolean).join(', ');
  const description = branded && presenter ? `${place}. Presented by ${presenter}.` : place;
  const path = branded ? `/p/${site.slug}` : `/p/${site.slug}/mls`;

  return {
    title: branded ? `${place} — Sala Nera` : place,
    description,
    robots,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title: place,
      description,
      images: [{ url: site.coverUrl }],
      ...(branded ? { siteName: 'Sala Nera' } : {}),
    },
    twitter: { card: 'summary_large_image', title: place, description, images: [site.coverUrl] },
    ...(branded ? { icons: SITE_ICONS, manifest: SITE_MANIFEST } : {}),
  };
}
