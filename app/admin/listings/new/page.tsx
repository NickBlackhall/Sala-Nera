import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { getClientOptions } from '@/lib/admin-queries';
import ListingForm from '../../ListingForm';
import { createListingAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function NewListing() {
  await requireAdmin();
  const clients = await getClientOptions();

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="kicker">New listing</span>
          <h1>Add a listing</h1>
        </div>
        <Link className="btn btn-outline" href="/admin">
          Cancel
        </Link>
      </div>

      <ListingForm action={createListingAction} clients={clients} submitLabel="Create listing" />
    </>
  );
}
