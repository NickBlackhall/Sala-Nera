'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { getListingSlug } from '@/lib/admin-queries';
import {
  deleteFloorplanRow,
  floorplanObjectKeys,
  getFloorplan,
  insertFloorplan,
  setFloorplanCopies,
  setFloorplanLabel,
} from '@/lib/floorplans';
import { copyKey, makePlanCopies } from '@/lib/media-copies';
import { deleteObjects, getObject, putObject, uploadUrl } from '@/lib/storage';

/** Same rule as the media uploads: readable in the R2 dashboard, safe in a URL. */
function safeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-120);
  return cleaned || 'file';
}

export type PlanUploadUrl = { key: string; url: string } | { error: string };

/**
 * Step 1: a presigned PUT for one floor plan, kept in its own folder under
 * the listing so the bucket shows plans apart from photos. The bytes go
 * straight from the browser to storage.
 */
export async function createFloorplanUploadUrlAction(input: {
  listingId: number;
  filename: string;
  contentType: string;
}): Promise<PlanUploadUrl> {
  await requireAdmin();

  if (!Number.isInteger(input.listingId)) return { error: 'That listing no longer exists.' };
  if (!input.contentType.startsWith('image/')) {
    return { error: `${input.filename}: floor plans need to be image files (JPG or PNG).` };
  }

  const slug = await getListingSlug(input.listingId);
  if (!slug) return { error: 'That listing no longer exists.' };

  const key = `listings/${slug}/floorplans/${randomUUID()}-${safeFilename(input.filename)}`;
  const url = uploadUrl(key);
  if (!url) return { error: 'Cloudflare storage is not connected yet, so there is nowhere to upload to.' };
  return { key, url };
}

/**
 * Step 2, once the bytes are up: record the plan and make its smaller copies
 * in the same call. A plan is one modest file, not a card of 8K photos, so
 * there is no need for the photos' separate batch step.
 *
 * A copy that fails leaves the row in place with the original safely stored;
 * the page says so and Nick can delete it and try again.
 */
export async function addFloorplanAction(input: {
  listingId: number;
  r2Key: string;
  filename: string;
  bytes: number;
}): Promise<{ error?: string }> {
  await requireAdmin();

  if (!Number.isInteger(input.listingId) || !input.r2Key) return { error: 'That upload did not complete.' };
  // The key must be one step 1 could have handed out for this listing.
  const slug = await getListingSlug(input.listingId);
  if (!slug || !input.r2Key.startsWith(`listings/${slug}/floorplans/`)) {
    return { error: 'That upload did not complete.' };
  }

  const row = await insertFloorplan({
    listingId: input.listingId,
    r2Key: input.r2Key,
    filename: safeFilename(input.filename),
    bytes: Number.isFinite(input.bytes) ? input.bytes : null,
  });

  let copies;
  try {
    copies = await makePlanCopies(await getObject(row.r2Key));
  } catch (error) {
    console.error(`floor plans: could not read ${row.r2Key}`, error);
    return { error: `${row.filename}: uploaded, but it could not be read as an image, so it won't show on the site.` };
  }

  const keys = { gridKey: copyKey(row.r2Key, 'grid'), largeKey: copyKey(row.r2Key, 'large') };
  try {
    await Promise.all([
      putObject(keys.gridKey, copies.grid, 'image/jpeg'),
      putObject(keys.largeKey, copies.large, 'image/jpeg'),
    ]);
  } catch (error) {
    console.error(`floor plans: could not store copies of ${row.r2Key}`, error);
    await deleteObjects([keys.gridKey, keys.largeKey]);
    return { error: `${row.filename}: uploaded, but its preview could not be saved.` };
  }

  const saved = await setFloorplanCopies(row.id, { ...keys, width: copies.width, height: copies.height });
  if (!saved) await deleteObjects([keys.gridKey, keys.largeKey]);
  return {};
}

export async function renameFloorplanAction(input: { id: number; label: string }): Promise<{ error?: string }> {
  await requireAdmin();

  const row = Number.isInteger(input.id) ? await getFloorplan(input.id) : null;
  if (!row) return { error: 'That floor plan no longer exists.' };

  await setFloorplanLabel(row.id, input.label.trim().slice(0, 80) || null);
  revalidatePath(`/admin/listings/${row.listingId}`);
  return {};
}

/** The row first, then the files — the same order, for the same reason, as deleting a photo. */
export async function deleteFloorplanAction(form: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(form.get('id'));
  const row = Number.isInteger(id) ? await getFloorplan(id) : null;
  if (!row) return;

  await deleteFloorplanRow(row.id);
  await deleteObjects(floorplanObjectKeys(row));
  revalidatePath(`/admin/listings/${row.listingId}`);
}
