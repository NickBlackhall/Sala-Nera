import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { getAdminClients } from '@/lib/admin-queries';

export const dynamic = 'force-dynamic';

export default async function AdminClients() {
  await requireAdmin();
  const rows = await getAdminClients();

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="kicker">Clients</span>
          <h1>
            {rows.length} {rows.length === 1 ? 'client' : 'clients'}
          </h1>
        </div>
        <Link className="btn btn-primary" href="/admin/clients/new">
          New client
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="admin-empty">
          No clients yet. <Link href="/admin/clients/new">Add the first one.</Link>
        </p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Brokerage</th>
                <th>Team</th>
                <th>Listings</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ client, listingCount }) => (
                <tr key={client.id}>
                  <td>
                    <Link className="admin-strong" href={`/admin/clients/${client.id}`}>
                      {client.email}
                    </Link>
                  </td>
                  <td>{client.name ?? <span className="admin-muted">—</span>}</td>
                  <td>{client.company ?? <span className="admin-muted">—</span>}</td>
                  <td>{client.team ?? <span className="admin-muted">—</span>}</td>
                  <td>{listingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="admin-note">
        A client can sign in as soon as they exist here — the login form only
        sends a link to an address it already knows.
      </p>
    </>
  );
}
