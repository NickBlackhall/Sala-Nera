'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { invalidateAvailability } from '@/lib/availability';
import { deleteBookingEvent } from '@/lib/calendar';
import {
  cancelBookingRow,
  deleteClientRow,
  deleteListingRow,
  deleteMediaRow,
  emailIsTaken,
  firstMediaKey,
  getAdminListing,
  getListingMediaKeys,
  getListingSlug,
  getMediaRow,
  insertClient,
  insertDeliveryEmail,
  insertListing,
  insertMediaRow,
  reorderMedia,
  setListingCover,
  setListingLock,
  setMediaCopies,
  slugIsTaken,
  updateClientRow,
  updateListingRow,
} from '@/lib/admin-queries';
import { discardStaleArchives, getListingArchiveKeys, prepareArchives } from '@/lib/archives';
import { copyKey, makeCopies, type Copies } from '@/lib/media-copies';
import { releaseBookingListing } from '@/lib/booking-listing';
import { deliveryEmail } from '@/lib/delivery-email';
import { sendEmail } from '@/lib/email';
import { record } from '@/lib/telemetry';
import { slugify } from '@/lib/slug';
import { COPIES_BATCH } from '@/lib/media-view';
import {
  deleteObjects,
  getObject,
  isLocalKey,
  isRemoteStorage,
  mediaObjectKeys,
  putObject,
  uploadUrl,
} from '@/lib/storage';

/**
 * Every action starts with requireAdmin(). A server action is a POST endpoint
 * that anyone who knows its id can call directly — the /admin layout's check
 * never runs for it. See lib/admin.ts.
 */

export type ActionState = { error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed, length-capped, and stripped of control characters. */
const text = (form: FormData, key: string, limit = 200): string =>
  String(form.get(key) ?? '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .trim()
    .slice(0, limit);

/** Empty strings become NULL, so a cleared field does not save as "". */
const optional = (form: FormData, key: string, limit = 200): string | null =>
  text(form, key, limit) || null;

function parseDate(value: string): Date | null {
  if (!value) return null;
  // Midday UTC, so no timezone can shift the shoot onto the previous day.
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseClientId(value: string): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ------------------------------------------------------------------ clients

async function readClientForm(form: FormData, exceptId?: number) {
  const email = text(form, 'email', 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'A valid email address is required.' as const };
  if (await emailIsTaken(email, exceptId)) {
    return { error: 'Another client already uses that email address.' as const };
  }
  return {
    input: {
      email,
      name: optional(form, 'name', 120),
      company: optional(form, 'company', 160),
      phone: optional(form, 'phone', 40),
      // The team slug is what lets two agents at one brokerage see the same
      // listing. Lowercased so "Briggs" and "briggs" are not separate teams.
      team: optional(form, 'team', 80)?.toLowerCase() ?? null,
    },
  };
}

export async function createClientAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = await readClientForm(form);
  if ('error' in parsed) return parsed;

  await insertClient(parsed.input);
  revalidatePath('/admin/clients');
  redirect('/admin/clients');
}

export async function updateClientAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = Number(form.get('id'));
  if (!Number.isInteger(id)) return { error: 'That client no longer exists.' };

  const parsed = await readClientForm(form, id);
  if ('error' in parsed) return parsed;

  await updateClientRow(id, parsed.input);
  revalidatePath('/admin/clients');
  redirect('/admin/clients');
}

/**
 * Cancels a confirmed booking and puts its day back on the market.
 *
 * The row is kept and marked rather than deleted — the booking really did
 * happen and the client really was told so. Availability stops counting it the
 * moment the status changes, because the index that enforces one shoot a day
 * only looks at confirmed rows.
 *
 * Availability is invalidated here so the freed day shows up straight away
 * rather than after the cache expires: Nick cancelling something is usually
 * followed by him wanting to see it gone.
 */
export async function cancelBookingAction(form: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(form.get('id'));
  if (!Number.isInteger(id)) return;

  const cancelled = await cancelBookingRow(id);
  // Null means it was not a confirmed booking — already cancelled, or never
  // held a slot. Nothing to release and nothing to delete.
  if (!cancelled) return;

  invalidateAvailability();

  /**
   * The day is already free regardless of what Google says next: the database
   * released it the moment the status changed. Removing the event is Nick's
   * view catching up. If it fails he is left with a phantom shoot on his
   * calendar, which is worth finding in the logs — but not worth refusing the
   * cancellation over, since leaving it confirmed would be the worse of the
   * two wrong states.
   */
  if (cancelled.calendarEventId) {
    const removed = await deleteBookingEvent(cancelled.calendarEventId);
    if (!removed) {
      console.error('admin: booking cancelled but its calendar event remains', {
        bookingId: id,
        eventId: cancelled.calendarEventId,
      });
    }
  }

  // The listing the booking made goes too, but only while it is still empty —
  // see lib/booking-listing.ts. A failure leaves an empty locked listing,
  // which Nick can delete by hand; not worth undoing the cancellation over.
  try {
    await releaseBookingListing(id);
  } catch (error) {
    console.error('admin: booking cancelled but its listing could not be removed', { bookingId: id, error });
  }

  revalidatePath('/admin');
  revalidatePath('/admin/bookings');
}

/** Listings and bookings this client had are kept; each one's clientId just becomes null. */
export async function deleteClientAction(form: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(form.get('id'));
  if (!Number.isInteger(id)) return;

  await deleteClientRow(id);
  revalidatePath('/admin/clients');
  redirect('/admin/clients');
}

// ------------------------------------------------------------ stored files

// ----------------------------------------------------------------- listings

async function readListingForm(form: FormData, exceptId?: number) {
  const address = text(form, 'address', 200);
  if (!address) return { error: 'An address is required.' as const };

  const slug = slugify(text(form, 'slug', 80) || address);
  if (!slug) {
    return { error: 'That address does not produce a usable URL. Set the slug by hand.' as const };
  }
  if (await slugIsTaken(slug, exceptId)) {
    return { error: `The URL /portal/${slug} is already taken by another listing.` as const };
  }

  return {
    input: {
      address,
      slug,
      city: optional(form, 'city', 120),
      clientId: parseClientId(text(form, 'clientId', 20)),
      shootDate: parseDate(text(form, 'shootDate', 20)),
      // coverKey is deliberately absent: setCoverAction owns that column. When
      // this form also carried it, saving the form wrote back the value the
      // page loaded with, silently undoing any "Use as cover" clicked since.
      // Locked unless the checkbox says otherwise. A new listing is never
      // downloadable until someone deliberately unlocks it.
      downloadLocked: form.get('downloadLocked') !== 'unlocked',
    },
  };
}

export async function createListingAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = await readListingForm(form);
  if ('error' in parsed) return parsed;

  const listing = await insertListing(parsed.input);
  revalidatePath('/admin');
  redirect(`/admin/listings/${listing.id}`);
}

