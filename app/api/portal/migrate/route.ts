import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import {
  PORTAL_MIGRATION_ID,
  PORTAL_MIGRATION_STATEMENTS,
} from '@/lib/portal-migration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function isAuthorized(request: Request, expectedToken: string): boolean {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) return false;

  const providedToken = authorization.slice('Bearer '.length).trim();
  return providedToken.length > 0 && timingSafeEqual(digest(providedToken), digest(expectedToken));
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const databaseUrl = process.env.DATABASE_URL;
  const migrateToken = process.env.MIGRATE_TOKEN;

  if (!databaseUrl || !migrateToken) {
    return response(
      { ok: false, error: 'Migration service is not configured.', requestId },
      503,
    );
  }

  if (!isAuthorized(request, migrateToken)) {
    return response({ ok: false, error: 'Unauthorized.', requestId }, 401);
  }

  const sql = neon(databaseUrl);

  try {
    await sql`CREATE TABLE IF NOT EXISTS "portal_migrations" (
      "id" text PRIMARY KEY NOT NULL,
      "applied_at" timestamp with time zone DEFAULT now() NOT NULL
    )`;

    const existing = await sql`
      SELECT "id", "applied_at"
      FROM "portal_migrations"
      WHERE "id" = ${PORTAL_MIGRATION_ID}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return response({
        ok: true,
        status: 'already_applied',
        migration: PORTAL_MIGRATION_ID,
        requestId,
      });
    }

    await sql.transaction(
      (transaction) => [
        ...PORTAL_MIGRATION_STATEMENTS.map((statement) => transaction.query(statement)),
        transaction`
          INSERT INTO "portal_migrations" ("id")
          VALUES (${PORTAL_MIGRATION_ID})
          ON CONFLICT ("id") DO NOTHING
        `,
      ],
      { isolationLevel: 'Serializable' },
    );

    return response({
      ok: true,
      status: 'applied',
      migration: PORTAL_MIGRATION_ID,
      requestId,
    });
  } catch (error) {
    console.error('Portal migration failed', { requestId, error });
    return response(
      { ok: false, error: 'Migration failed. Check the deployment logs.', requestId },
      500,
    );
  }
}
