import 'server-only';

import sharp from 'sharp';

/**
 * Smaller copies of an uploaded photo, so a gallery never has to pull the
 * original to show a thumbnail.
 *
 * Nick's originals are 8192px on the long edge and 6.5–16.5MB each; before
 * this existed, opening a 32-photo gallery downloaded all 332MB of them. Every
 * copy is made once, on the server, right after upload — not in the browser,
 * where output varies by device and colour handling is unreliable, and not by
 * an image CDN, which fits badly with a private bucket and expiring URLs.
 *
 * The original is never modified. It stays the high-res download.
 *
 *   grid   the tile in the client gallery and the admin grid
 *   large  click-to-enlarge, the cover banner, and the low-res download —
 *          one file doing three jobs, so it is a JPEG, never WebP
 *   high   only when the original cannot itself be the high-res download:
 *          over the MLS size cap, or not a JPEG at all
 *
 * Every copy is auto-rotated from EXIF, converted to sRGB with the profile
 * embedded, and stripped of all other metadata — including GPS, which has no
 * business leaving in a file an agent reposts publicly.
 */

/** Long edge, in pixels. A vertical still gets 800px across: enough for a 2x tile. */
export const GRID_EDGE = 1200;
export const LARGE_EDGE = 2400;

/**
 * The upload cap Nick works to for MLS: 19MB, read as decimal megabytes —
 * the smaller of the two readings, so a file under it is under either.
 */
export const MLS_MAX_BYTES = 19_000_000;

export type CopySize = 'grid' | 'large' | 'high';

export type Copies = {
  /** The original's size once rotated upright — what a viewer actually sees. */
  width: number;
  height: number;
  grid: Buffer;
  large: Buffer;
  /** Null when the original is fine to hand out as the high-res file. */
  high: Buffer | null;
};

/**
 * Lenient on purpose: camera and drone JPEGs often carry small spec
 * violations that sharp's default ('warning') refuses outright. Only a file
 * that genuinely cannot be decoded should fail.
 */
const INPUT = { failOn: 'error' } as const;

export async function makeCopies(original: Buffer): Promise<Copies> {
  const meta = await sharp(original, INPUT).metadata();
  if (!meta.width || !meta.height) throw new Error('not a readable image');

  // Orientations 5–8 are stored sideways: upright, width and height swap.
  const sideways = (meta.orientation ?? 1) >= 5;
  const width = sideways ? meta.height : meta.width;
  const height = sideways ? meta.width : meta.height;

  const large = await sharp(original, INPUT)
    .autoOrient()
    .resize({ width: LARGE_EDGE, height: LARGE_EDGE, fit: 'inside', withoutEnlargement: true })
    .withIccProfile('srgb')
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  // From the large copy rather than the original: it is already upright and
  // sRGB, and decoding 2400px is a fraction of the work of decoding 8192px.
  const grid = await sharp(large)
    .resize({ width: GRID_EDGE, height: GRID_EDGE, fit: 'inside', withoutEnlargement: true })
    .withIccProfile('srgb')
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  const needsHigh = meta.format !== 'jpeg' || original.length > MLS_MAX_BYTES;
  const high = needsHigh ? await makeHigh(original, width) : null;

  return { width, height, grid, large, high };
}

/**
 * A full-resolution JPEG under the MLS cap. Quality steps down first, because
 * it costs far less visibly than pixels do; only if that is not enough does
 * the image shrink. Practically never reached for Nick's own exports, which
 * are JPEGs well under the cap — it is here for the TIFF or the 100MP pano.
 */
async function makeHigh(original: Buffer, uprightWidth: number): Promise<Buffer> {
  const encode = (quality: number, width?: number) => {
    const pipeline = sharp(original, INPUT).autoOrient();
    if (width) pipeline.resize({ width });
    return pipeline.withIccProfile('srgb').jpeg({ quality }).toBuffer();
  };

  for (const quality of [92, 88, 84, 80]) {
    const out = await encode(quality);
    if (out.length <= MLS_MAX_BYTES) return out;
  }

  for (let scale = 0.85; scale > 0.2; scale *= 0.85) {
    const out = await encode(80, Math.round(uprightWidth * scale));
    if (out.length <= MLS_MAX_BYTES) return out;
  }

  throw new Error('could not get a high-res copy under the MLS cap');
}

/**
 * Where a copy of this original lives: a copies/ folder beside it, so the R2
 * dashboard shows a listing's originals at the top level and nothing else.
 *
 *   listings/rockwall/3f…-IMG_4233.jpg
 *   listings/rockwall/copies/3f…-IMG_4233-grid.jpg
 */
export function copyKey(r2Key: string, size: CopySize): string {
  const slash = r2Key.lastIndexOf('/');
  const dir = r2Key.slice(0, slash);
  const base = r2Key.slice(slash + 1).replace(/\.[^.]*$/, '');
  return `${dir}/copies/${base}-${size}.jpg`;
}
