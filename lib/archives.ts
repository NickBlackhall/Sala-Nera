import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDatabase } from '@/lib/db';
import { chooseFile, type Delivery, type Resolution } from '@/lib/downloads';
import { sendEmail } from '@/lib/email';
import { formatSize } from '@/lib/media-view';
import { archives, media, type Archive, type Listing, type Media } from '@/lib/schema';
import { TIME_ZONE } from '@/lib/scheduling';
import { deleteObjects, MissingObjectError, objectSize, putObjectStream, readObject } from '@/lib/storage';
import { record } from '@/lib/telemetry';
import { zipLength, zipStream } from '@/lib/zip';

/**
 * "Download all photos": one zip per listing per size, built once on the
 * server, kept in R2 beside the photos, and handed out as one signed link.
 *
 * Why this shape, in short (HANDOFF.md has the long version): a page that
 * saves thirty files at once is stopped by Chrome after the first; streaming
 * a zip through a Vercel function on every download runs into the Hobby
 * plan's transfer allowance and five-minute limit; and zipping in the browser
 * runs phones out of memory. Building it once, from R2 back into R2, puts
 * the wait on Nick instead of the client, and the client's download comes
 * straight from R2 like every other file.
 *
 * Photos only. A film is one file, downloaded on its own, and would add
 * hundreds of megabytes to both zips for nothing.
 *
 * When one is built:
 *   - Nick sends the "ready to download" email: both are built first, and
 *     the email does not go if either fails. Fresh ones are reused.
 *   - Nick presses Prepare/Rebuild downloads on the listing.
 *   - A client asks for one that is missing (a listing delivered before
 *     this existed, or one changed since): built then, while their page
 *     waits and asks again every few seconds.
 *
 * What stops an old zip leaving: its `version`, a fingerprint of every entry
 * name (which carries the gallery order) and the object each came from. A zip
 * is only handed out when its version is the listing's version now. Changing
 * the photos also deletes the out-of-date zips (discardStaleArchives), but
 * that is tidying; the version check is the guarantee.
 */

export const RESOLUTIONS: Resolution[] = ['high', 'low'];

/** A build is cut off at 300s (Vercel Hobby). One still "building" after this is dead. */
const STALLED_MS = 6 * 60_000;
/** How soon a client may set off a new attempt after one failed. Nick can retry at once. */
export const CLIENT_RETRY_MS = 10 * 60_000;
/** R2 takes up to 4.995 GiB (5.36 GB) in one upload. Kept well under it. */
const MAX_ARCHIVE_BYTES = 5_000_000_000;
/** How long Nick's button waits on a build someone else started. */
const WAIT_MS = 270_000;

/** One photo as it goes into a zip. */
export type ArchiveItem = { name: string; key: string; delivery: Delivery };

export type ArchiveState = 'none' | 'missing' | 'building' | 'ready' | 'failed';

export type ArchivePlan = {
  listing: Pick<Listing, 'id' | 'slug' | 'address'>;
  resolution: Resolution;
  items: ArchiveItem[];
  version: string;
  /** The row for this exact version, if one has ever been started. */
  row: Archive | null;
  /** none: no photos. missing: never built, or thrown away since. */
  state: ArchiveState;
  /** Why it failed, when it did. */
  error: string | null;
};

