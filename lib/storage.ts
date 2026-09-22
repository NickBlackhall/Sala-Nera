import 'server-only';

import { readFile, stat } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import type { MediaView } from '@/lib/media-view';
import { encodeKey, presign, R2_REGION } from '@/lib/sigv4';
import type { Media } from '@/lib/schema';

/**
 * Where media bytes actually live, and how a URL to them is minted.
 *
 * Two modes, chosen by whether R2 is configured:
 *
 *   Configured — keys are R2 object keys and every URL is a presigned GET that
 *   expires. The bucket stays private, so this is the only way in, for previews
 *   as well as downloads.
 *
 *   Not configured — keys are local paths under /public (what scripts/seed-portal.mjs
 *   writes today) and are returned unchanged. This is a development fallback,
 *   NOT protection: anyone with the path can fetch the file. isRemoteStorage()
 *   is exported so callers can say so honestly rather than implying a lock.
 *
 * The signing itself is in lib/sigv4.ts, checked against AWS's published
 * reference vector by scripts/check-sigv4.mjs. It has not yet been run against
 * a real bucket, because no bucket exists yet — but a 403 from R2 on the first
 * try would therefore be credentials or a bucket name, not the signature.
 */

/** How long a minted URL stays good. Previews outlive one page view; downloads are one click. */
export const PREVIEW_TTL = 60 * 60; // 1 hour
export const DOWNLOAD_TTL = 60 * 5; // 5 minutes
// The public property website: a buyer may leave the tab open for hours
// before scrolling. Only ever used for the smaller copies of a paid listing.
export const PUBLIC_TTL = 60 * 60 * 24; // 24 hours
// Generous: a big property film on a slow upload should not race the clock.
export const UPLOAD_TTL = 60 * 30; // 30 minutes
// A finished "Download all photos" zip: hundreds of MB on a phone, so a
// dropped connection that picks up again should still find its link good.
// Only zips get this; every other download keeps DOWNLOAD_TTL.
export const ARCHIVE_TTL = 60 * 60; // 1 hour

type R2Config = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  // All four or none. A partial config is a deployment mistake, and silently
  // falling back to unsigned local paths would hide it behind working previews.
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;

  return { accountId, bucket, accessKeyId, secretAccessKey };
}

/** True when media is served from R2 and URLs actually expire. */
export function isRemoteStorage(): boolean {
  return r2Config() !== null;
}

export type SignOptions = {
  /** Seconds until the URL stops working. */
  expiresIn?: number;
  /**
   * Filename to force a save-as under. When set, the URL carries a
   * Content-Disposition override so the browser downloads instead of
   * navigating — and the client keeps the original name, not the object key.
   */
  downloadAs?: string;
};

/**
 * A URL for one stored object.
 *
 * Returns local paths untouched, so the demo gallery keeps rendering with no R2
 * account. Note that in that mode downloadAs is not honoured: a local path
 * cannot carry a response-header override, and the caller's `download`
 * attribute is what names the file instead.
 */
