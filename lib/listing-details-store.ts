import 'server-only';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDatabase } from '@/lib/db';
import type { ListingDetails } from '@/lib/listing-details';
import { listings } from '@/lib/schema';

/**
 * Writes a listing's Details and refreshes every page that shows them. The
 * caller has already decided who may: admin, or the agent the listing is for.
 */
export async function saveListingDetails(listingId: number, details: ListingDetails): Promise<void> {
  const [row] = await getDatabase()
    .update(listings)
    .set(details)
    .where(eq(listings.id, listingId))
    .returning({ slug: listings.slug });
  if (!row) return;
  revalidatePath(`/p/${row.slug}`);
  revalidatePath(`/p/${row.slug}/mls`);
  revalidatePath(`/portal/${row.slug}`);
  revalidatePath(`/admin/listings/${listingId}`);
}
