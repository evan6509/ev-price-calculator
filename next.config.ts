import type { NextConfig } from 'next';

// This app has no server-side dependency, so it can be published as a static
// site by GitHub Pages.
const basePath = process.env.PAGES_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
};

export default nextConfig;