export async function updateListingAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = Number(form.get('id'));
  if (!Number.isInteger(id)) return { error: 'That listing no longer exists.' };

  const parsed = await readListingForm(form, id);
  if ('error' in parsed) return parsed;

  await updateListingRow(id, parsed.input);
  revalidatePath('/admin');
  revalidatePath(`/admin/listings/${id}`);
  revalidatePath(`/portal/${parsed.input.slug}`);
  redirect('/admin?saved=1');
}

/** The one-click version of the payment gate, from the dashboard or the row. */
export async function toggleLockAction(form: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(form.get('id'));
  if (!Number.isInteger(id)) return;

  await setListingLock(id, form.get('locked') === 'true');
  revalidatePath('/admin');
  revalidatePath(`/admin/listings/${id}`);
}

export async function setCoverAction(form: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(form.get('id'));
  const key = String(form.get('coverKey') ?? '');
  if (!Number.isInteger(id) || !key) return;

  await setListingCover(id, key);
  revalidatePath('/admin');
  revalidatePath(`/admin/listings/${id}`);
}

export type DeliveryState = { error?: string; sent?: string };

/**
 * Emails the listing's agent that their photos are ready — the preview
 * version while it is locked, the download version once it is paid. Nick
 * presses this when an upload is finished and checked; nothing sends it by
 * itself, because uploads land in batches and a half-uploaded gallery is not
 * something to announce.
 *
 * The download version first makes sure both "Download all photos" zips
 * exist (lib/archives.ts), reusing them if they are already up to date, and
 * does not send if they cannot be made: an email saying "ready to download"
 * about a download we already know is broken would be worse than none. The
 * preview version builds nothing — a locked gallery can still change.
 *
 * Recorded only once Resend has accepted it, so the listing never claims an
 * email went out that did not.
 */
