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
export type MediaView = Media & { previewUrl: string };
