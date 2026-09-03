import { defineConfig } from 'drizzle-kit';

/**
 * `generate` only reads the schema, but Drizzle Kit still requires a URL in
 * its configuration. The local placeholder is never contacted by generation;
 * commands that touch a database must be given the real DATABASE_URL.
 */
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: './lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
