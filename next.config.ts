import type { NextConfig } from 'next';

// This app has no server-side dependency, so it can be published as a static
// site by GitHub Pages.
const pagesPath = process.env.PAGES_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  // Keep the HTML export at the artifact root while loading Next assets from
  // the repository path used by GitHub Pages.
  assetPrefix: pagesPath,
  trailingSlash: true,
};

export default nextConfig;
