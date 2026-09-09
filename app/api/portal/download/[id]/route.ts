import { NextResponse } from 'next/server';
import { authorizeListing, recordDownloads } from '@/lib/downloads';
import { DEMO_MEDIA, IS_DEMO } from '@/lib/demo';
import { getMediaWithListing } from '@/lib/portal-queries';
import { DOWNLOAD_TTL, mediaUrl } from '@/lib/storage';

/**
 * One file, by media id.
 *
 * A redirect rather than a proxy: streaming the bytes through this function
 * would put a serverless invocation in front of every 40 MB RAW file and bill
 * for the whole transfer. The signed URL sends the client straight to R2, which
 * is the reason R2 was chosen — zero egress on gigabyte deliveries.
 *
 * The redirect is 302, never cached. A 301 would let the browser reuse a URL
 * that has since expired or been revoked by re-locking the listing.
 */

export const dynamic = 'force-dynamic';

/**
 * A Location header must be absolute. Signed R2 URLs already are; the local
 * development paths that mediaUrl() passes through are not, so they are
 * resolved against the incoming request rather than special-cased at the call
 * site.
 */
function absolute(url: string, request: Request): string {
  return url.startsWith('http') ? url : new URL(url, request.url).toString();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mediaId = Number(id);
  if (!Number.isInteger(mediaId) || mediaId <= 0) return new NextResponse(null, { status: 404 });

  // Demo mode has no database and no sessions. It serves the same local files
  // the gallery already shows, so the buttons are reviewable, and logs nothing.
  if (IS_DEMO) {
    const item = DEMO_MEDIA.find((m) => m.id === mediaId);
    if (!item) return new NextResponse(null, { status: 404 });
    return NextResponse.redirect(absolute(item.r2Key, request), 302);
  }

  const row = await getMediaWithListing(mediaId);
  const auth = await authorizeListing(row?.listing ?? null);

  if (!auth.ok) {
    if (auth.reason === 'locked') {
      return NextResponse.json(
        { error: 'This gallery is awaiting payment.' },
        { status: 403 },
      );
    }
    return new NextResponse(null, { status: 404 });
  }

  const item = row!.item;

  // Logged before redirecting, not after: once the client has the signed URL
  // the download is out of our hands, and a row written on a request we did not
  // authorise would be worse than a row for a download the client abandoned.
  await recordDownloads(auth.listing, [item], auth.session.email);

  return NextResponse.redirect(
    absolute(mediaUrl(item.r2Key, { expiresIn: DOWNLOAD_TTL, downloadAs: item.filename }), request),
    302,
  );
}
