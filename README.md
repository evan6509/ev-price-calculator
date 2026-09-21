# Drive Cost

A single-trip energy-cost calculator for comparing gas, diesel, and electric vehicles. Enter the route distance, local energy prices, and a shared trailer weight to see the estimated cost for every vehicle side by side.

The site is published to [GitHub Pages](https://evan6509.github.io/ev-price-calculator/) when changes are pushed to `main`.

## What it does

- Compare as many gas, diesel, and electric vehicles as needed.
- Use MPG for gas and diesel vehicles, or miles per kWh for EVs.
- Calculate a round trip from one entered one-way distance.
- Apply one trailer weight to every vehicle, from 0 to 20,000 lb.
- Adjust gas, diesel, and electricity prices.
- Optionally count an EV's return-trip electricity as free when campground charging is included.
- Rank the vehicles by estimated trip energy cost and show per-mile cost, energy used, and adjusted trip efficiency.

## Estimate assumptions

This is an energy-cost comparison only. It does not include a vehicle's purchase price, maintenance, insurance, depreciation, charging time, taxes, or other ownership costs.

The trailer-load adjustment is a simplified estimate, not a manufacturer range or towing guarantee. Real-world results can vary with trailer shape, terrain, speed, weather, vehicle configuration, driving style, and charging or fuel prices.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server.

## Validate a production build

```bash
npm run build
npm run start
```

`npm run build` writes the production output to `dist/`.

## Deployment

The GitHub Actions workflow at [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds and deploys the site whenever `main` is updated. It uses Node 22 and prepares the generated assets for the repository path used by GitHub Pages.

## Tech stack

- React 19 and TypeScript
- Vinext and Vite
- Tailwind CSS
- Base UI and shadcn/ui components
