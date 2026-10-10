/** @type {import('next').NextConfig} */
const DEFAULT_FIRM_SLUG = process.env.NEXT_PUBLIC_DEFAULT_FIRM_SLUG || 'prime-estates';

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
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
