/**
 * What the browser can tell about a video before it is uploaded: its shape as
 * a viewer sees it, and one still to show before it plays.
 *
 * Done here, not on the server, because decoding video there needs ffmpeg,
 * which Vercel functions do not have — and the file is already on this
 * machine. Phones store vertical video sideways with a rotate flag; the
 * browser applies it, so width and height here are the upright shape.
 *
 * A browser that cannot decode the file (HEVC on some Windows machines,
 * ProRes almost anywhere) gets null. The video still uploads; it simply has no
 * still, and the player learns its shape once it plays.
 *
 * Needs `blob:` in the CSP's media-src (next.config.mjs), since the file is
 * played from an object URL.
 */
export type VideoProbe = { width: number; height: number; frame: Blob };

/**
 * The still goes to a server action, whose request body Next caps at 1MB. A
 * 1920px JPEG of a video frame is a few hundred KB; the smaller retry is for
 * the rare frame full of fine detail.
 */
const ATTEMPTS = [
  { edge: 1920, quality: 0.85 },
  { edge: 1280, quality: 0.8 },
];
export const FRAME_MAX_BYTES = 900_000;

export async function probeVideo(file: File, timeoutMs = 20_000): Promise<VideoProbe | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timed out')), timeoutMs);
  });

  try {
    return await Promise.race([read(video, url), timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** Resolves on `event`, rejects on the element's error; `start` kicks it off once listening. */
function once(video: HTMLVideoElement, event: string, start: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener(event, done);
      reject(new Error('could not decode'));
    };
    video.addEventListener(event, done, { once: true });
    video.addEventListener('error', fail, { once: true });
    start();
  });
}

async function read(video: HTMLVideoElement, url: string): Promise<VideoProbe> {
  await once(video, 'loadeddata', () => {
    video.src = url;
  });
  const { videoWidth: width, videoHeight: height, duration } = video;
  if (!width || !height) throw new Error('no picture');

  // A second in, or a tenth of the way through a short clip: past a fade from black.
  const at = Number.isFinite(duration) ? Math.min(1, duration / 10) : 0;
  await once(video, 'seeked', () => {
    video.currentTime = at;
  });

  for (const { edge, quality } of ATTEMPTS) {
    const frame = await still(video, width, height, edge, quality);
    if (frame.size <= FRAME_MAX_BYTES) return { width, height, frame };
  }
  throw new Error('still too large');
}

function still(video: HTMLVideoElement, width: number, height: number, edge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, edge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no still'))), 'image/jpeg', quality),
  );
}
