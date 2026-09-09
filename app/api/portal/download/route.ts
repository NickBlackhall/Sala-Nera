import { NextResponse } from 'next/server';
import { authorizeListing, recordDownloads } from '@/lib/downloads';
import { DEMO_LISTINGS, DEMO_MEDIA, IS_DEMO } from '@/lib/demo';
import { getListingBySlug, getMediaForListing } from '@/lib/portal-queries';
import { DOWNLOAD_TTL, mediaUrl } from '@/lib/storage';

/**
 * A selection, or a whole listing: POST { slug, ids? }, get back one signed URL
 * per file. Omitting `ids` means everything in the listing.
 *
 * This returns URLs instead of a zip. Zipping means either buffering gigabytes
 * in a serverless function or streaming an archive through it, and both undo
 * the point of redirecting to R2 in the first place. The client fetches each
 * file directly; a real zip belongs in a separate job that writes the archive
 * to R2 once and hands back a single key.
 *
 * The listing is authorised once, then media ids are filtered to that listing in
 * the query — so a request naming another client's media ids gets those ids
 * dropped, not a partial leak.
 */

export const dynamic = 'force-dynamic';

const MAX_FILES = 500;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }

  const { slug, ids } = (body ?? {}) as { slug?: unknown; ids?: unknown };
  if (typeof slug !== 'string' || !slug) {
    return NextResponse.json({ error: 'Missing listing.' }, { status: 400 });
  }

  // Anything non-numeric is dropped rather than rejected — the query filters by
  // listing anyway, so a malformed id can only ever remove files from the set.
  const requested = Array.isArray(ids)
    ? ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, MAX_FILES)
    : undefined;

  if (IS_DEMO) {
    const listing = DEMO_LISTINGS.find((l) => l.slug === slug);
    if (!listing) return new NextResponse(null, { status: 404 });
    if (listing.downloadLocked) {
      return NextResponse.json({ error: 'This gallery is awaiting payment.' }, { status: 403 });
    }
    const items = requested?.length
      ? DEMO_MEDIA.filter((m) => requested.includes(m.id))
      : DEMO_MEDIA;
    return NextResponse.json({
      files: items.map((m) => ({ id: m.id, filename: m.filename, url: m.r2Key })),
    });
  }

  const bundle = await getListingBySlug(slug);
  const auth = await authorizeListing(bundle?.listing ?? null);

  if (!auth.ok) {
    if (auth.reason === 'locked') {
      return NextResponse.json(
        { error: 'This gallery is awaiting payment.' },
        { status: 403 },
      );
    }
    return new NextResponse(null, { status: 404 });
  }

  const items = await getMediaForListing(auth.listing.id, requested);
  if (items.length === 0) {
    return NextResponse.json({ error: 'Nothing to download.' }, { status: 404 });
  }

  await recordDownloads(auth.listing, items, auth.session.email);

  return NextResponse.json({
    files: items.map((item) => ({
      id: item.id,
      filename: item.filename,
      url: mediaUrl(item.r2Key, { expiresIn: DOWNLOAD_TTL, downloadAs: item.filename }),
    })),
  });
}
