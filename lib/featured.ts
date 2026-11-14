import 'server-only';

import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { getDatabase, hasDatabase } from '@/lib/db';
import { listings, media } from '@/lib/schema';
import { isLocalKey, mediaUrl, PUBLIC_TTL } from '@/lib/storage';

/**
 * Selected Work: the listings Nick has switched on in admin, for the public
 * site's home page and /work.
 *
 * A listing shows only while it is featured AND paid for (downloadLocked is
 * false), the same rule that decides whether its property website exists,
 * because the card links there. Each card is one photo, the listing's cover,
 * with the address and city. No price and no agent: Nick's call.
 *
 * The photo is never a signed URL in the page. Signed URLs expire, and these
 * pages are prerendered, so a quiet day would leave broken images behind. The
 * page points at /work/cover/<slug> instead, which signs a fresh URL when
 * asked (app/work/cover/[slug]/route.ts).
 */

export type FeaturedWork = {
  slug: string;
  address: string;
  city: string | null;
  /** The property website the card opens. */
  href: string;
  /** A stable path on this site that redirects to the cover photo. */
  coverPath: string;
};

type Row = { slug: string; address: string; city: string | null; coverKey: string };

/**
 * Featured, paid listings with the key of the photo to show, newest first.
 * The cover Nick chose if it is a photo with its smaller copies made,
 * otherwise the first such photo: the same choice the property website
 * makes. A listing with no usable photo is left out rather than shown bare.
 */
async function featuredRows(slug?: string): Promise<Row[]> {
  const db = getDatabase();

  const rows = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      address: listings.address,
      city: listings.city,
      coverKey: listings.coverKey,
    })
    .from(listings)
    .where(
      and(
        isNotNull(listings.featuredAt),
        eq(listings.downloadLocked, false),
        slug === undefined ? undefined : eq(listings.slug, slug),
      ),
    )
    .orderBy(desc(listings.featuredAt), desc(listings.id));
  if (rows.length === 0) return [];

  const photos = await db
    .select({
      listingId: media.listingId,
      r2Key: media.r2Key,
      gridKey: media.gridKey,
      largeKey: media.largeKey,
    })
    .from(media)
    .where(and(inArray(media.listingId, rows.map((r) => r.id)), eq(media.kind, 'photo')))
    .orderBy(asc(media.sort), asc(media.id));

  return rows.flatMap((row) => {
    // Only the smaller copy is ever public; the original is the paid download.
    const shown = photos.filter(
      (p) => p.listingId === row.id && (isLocalKey(p.r2Key) || (p.gridKey && p.largeKey)),
    );
    const cover = shown.find((p) => p.r2Key === row.coverKey) ?? shown[0];
    if (!cover) return [];
    return [{ slug: row.slug, address: row.address, city: row.city, coverKey: cover.largeKey ?? cover.r2Key }];
  });
}

/**
 * The cards. An empty list, never an error: the public pages fall back to
 * their placeholder rather than break because the database is unreachable.
 */
export async function getFeaturedWork(): Promise<FeaturedWork[]> {
  if (!hasDatabase()) return [];
  try {
    return (await featuredRows()).map((row) => ({
      slug: row.slug,
      address: row.address,
      city: row.city,
      href: `/p/${row.slug}`,
      coverPath: `/work/cover/${row.slug}`,
    }));
  } catch (error) {
    console.error('featured: could not read Selected Work', error);
    return [];
  }
}

/** Where one featured listing's cover photo is right now, or null if it is not featured. */
export async function getFeaturedCoverUrl(slug: string): Promise<string | null> {
  if (!hasDatabase()) return null;
  const [row] = await featuredRows(slug);
  if (!row) return null;
  if (isLocalKey(row.coverKey)) return row.coverKey;
  // Without storage configured mediaUrl hands the bare key back, which is no address at all.
  const url = mediaUrl(row.coverKey, { expiresIn: PUBLIC_TTL });
  return url.startsWith('https://') ? url : null;
}
