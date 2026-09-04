/**
 * Seeds the two sample listings into whatever database DATABASE_URL points at.
 *
 * Run it with Node's own env loader, so the pulled Vercel values are used and
 * no secret is ever passed on the command line:
 *
 *   node --env-file=.env.local scripts/seed-portal.mjs
 *
 * Safe to re-run: clients and listings upsert on their unique keys, and a
 * listing's media rows are replaced wholesale, which is the same "re-uploading
 * a manifest replaces media rows" behaviour lib/schema.ts describes.
 *
 * The r2_key values below are local /demo/*.jpg paths, not R2 object keys —
 * they render today because Gallery uses r2_key directly as an <img src>. Once
 * R2 and signed URLs land, this seed's keys need to change with it.
 */

import { neon } from '@neondatabase/serverless';

const PHOTOS = [
  ['living-room', 'Living room', 1600, 1067],
  ['stair-detail', 'Stair detail', 1067, 1600],
  ['kitchen', 'Kitchen', 1600, 1067],
  ['courtyard', 'Courtyard', 1067, 1600],
  ['primary-suite', 'Primary suite', 1600, 1067],
  ['study', 'Study', 1067, 1600],
  ['pool-terrace', 'Pool terrace', 1600, 1067],
  ['entry', 'Entry', 1067, 1600],
  ['aerial', 'Aerial', 1600, 900],
  ['elevation-dusk', 'Elevation at dusk', 1600, 900],
];

const CLIENT = {
  email: 'agent@briggsfreeman.com',
  name: 'Demo Agent',
  company: 'Briggs Freeman Sotheby’s',
  team: 'demo-team',
};

// One locked and one unlocked, so both sides of the payment gate are reviewable.
const LISTINGS = [
  {
    address: '4200 Preston Hollow Lane',
    slug: 'preston-hollow-lane',
    city: 'Dallas, TX',
    shootDate: '2026-08-14',
    coverKey: '/demo/elevation-dusk.jpg',
    downloadLocked: true,
  },
  {
    address: '18 Rockwall Shores Drive',
    slug: 'rockwall-shores-drive',
    city: 'Rockwall, TX',
    shootDate: '2026-08-14',
    coverKey: '/demo/courtyard.jpg',
    downloadLocked: false,
  },
];

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Run with: node --env-file=.env.local scripts/seed-portal.mjs');
  process.exit(1);
}

const sql = neon(databaseUrl);

// Guard against seeding a database the migration has not been applied to.
const [applied] = await sql`
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'listings'
`;
if (!applied) {
  console.error('No "listings" table found. Apply the migration first (POST /api/portal/migrate).');
  process.exit(1);
}

const [client] = await sql`
  INSERT INTO clients ("email", "name", "company", "team")
  VALUES (${CLIENT.email}, ${CLIENT.name}, ${CLIENT.company}, ${CLIENT.team})
  ON CONFLICT ("email") DO UPDATE
    SET "name" = EXCLUDED."name",
        "company" = EXCLUDED."company",
        "team" = EXCLUDED."team"
  RETURNING "id"
`;
console.log(`client  ${CLIENT.email} -> id ${client.id}`);

for (const l of LISTINGS) {
  const [listing] = await sql`
    INSERT INTO listings
      ("client_id", "address", "slug", "city", "shoot_date", "cover_key", "download_locked")
    VALUES
      (${client.id}, ${l.address}, ${l.slug}, ${l.city}, ${l.shootDate},
       ${l.coverKey}, ${l.downloadLocked})
    ON CONFLICT ("slug") DO UPDATE
      SET "client_id" = EXCLUDED."client_id",
          "address" = EXCLUDED."address",
          "city" = EXCLUDED."city",
          "shoot_date" = EXCLUDED."shoot_date",
          "cover_key" = EXCLUDED."cover_key",
          "download_locked" = EXCLUDED."download_locked"
    RETURNING "id"
  `;

  await sql`DELETE FROM media WHERE "listing_id" = ${listing.id}`;

  let i = 0;
  for (const [key, label, width, height] of PHOTOS) {
    const filename = `SN-${String(i + 1).padStart(3, '0')}-${label.toLowerCase().replace(/\s+/g, '-')}.jpg`;
    await sql`
      INSERT INTO media
        ("listing_id", "kind", "r2_key", "filename", "bytes", "width", "height", "sort")
      VALUES
        (${listing.id}, 'photo', ${`/demo/${key}.jpg`}, ${filename}, ${4_200_000},
         ${width}, ${height}, ${i})
    `;
    i += 1;
  }

  console.log(`listing ${l.slug} -> id ${listing.id}, ${i} media rows, locked=${l.downloadLocked}`);
}

console.log('\nSeed complete.');
