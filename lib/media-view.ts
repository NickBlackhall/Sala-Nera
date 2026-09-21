import type { Media } from '@/lib/schema';

/**
 * A media row as the gallery renders it: the database columns plus a URL to
 * point an <img> at.
 *
 * This lives in its own module because both sides need it — lib/storage.ts
 * builds it on the server, and the Gallery client component consumes it — and
 * lib/storage.ts is `server-only`, which a client component cannot import from
 * even for a type.
 */
/**
 * Photos per makeCopiesAction call — here because the upload component sends
 * batches this size and the action caps at it, and a 'use server' file may
 * only export functions. Each photo is a second or two of CPU.
 */
export const COPIES_BATCH = 3;

export type MediaView = Media & {
  /** The small grid copy — tiles in the gallery and the admin grid. For a video, its still; null until it has one. */
  previewUrl: string | null;
  /** The 2400px copy — click-to-enlarge, or a video's poster. Null for a video with no still. */
  largeUrl: string | null;
  /** A video's own file, for <video>. Null for photos. */
  videoUrl: string | null;
};
