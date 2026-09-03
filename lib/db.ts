import 'server-only';

import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '@/lib/schema';

type PortalDatabase = NeonHttpDatabase<typeof schema>;

let database: PortalDatabase | undefined;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabase(): PortalDatabase {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!database) {
    database = drizzle(neon(databaseUrl), { schema });
  }

  return database;
}
