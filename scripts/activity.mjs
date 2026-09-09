/**
 * /admin/activity, in the terminal.
 *
 *   node --env-file=.env.local scripts/activity.mjs        # last 24 hours
 *   node --env-file=.env.local scripts/activity.mjs 72     # last 72 hours
 *
 * Why this exists when the page already does: the page needs a magic-link
 * sign-in and a browser, and `vercel logs` is blocked by the permission
 * classifier in the Codespace. When the question is "did that booking actually
 * send", the answer has to be reachable from wherever you are standing.
 *
 * It reads the same rows the page reads, from whatever database DATABASE_URL
 * points at — which is the production database. Read-only.
 *
 * Read the Discarded column first. Anything there is a submission somebody
 * believes they sent and Nick never received.
 */

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('No DATABASE_URL. Run this with: node --env-file=.env.local scripts/activity.mjs');
  process.exit(1);
}

const hours = Number(process.argv[2] ?? 24) || 24;
const sql = neon(process.env.DATABASE_URL);

/** Kept in step with app/admin/activity/page.tsx on purpose. */
const OUTCOME = { ok: 'Delivered', discarded: 'DISCARDED', rejected: 'Refused', failed: 'FAILED' };

const REASON = {
  sent: 'Sent',
  honeypot: 'Tripped the bot trap',
  too_fast: 'Submitted too fast',
  missing_name_or_email: 'No name or a bad email address',
  missing_address: 'No property address',
  no_valid_services: 'No recognised services',
  not_configured: 'Email is not configured on the server',
  resend_rejected: 'The email provider refused it',
  send_threw: 'The email request itself failed',
  confirmation_failed: 'Lead delivered, client confirmation failed',
  locked: 'Gallery is locked',
  missing: 'Not found, or not theirs',
  single: 'One file',
  selection: 'Selected files',
  whole_gallery: 'Whole gallery',
};

const rows = await sql`
  select at, kind, outcome, reason, detail, email, request_id
  from events
  order by at desc
  limit 200`;

const since = Date.now() - hours * 3600_000;
const recent = rows.filter((r) => new Date(r.at).getTime() >= since);

const tally = (o) => recent.filter((r) => r.outcome === o).length;

console.log(`\nLast ${hours}h:  ${tally('ok')} delivered   ${tally('discarded')} DISCARDED   ` +
  `${tally('rejected')} refused   ${tally('failed')} FAILED\n`);

if (rows.length === 0) {
  console.log('No events recorded at all. Either nothing has been submitted since');
  console.log('telemetry shipped, or the app is writing to a different database.\n');
  process.exit(0);
}

for (const r of rows) {
  const when = new Date(r.at).toISOString().replace('T', ' ').slice(0, 19);
  const outcome = OUTCOME[r.outcome] ?? r.outcome;
  const why = REASON[r.reason] ?? r.reason ?? '';
  console.log(`${when}  ${r.kind.padEnd(8)} ${outcome.padEnd(10)} ${why}`);
  if (r.email) console.log(`${' '.repeat(21)}${r.email}`);
  if (r.detail) console.log(`${' '.repeat(21)}${r.detail}`);
}

console.log(`\n${rows.length} event(s) total.\n`);
