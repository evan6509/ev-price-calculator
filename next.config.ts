import type { NextConfig } from 'next';

// This app has no server-side dependency, so it can be published as a static
// site by GitHub Pages.
const nextConfig: NextConfig = {
  output: 'export',
};

export default nextConfig;