/** No folders, no path tricks, nothing a Windows or Mac file system refuses. */
function entryName(filename: string): string {
  const clean = filename
    .replace(/[\\/:*?"<>|\u0000-\u001F\u007F]+/g, '-')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(-150);
  return clean || 'photo.jpg';
}

/**
 * The photos a zip holds, in gallery order, named as they will unzip:
 * "01 - DJI_0573.jpg". The number keeps MLS uploads and file browsers in
 * Nick's order; the original name keeps each file recognisable. The low-res
 * zip keeps the "-low-res" suffix the single download has, so both sizes can
 * share a folder.
 */
export function archiveItems(rows: Media[], resolution: Resolution): ArchiveItem[] {
  const photos = rows
    .filter((m) => m.kind === 'photo')
    .sort((a, b) => a.sort - b.sort || a.id - b.id);
  const width = Math.max(2, String(photos.length).length);
  const used = new Set<string>();

  return photos.map((item, i) => {
    const delivery = chooseFile(item, resolution);
    let name = `${String(i + 1).padStart(width, '0')} - ${entryName(delivery.filename)}`;
    // The number already makes every name unique. This is the belt to its braces.
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      name = name.replace(/(\.[^.]*)?$/, (ext) => ` (${n})${ext}`);
    }
    used.add(name.toLowerCase());
    return { name, key: delivery.key, delivery };
  });
}

export function archiveVersion(resolution: Resolution, items: ArchiveItem[]): string {
  return createHash('sha256')
    .update(JSON.stringify(['v1', resolution, items.map((i) => [i.name, i.key])]))
    .digest('hex')
    .slice(0, 16);
}

/**
 * Unique to each attempt, not just each version, so nothing one attempt does
 * to its object can touch another's — a slow attempt that finishes after a
 * newer one started only ever deletes its own file.
 */
function archiveKey(slug: string, resolution: Resolution, version: string): string {
  return `archives/${slug}/${version}/${randomUUID().slice(0, 8)}/photos-${resolution}.zip`;
}

/**
 * What the zip saves as: "18-Rockwall-Shores-Drive_Photos_High-Res.zip".
 * Plain ASCII, so no browser, phone or file system mangles it; the page can
 * say it more prettily.
 */
export function archiveFilename(address: string, resolution: Resolution): string {
  const place =
    address
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/, '') || 'Sala-Nera';
  return `${place}_Photos_${resolution === 'high' ? 'High' : 'Low'}-Res.zip`;
}

function stateOf(row: Archive | null, count: number): { state: ArchiveState; error: string | null } {
  if (count === 0) return { state: 'none', error: null };
  if (!row) return { state: 'missing', error: null };
  if (row.status === 'ready') return { state: 'ready', error: null };
  if (row.status === 'failed') return { state: 'failed', error: row.error };
  if (Date.now() - new Date(row.startedAt).getTime() < STALLED_MS) return { state: 'building', error: null };
  return { state: 'failed', error: row.error ?? 'It stopped before finishing, probably out of time.' };
}

/** Both sizes' zips for a listing as it is right now, and where each stands. */
export async function planArchives(
  listing: Pick<Listing, 'id' | 'slug' | 'address'>,
  rows: Media[],
): Promise<Record<Resolution, ArchivePlan>> {
  const drafts = RESOLUTIONS.map((resolution) => {
    const items = archiveItems(rows, resolution);
    return { resolution, items, version: archiveVersion(resolution, items) };
  });

  const found = await getDatabase()
    .select()
    .from(archives)
    .where(
      and(
        eq(archives.listingId, listing.id),
        isNull(archives.expiresAt),
        inArray(archives.version, drafts.map((d) => d.version)),
      ),
    );

  const plans = drafts.map((d) => {
    const row = found.find((r) => r.resolution === d.resolution && r.version === d.version) ?? null;
    return { listing, ...d, row, ...stateOf(row, d.items.length) };
  });
  return { high: plans[0], low: plans[1] };
}

type Claim = { id: number; key: string };

/**
 * Take the right to build this zip, or learn that someone else has it.
 *
 * One statement, so two requests at the same instant cannot both win: the
 * unique index on (listing, size, version) decides. An existing row can be
 * taken over only if its last attempt failed long enough ago, or has been
 * "building" so long it must have died.
 */
async function claim(plan: ArchivePlan, retryFailedAfterMs: number): Promise<Claim | null> {
  const key = archiveKey(plan.listing.slug, plan.resolution, plan.version);
  const retrySeconds = Math.round(retryFailedAfterMs / 1000);
  const stalledSeconds = STALLED_MS / 1000;

  const rows = await getDatabase()
    .insert(archives)
    .values({
      listingId: plan.listing.id,
      resolution: plan.resolution,
      version: plan.version,
      r2Key: key,
      status: 'building',
      photos: plan.items.length,
    })
    .onConflictDoUpdate({
      target: [archives.listingId, archives.resolution, archives.version],
      set: { r2Key: key, status: 'building', startedAt: sql`now()`, finishedAt: null, error: null, bytes: null },
      setWhere: sql`(${archives.status} = 'failed'
          and ${archives.finishedAt} <= now() - ${retrySeconds}::int * interval '1 second')
        or (${archives.status} = 'building'
          and ${archives.startedAt} < now() - ${stalledSeconds}::int * interval '1 second')`,
    })
    .returning({ id: archives.id });

  return rows[0] ? { id: rows[0].id, key } : null;
}

/** Said in terms of the photo, so Nick knows which one to look at. */
class BuildError extends Error {}

