import 'server-only';

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
 * A media row plus the URL its <img> should point at.
 *
 * Previews are signed too, because the bucket is private — there is no "public
 * thumbnail, private original" split. Keep previewUrl for rendering and r2Key
 * for identity: the admin page compares a listing's coverKey against media
 * keys, and comparing signed URLs would never match twice.
 */
export type { MediaView };

export function withPreviewUrls(items: Media[]): MediaView[] {
  return items.map((item) => ({
    ...item,
    previewUrl: mediaUrl(item.r2Key, { expiresIn: PREVIEW_TTL }),
  }));
}

/** A signed URL for a cover image or any other single key rendered inline. */
export function previewUrl(key: string): string {
  return mediaUrl(key, { expiresIn: PREVIEW_TTL });
}
