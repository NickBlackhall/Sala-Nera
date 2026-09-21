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
  emailIsTaken,
  getListingSlug,
  insertClient,
  insertListing,
  insertMediaRow,
  setListingCover,
  setListingLock,
  slugIsTaken,
  updateClientRow,
  updateListingRow,
} from '@/lib/admin-queries';
import { uploadUrl } from '@/lib/storage';

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

/**
 * Address to URL. This is what a client sees in the link you send them, so it
 * stays readable: "4200 Preston Hollow Lane" becomes "preston-hollow-lane"
 * with the street number dropped, matching the two seeded listings.
 */
function slugify(address: string): string {
  return address
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\s*\d+\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

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

/** Media rows and this listing's download history go with it. */
export async function deleteListingAction(form: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(form.get('id'));
  if (!Number.isInteger(id)) return;

  await deleteListingRow(id);
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

export type AddMediaResult = { error?: string };

/**
 * Step 2, called once the browser has PUT the bytes to the URL step 1 handed
 * back: record the row so the gallery and admin grid pick it up.
 */
export async function addMediaAction(input: {
  listingId: number;
  r2Key: string;
  filename: string;
  contentType: string;
  bytes: number;
  width: number | null;
  height: number | null;
}): Promise<AddMediaResult> {
  await requireAdmin();

  if (!Number.isInteger(input.listingId) || !input.r2Key) return { error: 'That upload did not complete.' };

  await insertMediaRow({
    listingId: input.listingId,
    kind: input.contentType.startsWith('image/') ? 'photo' : 'video',
    r2Key: input.r2Key,
    filename: safeFilename(input.filename),
    bytes: Number.isFinite(input.bytes) ? input.bytes : null,
    width: input.width,
    height: input.height,
  });

  revalidatePath(`/admin/listings/${input.listingId}`);
  revalidatePath('/admin');
  return {};
}
