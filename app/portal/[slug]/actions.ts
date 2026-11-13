'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  cancelBookingByClient,
  CHANGE_CUTOFF_HOURS,
  rescheduleBookingByClient,
  type ChangeError,
} from '@/lib/booking-changes';
import { IS_DEMO } from '@/lib/demo';
import { getClientByEmail, getListingBySlug, ownsListing } from '@/lib/portal-queries';
import { getSession } from '@/lib/session';
import type { DetailsState } from '@/app/components/DetailsForm';
import { readDetailsForm } from '@/lib/listing-details';
import { saveListingDetails } from '@/lib/listing-details-store';

/**
 * The agent's Reschedule and Cancel buttons, on their listing's "Shoot booked"
 * page. Server actions are public POST endpoints, so each one re-checks who is
 * asking — the same test the page itself applies — before anything changes.
 * lib/booking-changes.ts then decides whether the booking itself still can.
 */

export type ManageState = { error?: string; code?: ChangeError | 'denied' | 'demo'; movedTo?: string };

const MESSAGES: Record<ChangeError | 'denied' | 'demo', string> = {
  denied: 'That booking is not available to change. Try signing in again.',
  demo: 'This is demo data, so nothing can be changed here.',
  not_found: 'That booking has already been cancelled.',
  changed: 'That booking has just changed. Refresh the page to see it.',
  too_late: `This shoot is less than ${CHANGE_CUTOFF_HOURS} hours away, so it can't be changed here. Reply to your confirmation email, or email nblackhall@blackhallmediagroup.com.`,
  slot_taken: 'That time has just been taken. Please pick another.',
};

/**
 * The booking behind this listing, if the person asking may change it: signed
 * in, and either the admin or the agent (or a teammate) the listing belongs
 * to. Only a listing a booking made, and only before anything is delivered —
 * once photos are in, the shoot has happened.
 */
async function authorize(slug: string): Promise<{ bookingId: number; by: string } | null> {
  const session = await getSession();
  if (!session) return null;

  const bundle = await getListingBySlug(slug);
  if (!bundle?.listing.bookingId || bundle.media.length > 0) return null;

  if (!session.isAdmin) {
    const viewer = await getClientByEmail(session.email);
    if (!viewer || !ownsListing(viewer, bundle.client)) return null;
  }
  return { bookingId: bundle.listing.bookingId, by: session.email };
}

const refuse = (code: keyof typeof MESSAGES): ManageState => ({ error: MESSAGES[code], code });

export async function cancelMyBookingAction(slug: string): Promise<ManageState> {
  if (IS_DEMO) return refuse('demo');
  const allowed = await authorize(String(slug));
  if (!allowed) return refuse('denied');

  const result = await cancelBookingByClient(allowed);
  if (!result.ok) return refuse(result.error);

  // The listing went with the booking, so its page no longer exists.
  revalidatePath('/portal');
  redirect('/portal?cancelled=1');
}

export async function rescheduleMyBookingAction(slug: string, slot: string): Promise<ManageState> {
  if (IS_DEMO) return refuse('demo');
  const allowed = await authorize(String(slug));
  if (!allowed) return refuse('denied');

  const result = await rescheduleBookingByClient({ ...allowed, newStart: new Date(String(slot)) });
  if (!result.ok) return refuse(result.error);

  revalidatePath(`/portal/${slug}`);
  revalidatePath('/portal');
  return { movedTo: result.when };
}

/**
 * The agent's Details form on their delivery page: beds, baths, square feet,
 * school district, description. Any time, booked or delivered, paid or not;
 * they show on the property website once it is live. Same test as the page:
 * signed in, and the admin or the agent (or a teammate) the listing is for.
 */
export async function saveMyDetailsAction(slug: string, _prev: DetailsState, form: FormData): Promise<DetailsState> {
  if (IS_DEMO) return { error: MESSAGES.demo };
  const session = await getSession();
  if (!session) return { error: 'Your session has ended. Sign in again to save.' };

  const bundle = await getListingBySlug(String(slug));
  if (!bundle) return { error: 'That listing no longer exists.' };
  if (!session.isAdmin) {
    const viewer = await getClientByEmail(session.email);
    if (!viewer || !ownsListing(viewer, bundle.client)) return { error: 'That listing is not available to change.' };
  }

  const parsed = readDetailsForm(form);
  if ('error' in parsed) return parsed;
  await saveListingDetails(bundle.listing.id, parsed.details);
  return { saved: true };
}
