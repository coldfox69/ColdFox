import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Brotli/Gzip response compression (on by default in production, set explicitly).
  compress: true,
  serverExternalPackages: ['imapflow', 'nodemailer', 'exceljs'],
  images: {
    // Serve every optimised image as AVIF first, WebP as the fallback.
    formats: ['image/avif', 'image/webp'],
    // Only the hosts we actually render images from.
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1440, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    // lucide-react and recharts are already optimised by Next.js by default.
    // Recharts is the heaviest client dependency, so it is only loaded by the
    // two screens that need it (see `dynamic()` in the analytics views).
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
      {
        // Static brand assets: cached at the edge for a year, revalidated in
        // the browser hourly so a replaced file is picked up quickly.
        source: '/:file(\\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2?))',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
