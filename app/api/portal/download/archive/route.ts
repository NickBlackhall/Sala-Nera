import { after, NextResponse } from 'next/server';
import { archiveFilename, archiveItems, planArchives, startArchive } from '@/lib/archives';
import { authorizeListing, parseResolution, recordDownloads } from '@/lib/downloads';
import { DEMO_LISTINGS, IS_DEMO, demoMediaFor } from '@/lib/demo';
import { getListingBySlug } from '@/lib/portal-queries';
import { ARCHIVE_TTL, mediaUrl, objectSize, readObject } from '@/lib/storage';
import { record } from '@/lib/telemetry';
import { zipLength, zipStream } from '@/lib/zip';

/**
 * "Download all photos": POST { slug, resolution }, get back one of
 *
 *   { status: 'ready', url, filename, bytes }  a signed link to the zip in R2
 *   { status: 'preparing' }                    being made; ask again shortly
 *   { status: 'failed', error }                could not be made; say so
 *
 * The zip itself is built by lib/archives.ts, normally when Nick sends the
 * delivery email. If it is missing when a client asks — a listing delivered
 * before zips existed, or one changed since — this request starts the build
 * and returns at once, and the build carries on after the response (after()).
 * The page asks again every few seconds, and only the request that gets the
 * link records the download.
 *
 * Same gate as every other download: authorizeListing() first, so a locked,
 * someone else's or signed-out request never learns whether a zip exists.
 */

export const dynamic = 'force-dynamic';
// A build set off here runs after the response and stops with the function.
// 300s is the most the Hobby plan allows.
export const maxDuration = 300;

type Answer =
  | { status: 'ready'; url: string; filename: string; bytes: number | null }
  | { status: 'preparing' }
  | { status: 'failed'; error: string };

const answer = (body: Answer) => NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });

const FAILED =
  "Your photos couldn't be packaged just now, and we've been told. Try again in a few minutes, " +
  'or open any photo to download it on its own.';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }

  const { slug, resolution } = (body ?? {}) as { slug?: unknown; resolution?: unknown };
  const wanted = parseResolution(resolution);
  if (typeof slug !== 'string' || !slug) {
    return NextResponse.json({ error: 'Missing listing.' }, { status: 400 });
  }

  if (IS_DEMO) return demoAnswer(slug, wanted);

  const bundle = await getListingBySlug(slug);
  const auth = await authorizeListing(bundle?.listing ?? null);

  if (!auth.ok) {
    await record({
      kind: 'download', outcome: 'rejected', reason: auth.reason,
      detail: `Listing "${slug}", all photos (zip)`,
    });
    if (auth.reason === 'locked') {
      return NextResponse.json({ error: 'This gallery is awaiting payment.' }, { status: 403 });
    }
    return new NextResponse(null, { status: 404 });
  }

  const { listing } = auth;
  const email = auth.session.email;
  const plan = (await planArchives(listing, bundle!.media))[wanted];

  if (plan.state === 'none') {
    return NextResponse.json({ error: 'There are no photos to download.' }, { status: 404 });
  }

  if (plan.state === 'ready' && plan.row) {
    // Logged when the link is handed over, like every other download: what
    // was authorised and started, not proof the transfer finished.
    await recordDownloads(listing, plan.items.map((item) => item.delivery), email);
    await record({
      kind: 'download', outcome: 'ok', reason: 'archive', email,
      detail: `${plan.items.length} photos from ${listing.address}, ${wanted} res zip`,
    });
    const filename = archiveFilename(listing.address, wanted);
    return answer({
      status: 'ready',
      url: mediaUrl(plan.row.r2Key, { expiresIn: ARCHIVE_TTL, downloadAs: filename }),
      filename,
      bytes: plan.row.bytes,
    });
  }

  if (plan.state === 'building') return answer({ status: 'preparing' });

  // Missing, or failed. Start one — unless the last attempt failed so
  // recently that trying again unasked would just fail again.
  const work = await startArchive(plan, email);
  if (work) {
    after(work);
    return answer({ status: 'preparing' });
  }

  // Someone else started it between our look and our claim, or it failed a
  // moment ago. Either way, report what is true now.
  const now = (await planArchives(listing, bundle!.media))[wanted];
  return now.state === 'building' || now.state === 'ready'
    ? answer({ status: 'preparing' })
    : answer({ status: 'failed', error: FAILED });
}

/**
 * Demo mode has no database and no R2. The zip is made on the spot from the
 * sample photos under /public by the same writer, so the button can be tried
 * for real. Logs nothing.
 */
async function demoFiles(slug: string, wanted: 'high' | 'low') {
  const listing = DEMO_LISTINGS.find((l) => l.slug === slug);
  if (!listing) return null;
  const items = archiveItems(demoMediaFor(listing), wanted);
  const sized = await Promise.all(items.map(async (item) => ({ ...item, size: await objectSize(item.key) })));
  return { listing, sized, filename: archiveFilename(listing.address, wanted) };
}

async function demoAnswer(slug: string, wanted: 'high' | 'low') {
  const demo = await demoFiles(slug, wanted);
  if (!demo) return new NextResponse(null, { status: 404 });
  if (demo.listing.downloadLocked) {
    return NextResponse.json({ error: 'This gallery is awaiting payment.' }, { status: 403 });
  }
  return answer({
    status: 'ready',
    url: `/api/portal/download/archive?slug=${encodeURIComponent(slug)}&res=${wanted}`,
    filename: demo.filename,
    bytes: zipLength(demo.sized),
  });
}

/** The demo zip itself. Nothing outside demo mode is served from here. */
export async function GET(request: Request) {
  if (!IS_DEMO) return new NextResponse(null, { status: 404 });

  const params = new URL(request.url).searchParams;
  const wanted = parseResolution(params.get('res'));
  const demo = await demoFiles(params.get('slug') ?? '', wanted);
  if (!demo || demo.listing.downloadLocked) return new NextResponse(null, { status: 404 });

  const chunks = zipStream(demo.sized, (item) => readObject(item.key));
  const iterator = chunks[Symbol.asyncIterator]();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(zipLength(demo.sized)),
      'Content-Disposition': `attachment; filename="${demo.filename}"`,
    },
  });
}
