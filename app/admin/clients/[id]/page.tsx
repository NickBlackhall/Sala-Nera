import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { getClientById } from '@/lib/admin-queries';
import ClientForm from '../../ClientForm';
import { updateClientAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();

  const client = await getClientById(clientId);
  if (!client) notFound();

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

      <ClientForm action={updateClientAction} client={client} submitLabel="Save changes" />
    </>
  );
}