export type BuildResult = { ok: true; bytes: number; seconds: number } | { ok: false; error: string };

const label = (r: Resolution) => (r === 'high' ? 'High res' : 'Low res');

/**
 * Make the zip and store it. Never throws: a failure is written to the row
 * and returned, in words.
 */
async function build({ id, key }: Claim, plan: ArchivePlan): Promise<BuildResult> {
  const db = getDatabase();
  const began = Date.now();
  const mine = and(eq(archives.id, id), eq(archives.r2Key, key), eq(archives.status, 'building'));

  // A missing object is named by its photo, not its storage key.
  const named = async <R>(item: ArchiveItem, fetchIt: (key: string) => Promise<R>): Promise<R> => {
    try {
      return await fetchIt(item.key);
    } catch (error) {
      if (error instanceof MissingObjectError) {
        throw new BuildError(`${item.delivery.item.filename} is missing from storage.`);
      }
      throw error;
    }
  };

  let streamError: unknown = null;
  try {
    // Sizes first: the upload has to declare its length before it starts.
    const sized: (ArchiveItem & { size: number })[] = [];
    for (let i = 0; i < plan.items.length; i += 8) {
      const batch = plan.items.slice(i, i + 8);
      const sizes = await Promise.all(batch.map((item) => named(item, objectSize)));
      batch.forEach((item, j) => sized.push({ ...item, size: sizes[j] }));
    }

    const length = zipLength(sized);
    if (length > MAX_ARCHIVE_BYTES) {
      throw new BuildError(`It would be ${formatSize(length)}, over the 5 GB one upload allows.`);
    }

    // An error while making the zip reaches fetch as "fetch failed", which
    // says nothing. Keep the real one, so Nick is told which photo.
    const made = zipStream(sized, (item) => named(item, readObject), { modified: new Date(), timeZone: TIME_ZONE });
    await putObjectStream(key, length, 'application/zip', (async function* () {
      try {
        yield* made;
      } catch (error) {
        streamError = error;
        throw error;
      }
    })());

    const done = await db
      .update(archives)
      .set({ status: 'ready', bytes: length, finishedAt: sql`now()` })
      .where(mine)
      .returning({ id: archives.id });

    if (done.length === 0) {
      // Thrown away while it was being made, because the photos changed.
      // Nothing will ever point at this file.
      await deleteObjects([key]);
      return { ok: false, error: 'The photos changed while it was being made. Try again.' };
    }

    // Whatever this listing had before is out of date now.
    await discardStaleArchives(plan.listing.id);
    return { ok: true, bytes: length, seconds: Math.round((Date.now() - began) / 1000) };
  } catch (caught) {
    const error = streamError ?? caught;
    const message =
      error instanceof BuildError
        ? error.message
        : `Storage could not be reached (${error instanceof Error ? error.message : String(error)}).`;
    console.error(`archives: ${plan.resolution} zip for listing ${plan.listing.id} failed`, error);
    try {
      await db.update(archives).set({ status: 'failed', error: message, finishedAt: sql`now()` }).where(mine);
    } catch (writeError) {
      console.error('archives: could not record the failure', writeError);
    }
    return { ok: false, error: message };
  }
}

/** Build, and write down what happened for /admin/activity. */
async function buildAndRecord(claimed: Claim, plan: ArchivePlan, by: string | null): Promise<BuildResult> {
  const result = await build(claimed, plan);
  const what = `${label(plan.resolution)} zip for ${plan.listing.address}`;
  await record(
    result.ok
      ? {
          kind: 'download', outcome: 'ok', reason: 'archive_built', email: by,
          detail: `${what}: ${plan.items.length} photos, ${formatSize(result.bytes)}, in ${result.seconds}s`,
        }
      : { kind: 'download', outcome: 'failed', reason: 'archive_failed', email: by, detail: `${what}: ${result.error}` },
  );
  return result;
}

/** Wait on a build that someone else — usually a client — started. */
async function waitFor(plan: ArchivePlan): Promise<BuildResult | { ok: true }> {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const [row] = await getDatabase()
      .select()
      .from(archives)
      .where(
        and(
          eq(archives.listingId, plan.listing.id),
          eq(archives.resolution, plan.resolution),
          eq(archives.version, plan.version),
        ),
      );
    const { state, error } = stateOf(row ?? null, plan.items.length);
    if (state === 'ready') return { ok: true };
    if (state !== 'building') return { ok: false, error: error ?? 'It was stopped part way through. Try again.' };
  }
  return { ok: false, error: 'It is still being made. Try again in a minute.' };
}

