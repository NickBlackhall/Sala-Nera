import { NextResponse } from 'next/server';
import { authorizeListing } from '@/lib/downloads';
import { DEMO_FLOORPLANS, DEMO_LISTINGS, IS_DEMO } from '@/lib/demo';
import { floorplanTitle, getFloorplans } from '@/lib/floorplans';
import { getListingBySlug } from '@/lib/portal-queries';
import { DOWNLOAD_TTL, mediaUrl } from '@/lib/storage';
import { record } from '@/lib/telemetry';

/**
 * One floor plan, as the file Nick uploaded: GET ?slug=…&id=…, answered with
 * a redirect to a short-lived signed URL that saves under the file's own name.
 *
 * A plain link rather than the photos' POST, because there is one file and
 * nothing to choose. The same gate as every other download decides it —
 * authorizeListing(): signed in, your listing, and paid for. Refusals are a
 * bare 404 or 403; the delivery page never links here while locked.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get('slug');
  const id = Number(params.get('id'));
  if (!slug || !Number.isInteger(id)) return new NextResponse(null, { status: 404 });

  if (IS_DEMO) {
    const listing = DEMO_LISTINGS.find((l) => l.slug === slug);
    const plan = DEMO_FLOORPLANS.find((p) => p.id === id);
    if (!listing || !plan) return new NextResponse(null, { status: 404 });
    if (listing.downloadLocked) return new NextResponse('This gallery is awaiting payment.', { status: 403 });
    return NextResponse.redirect(new URL(plan.r2Key, request.url));
  }

  const bundle = await getListingBySlug(slug);
  const auth = await authorizeListing(bundle?.listing ?? null);
  if (!auth.ok) {
    await record({
      kind: 'download', outcome: 'rejected', reason: auth.reason,
      detail: `Listing "${slug}", a floor plan`,
    });
    return auth.reason === 'locked'
      ? new NextResponse('This gallery is awaiting payment.', { status: 403 })
      : new NextResponse(null, { status: 404 });
  }

  // Looked up within the listing just authorised, so another listing's plan
  // id is simply not found.
  const plans = await getFloorplans(auth.listing.id);
  const index = plans.findIndex((p) => p.id === id);
  if (index < 0) return new NextResponse(null, { status: 404 });
  const plan = plans[index];

  await record({
    kind: 'download', outcome: 'ok', reason: 'floorplan',
    detail: `${floorplanTitle(plan, index, plans.length)} (${plan.filename}) from ${auth.listing.address}`,
    email: auth.session.email,
  });

  return NextResponse.redirect(mediaUrl(plan.r2Key, { expiresIn: DOWNLOAD_TTL, downloadAs: plan.filename }));
}
