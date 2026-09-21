import 'server-only';

import { redirect } from 'next/navigation';
import { getSession, type Session } from '@/lib/session';

/**
 * The admin gate.
 *
 * Call this at the top of every /admin page AND at the top of every server
 * action. The layout does not gate: a server action is its own POST endpoint
 * that anyone can call directly, and it never renders through a layout.
 *
 * Anyone who is not the admin — signed out, or signed in as a client — is sent
 * to the admin's own sign-in page. This used to answer 404, so as not to
 * confirm the owner area exists. That left Nick at a 404 on his own CMS
 * whenever he opened it from a browser he had not signed in on (Sep 21 2026).
 * The gate is the admin email check; the address being unknown was never it.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session?.isAdmin) redirect('/admin/login');
  return session;
}