export async function sendDeliveryAction(
  _prev: DeliveryState,
  form: FormData,
): Promise<DeliveryState> {
  const session = await requireAdmin();

  const id = Number(form.get('id'));
  const detail = Number.isInteger(id) ? await getAdminListing(id) : null;
  if (!detail) return { error: 'That listing no longer exists.' };

  const { listing, client, media } = detail;
  if (!client) return { error: 'Assign an agent to this listing first.' };
  if (media.length === 0) return { error: 'Upload the photos first.' };

  const kind = listing.downloadLocked ? 'preview' : 'ready';

  if (kind === 'ready') {
    const prepared = await prepareArchives(listing, media, session.email);
    if (!prepared.ok) {
      await record({
        kind: 'delivery', outcome: 'failed', reason: 'archive_failed', email: client.email,
        detail: `${listing.address} — ready email not sent, the downloads could not be made: ${prepared.error}`,
      });
      revalidatePath(`/admin/listings/${listing.id}`);
      return { error: `The downloads couldn't be prepared, so the email wasn't sent. ${prepared.error}` };
    }
  }
  const { subject, text } = deliveryEmail({
    kind,
    name: client.name,
    email: client.email,
    address: listing.address,
    slug: listing.slug,
    photos: media.filter((m) => m.kind === 'photo').length,
    films: media.filter((m) => m.kind === 'video').length,
    base: process.env.PORTAL_URL ?? 'https://salanera.com',
  });

  const sent = await sendEmail({ to: client.email, subject, text, replyTo: process.env.NOTIFY_EMAIL });
  await record({
    kind: 'delivery',
    outcome: sent ? 'ok' : 'failed',
    reason: sent ? kind : 'send_failed',
    detail: `${listing.address} — ${kind === 'preview' ? 'preview' : 'ready to download'} email`,
    email: client.email,
  });
  if (!sent) return { error: "The email didn't send. Try again in a minute." };

  try {
    await insertDeliveryEmail({ listingId: listing.id, sentTo: client.email, kind });
  } catch (error) {
    // The email is out either way; only this page's record of it is missing.
    console.error('admin: delivery email sent but not recorded', { listingId: listing.id, error });
  }

  revalidatePath(`/admin/listings/${listing.id}`);
  return { sent: `Sent to ${client.email}.` };
}

export type PrepareState = { error?: string; prepared?: string };

/**
 * Make, or remake, a listing's "Download all photos" zips without emailing
 * anyone: for a listing delivered before zips existed, after changing its
 * photos, or after a failure. Anything already up to date is left alone.
 */
export async function prepareDownloadsAction(
  _prev: PrepareState,
  form: FormData,
): Promise<PrepareState> {
  const session = await requireAdmin();

  const id = Number(form.get('id'));
  const detail = Number.isInteger(id) ? await getAdminListing(id) : null;
  if (!detail) return { error: 'That listing no longer exists.' };

  const prepared = await prepareArchives(detail.listing, detail.media, session.email);
  revalidatePath(`/admin/listings/${id}`);
  return prepared.ok ? { prepared: 'Downloads ready.' } : { error: prepared.error };
}

/** Media rows and this listing's download history go with it — and the files. */
export async function deleteListingAction(form: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(form.get('id'));
  if (!Number.isInteger(id)) return;

  // Read the keys first: the media and zip rows cascade with the listing, and
  // once they are gone nothing records which objects used to be its.
  const keys = [...(await getListingMediaKeys(id)), ...(await getListingArchiveKeys(id))];

  await deleteListingRow(id);
  await deleteObjects(keys);

  revalidatePath('/admin');
  redirect('/admin');
}

// -------------------------------------------------------------------- media

/** Keeps an object key readable in the R2 dashboard, and safe as a URL segment. */
function safeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-120);
  return cleaned || 'file';
}

export type UploadUrlResult = { key: string; url: string } | { error: string };

/**
 * Step 1 of a browser upload: mint a presigned PUT for one file, called
 * directly from the client component (not a <form> — this returns data, not
 * a redirect). The bytes themselves never pass through this server; see
 * lib/storage.ts's uploadUrl for why.
 */
export async function createUploadUrlAction(input: {
  listingId: number;
  filename: string;
  contentType: string;
}): Promise<UploadUrlResult> {
  await requireAdmin();

  if (!Number.isInteger(input.listingId)) return { error: 'That listing no longer exists.' };
  if (!/^(image|video)\//.test(input.contentType)) {
    return { error: `${input.filename}: not a photo or video file.` };
  }

  const slug = await getListingSlug(input.listingId);
  if (!slug) return { error: 'That listing no longer exists.' };

  const key = `listings/${slug}/${randomUUID()}-${safeFilename(input.filename)}`;
  const url = uploadUrl(key);
  if (!url) return { error: 'Cloudflare storage is not connected yet, so there is nowhere to upload to.' };

  return { key, url };
}

