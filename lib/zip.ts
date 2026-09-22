import { crc32 } from 'node:zlib';

/**
 * A ZIP writer for the "Download all photos" archives — see lib/archives.ts.
 *
 * Written out rather than pulled in, like lib/sigv4.ts, and for a reason
 * beyond size: the libraries that stream ZIPs write every entry with a
 * trailing "data descriptor" and mark the whole archive as needing ZIP 4.5,
 * because they cannot know a file's checksum until they have streamed it.
 * Some unzippers still stumble on that. Here each photo is read whole before
 * its header is written (the largest is under 20MB), so every header carries
 * its real checksum and size, and the archive is the plain, oldest layout
 * that every unzipper reads — Windows, macOS, iPhone Files, Android.
 *
 * Only the archive is streamed, never held whole: one photo in memory at a
 * time, plus the next few being fetched.
 *
 * Store mode only. A JPEG is already compressed; deflating it again costs CPU
 * and saves almost nothing.
 *
 * ZIP64 is used only where the plain format runs out: an entry that starts
 * past 4GB, or a directory past 4GB or 65,535 entries. A single entry must be
 * under 4GB, which a photo always is.
 */

export type ZipEntry = { name: string; size: number };

export type ZipOptions = {
  /** Stamped on every entry. Unzippers read it as local time, so it is written in `timeZone`. */
  modified?: Date;
  timeZone?: string;
  /**
   * Where a 32-bit field overflows into ZIP64. Always 0xFFFFFFFF in real use;
   * a check script lowers it so the ZIP64 paths can be proven on a few bytes.
   */
  zip64From?: number;
  /** How many entries to fetch ahead of the one being written. */
  readAhead?: number;
};

const MAX32 = 0xffffffff;
const MAX16 = 0xffff;

const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const ZIP64_EXTRA = 12; // id, length, one 8-byte offset
const ZIP64_END = 56;
const ZIP64_LOCATOR = 20;
const END = 22;

// 2.0 is the plain format; 4.5 is what ZIP64 requires, and only an entry or
// archive that actually uses it says so.
const VERSION_PLAIN = 20;
const VERSION_ZIP64 = 45;
// "Made by" Unix, so the mode below is honoured: a regular file, rw-r--r--.
const MADE_BY_UNIX = 3 << 8;
const FILE_MODE = (0o100644 << 16) >>> 0;
// Bit 11: the name is UTF-8. Only set when it has to be.
const FLAG_UTF8 = 1 << 11;

type Laid = { name: Buffer; size: number; offset: number; utf8: boolean };

function layout(entries: ZipEntry[], zip64From: number) {
  let offset = 0;
  const laid: Laid[] = entries.map((entry) => {
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size >= MAX32) {
      throw new Error(`${entry.name}: a single file must be under 4GB`);
    }
    const name = Buffer.from(entry.name, 'utf8');
    if (name.length > MAX16) throw new Error(`${entry.name}: name too long`);
    const row = { name, size: entry.size, offset, utf8: /[^\x20-\x7e]/.test(entry.name) };
    offset += LOCAL_HEADER + name.length + entry.size;
    return row;
  });

  const centralOffset = offset;
  const centralSize = laid.reduce(
    (n, e) => n + CENTRAL_HEADER + e.name.length + (e.offset >= zip64From ? ZIP64_EXTRA : 0),
    0,
  );
  const zip64End =
    laid.length >= MAX16 || centralOffset >= zip64From || centralSize >= zip64From;
  const total =
    centralOffset + centralSize + (zip64End ? ZIP64_END + ZIP64_LOCATOR : 0) + END;

  return { laid, centralOffset, centralSize, zip64End, total };
}

/**
 * The exact size of the archive these entries make, known before a byte is
 * read. R2 needs it up front: a single upload must declare its length.
 */
export function zipLength(entries: ZipEntry[], options: ZipOptions = {}): number {
  return layout(entries, options.zip64From ?? MAX32).total;
}

/** MS-DOS date and time, the only timestamp every unzipper understands. */
function dosDateTime(date: Date, timeZone: string): { time: number; date: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;

  return {
    time: (parts.hour << 11) | (parts.minute << 5) | (parts.second >> 1),
    date: ((Math.max(parts.year, 1980) - 1980) << 9) | (parts.month << 5) | parts.day,
  };
}

/**
 * The archive, as a stream of chunks. `read` fetches one entry's bytes; it is
 * called a few entries ahead, in order, so the next photo is on its way while
 * this one is written.
 *
 * Throws if any entry's bytes do not match the size it was declared with,
 * rather than write an archive whose length no longer matches what the upload
 * promised.
 */
