/**
 * Signed R2 URLs live on a different origin, so every place the browser touches
 * one — <img> previews, <video>, and the admin upload's PUT — has to name that
 * host in the CSP or the browser blocks it with no network error to chase.
 * Empty until R2 is configured, which keeps the policy at its tightest until
 * there is something real to allow. Note a newly added env var needs a redeploy
 * before this header changes.
 */
const accountId = process.env.R2_ACCOUNT_ID;
const r2Origin = accountId && /^[a-zA-Z0-9]+$/.test(accountId)
  ? ` https://${accountId}.r2.cloudflarestorage.com`
  : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Media is content-addressed by name; a long cache is safe and keeps
        // repeat visitors from re-downloading the hero clip.
        source: '/media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; img-src 'self' data:${r2Origin}; media-src 'self'${r2Origin}; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'; connect-src 'self'${r2Origin}; upgrade-insecure-requests`,
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};
export default nextConfig;
