/**
 * Checks lib/sigv4.ts's presign() against AWS's own published example for a
 * presigned GET (S3 docs, "Authenticating Requests: Using Query Parameters").
 *
 * This exists because the signing is written out by hand rather than taken from
 * @aws-sdk/s3-request-presigner, and because no R2 bucket exists yet to try it
 * against. If this passes, a 403 from R2 is a credentials or bucket-name
 * problem, not a signature one.
 *
 *   node scripts/check-sigv4.mjs
 */

import { presign } from '../lib/sigv4.ts';

const EXPECTED = 'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404';

const url = presign({
  host: 'examplebucket.s3.amazonaws.com',
  canonicalUri: '/test.txt',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  expiresIn: 86400,
  now: new Date('2013-05-24T00:00:00Z'),
});

const actual = new URL(url).searchParams.get('X-Amz-Signature');

if (actual === EXPECTED) {
  console.log('SigV4 presigning matches the AWS reference vector.');
} else {
  console.error('SigV4 presigning does NOT match the AWS reference vector.');
  console.error('  expected', EXPECTED);
  console.error('  actual  ', actual);
  console.error('  url     ', url);
  process.exit(1);
}
