import 'server-only';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Stateless sessions: no password table, no session table. A login link is a
 * short-lived signed token; a session is a longer-lived signed cookie. Both are
 * just JWTs, so nothing needs to be stored or cleaned up server side.
 */

const LOGIN_TTL = '15m';
const SESSION_TTL = '30d';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const SESSION_COOKIE = 'sn_portal';

export type Session = {
  email: string;
  isAdmin: boolean;
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET is not configured');
  return new TextEncoder().encode(value);
}

/** Owner addresses, comma separated. Compared lowercase so casing never locks you out. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

/**
 * Tokens carry a purpose claim so a login link can never be replayed as a
 * session cookie, or vice versa, even though both are signed with one secret.
 */
export async function signLoginToken(email: string): Promise<string> {
  return new SignJWT({ email: email.toLowerCase(), purpose: 'login' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(LOGIN_TTL)
    .sign(secret());
}

export async function verifyLoginToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== 'login') return null;
    const email = payload.email;
    return typeof email === 'string' ? email : null;
  } catch {
    return null;
  }
}

async function signSessionToken(email: string): Promise<string> {
  return new SignJWT({ email: email.toLowerCase(), purpose: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secret());
}

export async function startSession(email: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSessionToken(email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** The current viewer, or null. Never throws on a bad or expired cookie. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== 'session') return null;
    const email = payload.email;
    if (typeof email !== 'string') return null;
    return { email, isAdmin: isAdminEmail(email) };
  } catch {
    return null;
  }
}
