/**
 * AWS SigV4 query presigning, written out rather than pulled from
 * @aws-sdk/s3-request-presigner — it is one function and the SDK is twenty-odd
 * packages.
 *
 * Kept separate from lib/storage.ts, which is `server-only` and holds the R2
 * credentials. Nothing here reads configuration or keeps state: every input,
 * including the clock, is an argument, which is what lets
 * scripts/check-sigv4.mjs check it against AWS's published reference vector.
 */

import { createHash, createHmac } from 'node:crypto';

const ALGORITHM = 'AWS4-HMAC-SHA256';
export const R2_REGION = 'auto'; // R2 has one region and rejects anything else
const SERVICE = 's3';

/**
 * RFC 3986 encoding, which is stricter than encodeURIComponent: the four
 * characters below are legal in a URI but AWS still expects them percent-encoded,
 * and a signature computed over a differently-encoded path will not match.
 */
function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Object keys are paths: encode each segment, keep the separators. */
export function encodeKey(key: string): string {
  return key.split('/').map(uriEncode).join('/');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

/**
 * The signing key is derived in four HMAC steps, each keyed by the previous
 * result. This is what makes a leaked signature useless outside its date,
 * region and service.
 */
function signingKey(secret: string, date: string, region: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), SERVICE), 'aws4_request');
}

/**
 * The signing core, kept parameterised and exported so it can be checked
 * against AWS's own published presigned-URL test vector — see
 * scripts/check-sigv4.mjs. Everything R2-specific lives in lib/storage.ts.
 *
 * `now` is injectable for the same reason: a signature is only reproducible if
 * its timestamp is.
 */
export function presign(input: {
  host: string;
  /** Already-encoded path, leading slash included. */
  canonicalUri: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  expiresIn: number;
  extraParams?: Record<string, string>;
  now?: Date;
}): string {
  const {
    host, canonicalUri, accessKeyId, secretAccessKey, region,
    expiresIn, extraParams = {}, now = new Date(),
  } = input;

  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, ''); // 20260909T101530Z
  const date = amzDate.slice(0, 8);

  const params: Record<string, string> = {
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${accessKeyId}/${date}/${region}/${SERVICE}/aws4_request`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
    ...extraParams,
  };

  // Query parameters must be sorted by encoded key for the canonical request.
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(params[k])}`)
    .join('&');

  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`, // canonical headers block ends with its own newline
    'host',
    'UNSIGNED-PAYLOAD', // a presigned GET has no body to hash
  ].join('\n');

  const stringToSign = [
    ALGORITHM,
    amzDate,
    `${date}/${region}/${SERVICE}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = hmac(
    signingKey(secretAccessKey, date, region),
    stringToSign,
  ).toString('hex');

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
