import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isAdminEmail } from '@/lib/session';
import { requireAdmin } from '@/lib/admin';
import { countListingsForClient, getClientById } from '@/lib/admin-queries';
import ClientForm from '../../ClientForm';
import DeleteClient from '../../DeleteClient';
import { updateClientAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();

  const client = await getClientById(clientId);
  if (!client) notFound();

  const listingCount = await countListingsForClient(clientId);
  const isAdmin = isAdminEmail(client.email);

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="kicker">Client</span>
          <h1>{client.company || client.name || client.email}</h1>
          <p className="admin-muted">{client.email}</p>
        </div>
        <Link className="btn btn-outline" href="/admin/clients">
          Back
        </Link>
      </div>

      {isAdmin && (
        <p className="admin-flash">
          This is one of your own admin sign-in addresses. Signing in with it goes to Admin, not
          the client portal, so nothing sent here is what a real client sees. Usually created by
          booking with this email by mistake — safe to delete below.
        </p>
      )}

      <ClientForm action={updateClientAction} client={client} submitLabel="Save changes" />

      <DeleteClient id={client.id} email={client.email} listingCount={listingCount} />
    </>
  );
}
