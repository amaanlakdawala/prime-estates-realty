/** @type {import('next').NextConfig} */
const DEFAULT_FIRM_SLUG = process.env.NEXT_PUBLIC_DEFAULT_FIRM_SLUG || 'prime-estates';

// Sent with every page. (Netlify already adds Strict-Transport-Security.)
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, // other sites can't show these pages inside a frame
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  // Links shared before the site served many firms (/properties, /about…) open the demo firm's pages.
  async redirects() {
    return ['/properties', '/properties/:id', '/about', '/services', '/contact'].map((source) => ({
      source,
      destination: `/${DEFAULT_FIRM_SLUG}${source}`,
      permanent: false,
    }));
  },
};

export default nextConfig;
