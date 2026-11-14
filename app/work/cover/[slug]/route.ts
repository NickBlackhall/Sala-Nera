import { getFeaturedCoverUrl } from '@/lib/featured';

/**
 * A featured listing's cover photo, for Selected Work on / and /work.
 *
 * Those pages are prerendered, and a signed storage URL written into one
 * would expire while the page lived on. So they point here, and this signs a
 * fresh URL each time it is asked. The redirect may be reused for an hour;
 * the URL it carries is good for a day (PUBLIC_TTL).
 *
 * 404 for anything that is not featured and paid for right now, so this
 * cannot be used to pull a photo from an unpaid or unfeatured listing.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  let url: string | null = null;
  try {
    url = await getFeaturedCoverUrl(slug);
  } catch (error) {
    console.error('featured: could not find a cover', error);
  }
  if (!url) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  return new Response(null, {
    status: 302,
    headers: {
      // Demo rows are files under /public; everything else is a signed URL.
      Location: new URL(url, request.url).toString(),
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
