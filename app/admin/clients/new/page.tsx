import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import ClientForm from '../../ClientForm';
import { createClientAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function NewClient() {
  await requireAdmin();

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="kicker">New client</span>
          <h1>Add a client</h1>
        </div>
        <Link className="btn btn-outline" href="/admin/clients">
          Cancel
        </Link>
      </div>

      <ClientForm action={createClientAction} submitLabel="Create client" />
    </>
  );
}