export type PrepareResult =
  | { ok: true; plans: Record<Resolution, ArchivePlan> }
  | { ok: false; error: string };

/**
 * Nick's side: make sure both zips exist for the listing as it is now,
 * building whatever is missing, and wait until they do. Fresh ones are
 * reused, so pressing Send twice does not build twice.
 */
export async function prepareArchives(
  listing: Pick<Listing, 'id' | 'slug' | 'address'>,
  rows: Media[],
  by: string | null,
): Promise<PrepareResult> {
  const plans = await planArchives(listing, rows);

  const results = await Promise.all(
    RESOLUTIONS.map(async (resolution) => {
      const plan = plans[resolution];
      if (plan.state === 'none' || plan.state === 'ready') return { ok: true as const };
      const claimed = await claim(plan, 0);
      return claimed ? buildAndRecord(claimed, plan, by) : waitFor(plan);
    }),
  );

  const failures = results
    .map((result, i) => (result.ok ? null : `${label(RESOLUTIONS[i])}: ${result.error}`))
    .filter(Boolean);
  if (failures.length > 0) return { ok: false, error: failures.join(' ') };

  return { ok: true, plans: await planArchives(listing, rows) };
}

/**
 * A client's side, for a zip that is missing: take the build if nobody else
 * has, and return the work to run after the response goes — the page asks
 * again every few seconds until it is ready. Null when someone else is
 * already on it, or it failed too recently to try again unasked.
 */
export async function startArchive(
  plan: ArchivePlan,
  by: string,
): Promise<(() => Promise<void>) | null> {
  const claimed = await claim(plan, CLIENT_RETRY_MS);
  if (!claimed) return null;

  return async () => {
    const result = await buildAndRecord(claimed, plan, by);
    if (!result.ok) await tellNick(plan, by, result.error);
  };
}

/** A client is waiting on a download that could not be made. Nick hears at once. */
async function tellNick(plan: ArchivePlan, by: string, error: string): Promise<void> {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) return;
  const base = process.env.PORTAL_URL ?? 'https://salanera.com';
  await sendEmail({
    to,
    subject: `Download couldn't be prepared — ${plan.listing.address}`,
    text: [
      `${by} pressed Download all photos (${label(plan.resolution)}) on ${plan.listing.address}, and the zip could not be made:`,
      '',
      error,
      '',
      'Open the listing and press Rebuild downloads to try again:',
      `${base}/admin/listings/${plan.listing.id}`,
    ].join('\n'),
  });
}

/**
 * Delete this listing's zips that no longer match its photos: rows and files.
 * Called after anything that changes what a zip would hold — an upload, a
 * delete, a reorder, new copies — and after every successful build.
 *
 * `all` also takes the current ones, for when a photo's copies were remade
 * over the same keys: the version cannot see that, so the zips must go.
 *
 * Tidying, not the safeguard (see the top of this file), so it never throws:
 * the change that called it has already happened.
 */
export async function discardStaleArchives(
  listingId: number,
  { all = false }: { all?: boolean } = {},
): Promise<void> {
  try {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(archives)
      .where(and(eq(archives.listingId, listingId), isNull(archives.expiresAt)));
    if (rows.length === 0) return;

    let stale = rows;
    if (!all) {
      const items = await db.select().from(media).where(eq(media.listingId, listingId));
      const current = Object.fromEntries(
        RESOLUTIONS.map((r) => [r, archiveVersion(r, archiveItems(items, r))]),
      ) as Record<Resolution, string>;
      stale = rows.filter((row) => row.version !== current[row.resolution]);
    }
    if (stale.length === 0) return;

    // Rows first: a build still running for one of these then finds its row
    // gone when it finishes, and deletes its own file.
    await db.delete(archives).where(inArray(archives.id, stale.map((r) => r.id)));
    await deleteObjects(stale.map((r) => r.r2Key));
  } catch (error) {
    console.error('archives: could not discard out-of-date zips', { listingId, error });
  }
}

/** Every zip file a listing owns, read before the listing (and so its rows) is deleted. */
export async function getListingArchiveKeys(listingId: number): Promise<string[]> {
  const rows = await getDatabase()
    .select({ r2Key: archives.r2Key })
    .from(archives)
    .where(eq(archives.listingId, listingId));
  return rows.map((r) => r.r2Key);
}
