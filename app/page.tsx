import HomeClient from './home-client';

// Vinext server-renders routes by default. Explicitly marking this route as
// static ensures output: 'export' emits the index.html required by GitHub Pages.
export const dynamic = 'force-static';

export default function Home() {
  return <HomeClient />;
}
