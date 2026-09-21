import 'server-only';

import { getDatabase } from '@/lib/db';
import {
  getClientByEmail,
  getClientById,
  ownsListing,
} from '@/lib/portal-queries';
import { downloads, type Listing, type Media } from '@/lib/schema';
import { getSession, type Session } from '@/lib/session';

/**
 * The one place that decides whether a file may leave.
 *
 * Every download path — single file, selection, whole listing — goes through
 * authorizeListing() before a URL is minted. Routes must never check ownership
 * themselves; the checks are subtle (team-aware, admin-exempt, lock-sensitive)
 * and a second implementation is a second chance to get one wrong.
 *
 * Refusals are deliberately two different shapes:
 *
 *   'missing' → answer 404. Not signed in, not your listing, does not exist:
 *   all indistinguishable from outside, so the portal never confirms which
 *   addresses we have shot to someone who is not entitled to know.
 *
 *   'locked' → answer 403 with a reason. The viewer owns this listing and can
 *   already see it; hiding the existence of the paywall from them would just be
 *   a confusing dead button. This is the one case where saying why is correct.
 */

export type Authorized = {
  ok: true;
  session: Session;
  listing: Listing;
};

export type Refused = {
  ok: false;
  reason: 'missing' | 'locked';
};

export type Authorization = Authorized | Refused;

const MISSING: Refused = { ok: false, reason: 'missing' };

/**
 * Admins bypass ownership but NOT the lock check by default, because the lock
 * is what the whole gallery's honesty rests on and an admin download would
 * otherwise log as a delivered file. `allowLocked` is for the admin area's own
 * proofing, and callers must pass it explicitly.
 */
export async function authorizeListing(
  listing: Listing | null,
  { allowLocked = false }: { allowLocked?: boolean } = {},
): Promise<Authorization> {
  const session = await getSession();
  if (!session) return MISSING;
  if (!listing) return MISSING;

  if (!session.isAdmin) {
    const viewer = await getClientByEmail(session.email);
    if (!viewer) return MISSING;
    const owner = await getClientById(listing.clientId);
    if (!ownsListing(viewer, owner)) return MISSING;
  }

  if (listing.downloadLocked && !allowLocked) {
    return { ok: false, reason: 'locked' };
  }

  return { ok: true, session, listing };
}

/**
 * The two sizes a client can take, from the switch beside the download
 * buttons. Anything else — missing, misspelt — means high: the full file is
 * what every download was before the choice existed.
 */
export type Resolution = 'high' | 'low';

export function parseResolution(value: unknown): Resolution {
  return value === 'low' ? 'low' : 'high';
}

/** What actually leaves: which stored object, under what name, at what size. */
export type Delivery = {
  item: Media;
  key: string;
  filename: string;
  resolution: Resolution;
};

/**
 * Which stored object answers a request for this item at this size.
 *
 *   high  the original, or the high copy when one exists — an original over
 *         the MLS cap or not a JPEG (see lib/media-copies.ts)
 *   low   the large copy, 2400px on the long edge
 *
 * A video has one file, so it is that file either way. A photo whose copies
 * have not been made yet has only its original, so low falls back to it.
 * `resolution` records what was delivered, not what was asked for, so the
 * activity log never calls a full-size file low res.
 */
export function chooseFile(item: Media, wanted: Resolution): Delivery {
  if (item.kind === 'photo' && wanted === 'low' && item.largeKey) {
    return {
      item,
      key: item.largeKey,
      // Suffixed, so a client who takes both sizes into one folder can tell
      // them apart instead of getting "IMG_4233 (1).jpg".
      filename: `${stem(item.filename)}-low-res.jpg`,
      resolution: 'low',
    };
  }
  if (item.kind === 'photo' && item.highKey) {
    // The high copy is always a JPEG, whatever the original was.
    return { item, key: item.highKey, filename: `${stem(item.filename)}.jpg`, resolution: 'high' };
  }
  return { item, key: item.r2Key, filename: item.filename, resolution: 'high' };
}

function stem(filename: string): string {
  return filename.replace(/\.[^.]*$/, '') || 'photo';
}

/**
 * Write the activity rows the admin page reads.
 *
 * Logging never blocks a download. If this insert fails the client still gets
 * their files — an unrecorded delivery is a worse outcome than a failed one
 * only for us, and Nick would rather lose a log line than have a paid client
 * hit an error. Failures are left on the server log to be noticed.
 */
export async function recordDownloads(
  listing: Listing,
  deliveries: Delivery[],
  clientEmail: string,
): Promise<void> {
  if (deliveries.length === 0) return;

  try {
    await getDatabase()
      .insert(downloads)
      .values(
        deliveries.map(({ item, resolution }) => ({
          mediaId: item.id,
          listingId: listing.id,
          clientEmail,
          // Denormalised on purpose — see lib/schema.ts. Re-uploading a listing
          // nulls mediaId, and without this the history would read "file".
          // The original's name, not the delivered one: resolution says which.
          filename: item.filename,
          resolution,
        })),
      );
  } catch (error) {
    console.error('[downloads] failed to record activity', error);
  }
}
