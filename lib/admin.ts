import 'server-only';

import { notFound } from 'next/navigation';
import { getSession, type Session } from '@/lib/session';

/**
 * The admin gate.
 *
 * Call this at the top of every /admin page AND at the top of every server
 * action. The layout check is not enough on its own: a server action is its own
 * POST endpoint that anyone can call directly, and it never renders through the
 * layout that would have stopped it.
 *
 * Answers 404 rather than 403. A 403 would confirm the owner area exists and
 * that the address asking is simply not on the list; a 404 says nothing.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session?.isAdmin) notFound();
  return session;
}
