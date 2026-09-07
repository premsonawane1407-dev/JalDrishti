// Curated, clearly-labelled land-use distribution per site (sample data).
// Correlated with the site's latest NDVI/NDWI so it reads plausibly, and
// deterministic (seeded) so it's stable. Swap for a real land-cover source
// (ESA WorldCover / Dynamic World / Sentinel-2 SCL) later — same mock-first
// pattern as the satellite layer.

import { seededRng } from './heatmap.js';

const CLASSES = [
  { key: 'Agriculture', color: '#c2963a' },
  { key: 'Forest', color: '#2f8f5b' },
  { key: 'Built-up', color: '#9a8c7a' },
  { key: 'Water', color: '#2c8fb8' },
  { key: 'Other', color: '#b8b0a0' },
];

export function landUseFor(site, observations = []) {
  const latest = observations[observations.length - 1];
  const ndvi = latest?.ndvi ?? 0.3;
  const ndwi = latest?.ndwi ?? -0.1;
  const rng = seededRng(`landuse-${site.id}`);

  let forest = 12 + ndvi * 45 + (rng() - 0.5) * 6;
  let agri = 22 + ndvi * 28 + (rng() - 0.5) * 8;
  let water = 3 + Math.max(0, ndwi + 0.2) * 26 + (rng() - 0.5) * 3;
  let built = 4 + rng() * 8;
  forest = clamp(forest, 6, 55);
  agri = clamp(agri, 15, 55);
  water = clamp(water, 2, 18);
  built = clamp(built, 3, 16);
  let other = Math.max(0, 100 - (forest + agri + water + built));

  // Normalise to exactly 100.
  const raw = { Agriculture: agri, Forest: forest, 'Built-up': built, Water: water, Other: other };
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const distribution = CLASSES.map((c) => ({
    name: c.key,
    color: c.color,
    pct: Math.round((raw[c.key] / total) * 100),
  }));
  // fix rounding drift so it sums to 100
  const drift = 100 - distribution.reduce((a, d) => a + d.pct, 0);
  distribution.sort((a, b) => b.pct - a.pct)[0].pct += drift;

  return { source: 'sample', note: 'Curated demo land-use — swap for ESA WorldCover / Dynamic World.', distribution };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
