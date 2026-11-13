'use server';

import { requireAdmin } from '@/lib/admin';
import type { DetailsState } from '@/app/components/DetailsForm';
import { readDetailsForm } from '@/lib/listing-details';
import { saveListingDetails } from '@/lib/listing-details-store';

/** Nick's copy of the agent's Details form, on the admin listing page. Bound to the listing id there. */
export async function saveListingDetailsAction(
  listingId: number,
  _prev: DetailsState,
  form: FormData,
): Promise<DetailsState> {
  await requireAdmin();
  if (!Number.isInteger(listingId)) return { error: 'That listing no longer exists.' };

  const parsed = readDetailsForm(form);
  if ('error' in parsed) return parsed;
  await saveListingDetails(listingId, parsed.details);
  return { saved: true };
}