export type AddMediaResult = { id: number; kind: 'photo' | 'video' } | { error: string };

/**
 * Step 2, called once the browser has PUT the bytes to the URL step 1 handed
 * back: record the row so the gallery and admin grid pick it up.
 *
 * Width and height are left for makeCopiesAction to fill in from the file
 * itself — the browser's own reading was blocked by the CSP and never landed.
 */
export async function addMediaAction(input: {
  listingId: number;
  r2Key: string;
  filename: string;
  contentType: string;
  bytes: number;
}): Promise<AddMediaResult> {
  await requireAdmin();

  if (!Number.isInteger(input.listingId) || !input.r2Key) return { error: 'That upload did not complete.' };

  const kind = input.contentType.startsWith('image/') ? 'photo' : 'video';
  const row = await insertMediaRow({
    listingId: input.listingId,
    kind,
    r2Key: input.r2Key,
    filename: safeFilename(input.filename),
    bytes: Number.isFinite(input.bytes) ? input.bytes : null,
    width: null,
    height: null,
  });
  // A new photo means the listing's zips are missing it. Films are not in them.
  if (kind === 'photo') await discardStaleArchives(input.listingId);

  // No revalidatePath: the upload component refreshes once, after every file
  // is up and its preview made. Refreshing per file would show the new
  // photos as "no preview yet" while their previews were still coming.
  return { id: row.id, kind };
}

/**
 * Step 3 for photos: make their smaller copies (lib/media-copies.ts) and
 * record them. Also what the "Make previews" button calls for photos uploaded
 * before copies existed.
 *
 * Takes a few ids and works on them together, because the client dispatches
 * server actions one at a time — parallelism has to happen in here or not at
 * all (Next's own docs, 07-mutating-data.md). Kept to a small batch so no
 * call comes near the page's maxDuration.
 */
export async function makeCopiesAction(
  mediaIds: number[],
): Promise<{ id: number; error?: string }[]> {
  await requireAdmin();

  const ids = mediaIds.filter(Number.isInteger).slice(0, COPIES_BATCH);
  return Promise.all(ids.map(async (id) => ({ id, ...(await makeCopiesFor(id)) })));
}

function keyList(keys: { gridKey: string; largeKey: string; highKey: string | null }): string[] {
  return [keys.gridKey, keys.largeKey, keys.highKey].filter((k): k is string => Boolean(k));
}

/**
 * Safe to run twice: copies land on the same keys and simply overwrite. A
 * failure leaves the row exactly as it was — the gallery keeps showing the
 * original — so it is reported, never thrown.
 */
async function makeCopiesFor(mediaId: number): Promise<{ error?: string }> {
  if (!isRemoteStorage()) return {};

  const row = await getMediaRow(mediaId);
  if (!row) return { error: 'That photo no longer exists.' };

  const { kind, r2Key, filename } = row.media;
  // A video's copies come from its still (saveVideoFrameAction), and demo
  // rows live under /public with nothing to fetch.
  if (kind !== 'photo' || isLocalKey(r2Key)) return {};

  let copies;
  try {
    copies = await makeCopies(await getObject(r2Key));
  } catch (error) {
    console.error(`media copies: could not read ${r2Key}`, error);
    return { error: `${filename}: this file could not be read as a photo.` };
  }

  const stored = await storeCopies(mediaId, row.media, copies, copies);
  if (!stored.error) {
    // New copies change what the low-res zip (and maybe the high) holds.
    // Remade over copies it already had, they land on the same keys, which
    // the zips' fingerprint cannot see, so every zip goes.
    await discardStaleArchives(row.media.listingId, { all: Boolean(row.media.largeKey) });
  }
  return stored;
}

/**
 * Store a row's copies and point the row at them. Shared by photos and by a
 * video's still, so both clean up the same way when something fails.
 */