export async function* zipStream<T extends ZipEntry>(
  entries: T[],
  read: (entry: T) => Promise<Uint8Array>,
  options: ZipOptions = {},
): AsyncGenerator<Uint8Array> {
  const zip64From = options.zip64From ?? MAX32;
  const readAhead = Math.max(1, options.readAhead ?? 3);
  const { laid, centralOffset, centralSize, zip64End, total } = layout(entries, zip64From);
  const stamp = dosDateTime(options.modified ?? new Date(), options.timeZone ?? 'UTC');

  // Fetches started ahead of time get a no-op catch so a failure is not
  // reported as unhandled while an earlier entry is still being written; the
  // same promise is awaited, and throws, when its turn comes.
  const pending: Promise<Uint8Array>[] = [];
  const start = (i: number) => {
    if (i >= entries.length) return;
    const p = read(entries[i]);
    p.catch(() => {});
    pending[i] = p;
  };
  for (let i = 0; i < readAhead; i++) start(i);

  const crcs: number[] = [];
  let written = 0;

  for (let i = 0; i < laid.length; i++) {
    const entry = laid[i];
    const data = await pending[i];
    delete pending[i];
    start(i + readAhead);

    if (data.byteLength !== entry.size) {
      throw new Error(`${entries[i].name}: expected ${entry.size} bytes, got ${data.byteLength}`);
    }
    const crc = crc32(data) >>> 0;
    crcs.push(crc);

    const local = Buffer.alloc(LOCAL_HEADER);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(entry.offset >= zip64From ? VERSION_ZIP64 : VERSION_PLAIN, 4);
    local.writeUInt16LE(entry.utf8 ? FLAG_UTF8 : 0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.size, 18); // compressed size: stored, so the same
    local.writeUInt32LE(entry.size, 22);
    local.writeUInt16LE(entry.name.length, 26);
    local.writeUInt16LE(0, 28);

    yield local;
    yield entry.name;
    yield data;
    written += LOCAL_HEADER + entry.name.length + entry.size;
  }

  const central: Buffer[] = laid.map((entry, i) => {
    const big = entry.offset >= zip64From;
    const header = Buffer.alloc(CENTRAL_HEADER + (big ? ZIP64_EXTRA : 0));
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(MADE_BY_UNIX | (big ? VERSION_ZIP64 : VERSION_PLAIN), 4);
    header.writeUInt16LE(big ? VERSION_ZIP64 : VERSION_PLAIN, 6);
    header.writeUInt16LE(entry.utf8 ? FLAG_UTF8 : 0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(stamp.time, 12);
    header.writeUInt16LE(stamp.date, 14);
    header.writeUInt32LE(crcs[i], 16);
    header.writeUInt32LE(entry.size, 20);
    header.writeUInt32LE(entry.size, 24);
    header.writeUInt16LE(entry.name.length, 28);
    header.writeUInt16LE(big ? ZIP64_EXTRA : 0, 30);
    header.writeUInt16LE(0, 32); // comment
    header.writeUInt16LE(0, 34); // disk
    header.writeUInt16LE(0, 36); // internal attributes
    header.writeUInt32LE(FILE_MODE, 38);
    header.writeUInt32LE(big ? MAX32 : entry.offset, 42);
    if (big) {
      header.writeUInt16LE(0x0001, 46);
      header.writeUInt16LE(8, 48);
      header.writeBigUInt64LE(BigInt(entry.offset), 50);
    }
    return Buffer.concat([header.subarray(0, CENTRAL_HEADER), entry.name, header.subarray(CENTRAL_HEADER)]);
  });

  for (const chunk of central) {
    yield chunk;
    written += chunk.length;
  }

  const count = laid.length;
  if (zip64End) {
    const end64 = Buffer.alloc(ZIP64_END + ZIP64_LOCATOR);
    end64.writeUInt32LE(0x06064b50, 0);
    end64.writeBigUInt64LE(BigInt(ZIP64_END - 12), 4); // size of the rest of this record
    end64.writeUInt16LE(MADE_BY_UNIX | VERSION_ZIP64, 12);
    end64.writeUInt16LE(VERSION_ZIP64, 14);
    end64.writeUInt32LE(0, 16);
    end64.writeUInt32LE(0, 20);
    end64.writeBigUInt64LE(BigInt(count), 24);
    end64.writeBigUInt64LE(BigInt(count), 32);
    end64.writeBigUInt64LE(BigInt(centralSize), 40);
    end64.writeBigUInt64LE(BigInt(centralOffset), 48);
    // The locator: where the record above starts.
    end64.writeUInt32LE(0x07064b50, 56);
    end64.writeUInt32LE(0, 60);
    end64.writeBigUInt64LE(BigInt(centralOffset + centralSize), 64);
    end64.writeUInt32LE(1, 72);
    yield end64;
    written += end64.length;
  }

  const end = Buffer.alloc(END);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(count >= MAX16 ? MAX16 : count, 8);
  end.writeUInt16LE(count >= MAX16 ? MAX16 : count, 10);
  end.writeUInt32LE(centralSize >= zip64From ? MAX32 : centralSize, 12);
  end.writeUInt32LE(centralOffset >= zip64From ? MAX32 : centralOffset, 16);
  end.writeUInt16LE(0, 20);
  yield end;
  written += END;

  if (written !== total) throw new Error(`zip: wrote ${written} bytes, promised ${total}`);
}