export function mediaUrl(key: string, options: SignOptions = {}): string {
  const config = r2Config();
  if (!config) return key;

  const { expiresIn = PREVIEW_TTL, downloadAs } = options;

  const extraParams: Record<string, string> = {};
  if (downloadAs) {
    // Quotes escaped, and the name stripped of anything that could break out of
    // the header — a filename is client-supplied data once uploads exist.
    const safe = downloadAs.replace(/[\r\n"\\]/g, '').trim() || 'download';
    extraParams['response-content-disposition'] = `attachment; filename="${safe}"`;
  }

  return presign({
    host: `${config.accountId}.r2.cloudflarestorage.com`,
    canonicalUri: `/${encodeKey(config.bucket)}/${encodeKey(key.replace(/^\/+/, ''))}`,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: R2_REGION,
    expiresIn,
    extraParams,
  });
}

/**
 * A media row plus the URLs its <img>s and <video> should point at.
 *
 * Both point at the smaller copies from lib/media-copies.ts, falling back to
 * the original for a photo whose copies have not been made yet (anything
 * uploaded before they existed). A video's copies are its still, and it has no
 * fallback picture; its file is videoUrl. Previews are signed too, because
 * the bucket is private. Keep these URLs for rendering and r2Key for identity:
 * the admin page compares a listing's coverKey against media keys, and
 * comparing signed URLs would never match twice.
 */
export type { MediaView };

export function withPreviewUrls(items: Media[]): MediaView[] {
  return items.map((item) =>
    item.kind === 'video'
      ? {
          // A video never falls back to its own file as a picture: an <img>
          // pointed at an MP4 is just a broken image.
          ...item,
          previewUrl: item.gridKey ? previewUrl(item.gridKey) : null,
          largeUrl: item.largeKey ? previewUrl(item.largeKey) : null,
          videoUrl: previewUrl(item.r2Key),
        }
      : {
          ...item,
          previewUrl: previewUrl(item.gridKey ?? item.r2Key),
          largeUrl: previewUrl(item.largeKey ?? item.r2Key),
          videoUrl: null,
        },
  );
}

/** A signed URL for any single key rendered inline. */
export function previewUrl(key: string): string {
  return mediaUrl(key, { expiresIn: PREVIEW_TTL });
}

/**
 * A listing's cover, as one of its copies.
 *
 * coverKey stores the original's key — it is an identity, compared against
 * media rows — so the copy has to be looked up from the row it names. Falls
 * back to the original when that row has no copies yet, or is not in `rows`.
 */
export function coverUrl(
  coverKey: string,
  rows: Pick<Media, 'r2Key' | 'gridKey' | 'largeKey'>[],
  size: 'grid' | 'large',
): string {
  const row = rows.find((r) => r.r2Key === coverKey);
  const copy = size === 'grid' ? row?.gridKey : row?.largeKey;
  return previewUrl(copy ?? coverKey);
}

/** Every stored object one media row owns: the original and any copies. */
export function mediaObjectKeys(
  row: Pick<Media, 'r2Key' | 'gridKey' | 'largeKey' | 'highKey'>,
): string[] {
  return [row.r2Key, row.gridKey, row.largeKey, row.highKey].filter(
    (key): key is string => Boolean(key),
  );
}

/**
 * Read a whole object into memory, server-side. Only used to make copies of a
 * photo, so the ceiling is a large JPEG — never call this on a video.
 */
export async function getObject(key: string): Promise<Buffer> {
  const res = await fetch(mediaUrl(key, { expiresIn: DOWNLOAD_TTL }));
  if (!res.ok) throw new Error(`R2 GET ${key} answered ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Write an object from the server — the copies, which are made here and so
 * have no browser to upload them. Same signed PUT the browser uses.
 */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const url = uploadUrl(key);
  if (!url) throw new Error('R2 is not configured');

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`R2 PUT ${key} answered ${res.status}`);
}

/**
 * A signed PUT URL for a browser to upload one object straight to R2 — the
 * bytes never pass through a Vercel function, which would bill for every
 * gigabyte and cap out well below a real property film's size. Returns null
 * when R2 isn't configured: there is nowhere for an uploaded file to land.
 *
 * The bucket must allow PUT from this site's origin in its CORS settings —
 * a presigned URL does not bypass CORS, only the bucket's own ACL.
 */
export function uploadUrl(key: string): string | null {
  const config = r2Config();
  if (!config) return null;

  return presign({
    host: `${config.accountId}.r2.cloudflarestorage.com`,
    canonicalUri: `/${encodeKey(config.bucket)}/${encodeKey(key.replace(/^\/+/, ''))}`,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: R2_REGION,
    expiresIn: UPLOAD_TTL,
    method: 'PUT',
  });
}

/**
 * A signed DELETE for one object, used server-side rather than handed to the
 * browser: deleting is a bare request with no body, so there is nothing to
 * gain from going direct, and keeping it on the server means the bucket's
 * CORS policy never needs to allow DELETE from a browser origin.
 *
 * Null when R2 isn't configured, which also covers the seeded demo rows —
 * their keys are /public paths, and there is no object to remove.
 */
export function deleteUrl(key: string): string | null {
  const config = r2Config();
  if (!config) return null;

  return presign({
    host: `${config.accountId}.r2.cloudflarestorage.com`,
    canonicalUri: `/${encodeKey(config.bucket)}/${encodeKey(key.replace(/^\/+/, ''))}`,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: R2_REGION,
    expiresIn: DOWNLOAD_TTL,
    method: 'DELETE',
  });
}

/**
 * Remove the bytes behind one key, best effort. Shared by deleting one photo,
 * deleting a whole listing, and throwing away a zip that is out of date.
 *
 * Never throws: the row it belonged to is already gone by the time this runs,
 * so a failure here leaves an orphaned object in a private bucket that nothing
 * links to. That costs a fraction of a cent and is invisible to clients, which
 * is why it is logged rather than surfaced.
 */
async function deleteObject(r2Key: string): Promise<void> {
  // Seeded demo rows keep their bytes under /public, where there is nothing
  // to delete and no signed URL to do it with.
  if (isLocalKey(r2Key)) return;

  const url = deleteUrl(r2Key);
  if (!url) return;

  try {
    const res = await fetch(url, { method: 'DELETE' });
    // R2 answers 204 on success, and on deleting something already gone.
    if (!res.ok && res.status !== 404) {
      console.error(`media delete: R2 kept ${r2Key} (${res.status})`);
    }
  } catch (error) {
    console.error(`media delete: R2 unreachable for ${r2Key}`, error);
  }
}

/** A few objects at a time, so a 200-photo listing neither crawls nor floods R2. */
const DELETE_CONCURRENCY = 8;

export async function deleteObjects(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += DELETE_CONCURRENCY) {
    await Promise.all(keys.slice(i, i + DELETE_CONCURRENCY).map(deleteObject));
  }
}

/** A seeded demo file under /public, refusing anything that climbs out of it. */
function localPath(key: string): string {
  const root = join(process.cwd(), 'public');
  const path = normalize(join(root, key));
  if (!path.startsWith(root + '/')) throw new Error(`${key}: not a local media path`);
  return path;
}

/** Thrown when storage says an object is not there, so callers can say which file. */
export class MissingObjectError extends Error {}

function signedFor(key: string, method: 'GET' | 'HEAD'): string {
  const config = r2Config();
  if (!config) throw new Error('R2 is not configured');
  return presign({
    host: `${config.accountId}.r2.cloudflarestorage.com`,
    canonicalUri: `/${encodeKey(config.bucket)}/${encodeKey(key.replace(/^\/+/, ''))}`,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: R2_REGION,
    expiresIn: DOWNLOAD_TTL,
    method,
  });
}

/**
 * An object's size in bytes, without fetching it. A zip's length has to be
 * known before its upload starts, and the copies' sizes are not in the
 * database — only the originals' are.
 *
 * Demo rows are read from /public, so the demo gallery can zip too.
 */
export async function objectSize(key: string): Promise<number> {
  if (isLocalKey(key)) {
    try {
      return (await stat(localPath(key))).size;
    } catch {
      throw new MissingObjectError(key);
    }
  }
  const res = await fetch(signedFor(key, 'HEAD'), { method: 'HEAD' });
  if (res.status === 404) throw new MissingObjectError(key);
  if (!res.ok) throw new Error(`R2 HEAD ${key} answered ${res.status}`);
  const length = Number(res.headers.get('content-length'));
  if (!Number.isSafeInteger(length)) throw new Error(`R2 HEAD ${key} gave no size`);
  return length;
}

/** One object's bytes. Photos only — every caller holds the whole file in memory. */
export async function readObject(key: string): Promise<Uint8Array> {
  if (isLocalKey(key)) {
    try {
      return await readFile(localPath(key));
    } catch {
      throw new MissingObjectError(key);
    }
  }
  const res = await fetch(signedFor(key, 'GET'));
  if (res.status === 404) throw new MissingObjectError(key);
  if (!res.ok) throw new Error(`R2 GET ${key} answered ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Upload an object that is being made as it goes — a zip — without ever
 * holding it whole. One signed PUT, the same kind every upload already uses,
 * streamed with its length declared up front.
 *
 * Deliberately not a multipart upload. R2 only accepts GET, HEAD, PUT and
 * DELETE through signed URLs, so multipart would need a second way of signing
 * requests. A single PUT takes up to 4.995 GiB, far more than a gallery's
 * photos come to, and it is all or nothing: if it fails part way, R2 keeps
 * nothing, so there is no half-written object to abort or clean up.
 */
export async function putObjectStream(
  key: string,
  length: number,
  contentType: string,
  chunks: AsyncIterable<Uint8Array>,
): Promise<void> {
  const url = uploadUrl(key);
  if (!url) throw new Error('R2 is not configured');

  // Pulled one chunk at a time, so the zip is only made as fast as R2 takes
  // it. An error while making it errors the stream, and with it the upload.
  const iterator = chunks[Symbol.asyncIterator]();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    async cancel(reason) {
      await iterator.return?.(reason);
    },
  });

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(length) },
    body,
    // Required by fetch for a streamed request body.
    duplex: 'half',
  } as RequestInit);
  if (!res.ok) throw new Error(`R2 PUT ${key} answered ${res.status}`);
}

/** True for a seeded demo row, whose bytes live under /public and not in R2. */
export function isLocalKey(key: string): boolean {
  return key.startsWith('/');
}
