import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // e2e-only build directory: pnpm test:e2e builds+starts with NEXT_DIST_DIR=.next-e2e,
  // fully isolated from the running .next (dev / production preview) — rebuilding .next while a server serves
  // from it mixes old and new chunks
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // next build must invoke the project's .bin/tsc (TS 7.0.2) for a real type check; type errors must not be ignored.
  experimental: {
    useTypeScriptCli: true,
  },
  typescript: {
    // ignoreBuildErrors: true must never appear
  },
  images: {
    // Brand images are local static assets, kept out of the image optimization pipeline (avoids the sharp dependency)
    unoptimized: true,
  },
  async headers() {
    // CSP is not configured here: proxy.ts builds it per request and ships it on every rewritten response
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63036000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // CJK font subset artifacts: filenames carry a content hash, safe to serve immutable
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // The coverage manifest URL carries no hash and changes on each re-cut, so it must not be immutable (only the
        // reconciliation gate reads the file; this header just prevents a future HTTP consumer from caching a year-old version)
        source: '/fonts/noto-sc-subset-chars.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