async function storeCopies(
  mediaId: number,
  { r2Key, filename }: { r2Key: string; filename: string },
  copies: Copies,
  size: { width: number; height: number },
): Promise<{ error?: string }> {
  const keys = {
    gridKey: copyKey(r2Key, 'grid'),
    largeKey: copyKey(r2Key, 'large'),
    highKey: copies.high ? copyKey(r2Key, 'high') : null,
  };

  try {
    await Promise.all([
      putObject(keys.gridKey, copies.grid, 'image/jpeg'),
      putObject(keys.largeKey, copies.large, 'image/jpeg'),
      copies.high && keys.highKey ? putObject(keys.highKey, copies.high, 'image/jpeg') : null,
    ]);
  } catch (error) {
    console.error(`media copies: could not store copies of ${r2Key}`, error);
    // Some may have landed before one failed. The row will not record them,
    // so remove them rather than leave them orphaned.
    await deleteObjects(keyList(keys));
    return { error: `${filename}: its preview could not be saved.` };
  }

  const saved = await setMediaCopies(mediaId, { ...keys, ...size });

  // Deleted while its copies were being made: nothing will ever point at
  // them, so they go now rather than sit orphaned in the bucket.
  if (!saved) await deleteObjects(keyList(keys));

  return {};
}

/**
 * Step 3 for videos. The browser took a still from the file before uploading
 * it (app/admin/probeVideo.ts); that still becomes the video's grid and large
 * copies, made by the same makeCopies() as a photo's, so the gallery tile, the
 * poster before play and deletion all work exactly as they do for photos.
 *
 * Width and height are the video's own, as the browser displayed it — not the
 * still's, which may have been scaled down to fit the request.
 */
export async function saveVideoFrameAction(form: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  if (!isRemoteStorage()) return {};

  const id = Number(form.get('id'));
  const width = Number(form.get('width'));
  const height = Number(form.get('height'));
  const frame = form.get('frame');
  const plausible = (n: number) => Number.isInteger(n) && n > 0 && n <= 16_384;
  if (!Number.isInteger(id) || !plausible(width) || !plausible(height) || !(frame instanceof Blob)) {
    return { error: 'That preview frame was not usable.' };
  }

  const row = await getMediaRow(id);
  if (!row || row.media.kind !== 'video' || isLocalKey(row.media.r2Key)) {
    return { error: 'That video no longer exists.' };
  }

  let copies;
  try {
    copies = await makeCopies(Buffer.from(await frame.arrayBuffer()));
  } catch (error) {
    console.error(`media copies: could not read the still for ${row.media.r2Key}`, error);
    return { error: `${row.media.filename}: its preview frame could not be read.` };
  }

  // A still is a JPEG well under the MLS cap, so no high copy — and a video's
  // high-res download is the video, never a picture of it.
  return storeCopies(id, row.media, { ...copies, high: null }, { width, height });
}

/**
 * Persist a new running order for one listing's media.
 *
 * Called with the whole order rather than "this moved from 3 to 7" so that a
 * dropped request leaves the old order intact instead of a half-applied one.
 */
export async function reorderMediaAction(input: {
  listingId: number;
  orderedIds: number[];
}): Promise<{ error?: string }> {
  await requireAdmin();

  if (!Number.isInteger(input.listingId)) return { error: 'That listing no longer exists.' };
  if (!input.orderedIds.every(Number.isInteger)) return { error: 'That order could not be read.' };

  await reorderMedia(input.listingId, input.orderedIds);
  // The zips number photos in gallery order. Moving only a film leaves them be.
  await discardStaleArchives(input.listingId);

  revalidatePath(`/admin/listings/${input.listingId}`);
  return {};
}

/**
 * Remove one photo or video: the row first, then the object behind it.
 *
 * That order is deliberate and not the intuitive one. Deleting the object
 * first would, if the row delete then failed, leave a row pointing at bytes
 * that are gone — a broken image in a client's gallery. This way round the
 * worst case is an orphaned object in a private bucket that nothing links
 * to, which costs a fraction of a cent and is invisible to everyone.
 */
export async function deleteMediaAction(form: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(form.get('id'));
  if (!Number.isInteger(id)) return;

  const row = await getMediaRow(id);
  if (!row) return;

  const { listingId, r2Key } = row.media;
  await deleteMediaRow(id);

  // A listing whose cover just disappeared falls back to whatever sorts
  // first, or to no cover at all rather than a key pointing at nothing.
  if (row.listingCoverKey === r2Key) {
    await setListingCover(listingId, await firstMediaKey(listingId));
  }

  // The original and its copies.
  await deleteObjects(mediaObjectKeys(row.media));
  // And any zip it was in. Until this finishes, the zips' fingerprint already
  // stops them being handed out.
  await discardStaleArchives(listingId);

  revalidatePath(`/admin/listings/${listingId}`);
  revalidatePath('/admin');
}
