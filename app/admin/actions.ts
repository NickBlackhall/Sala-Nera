'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import {
  deleteListingRow,
  emailIsTaken,
  insertClient,
  insertListing,
  setListingCover,
  setListingLock,
  slugIsTaken,
  updateClientRow,
  updateListingRow,
} from '@/lib/admin-queries';

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
      coverKey: optional(form, 'coverKey', 500),
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
