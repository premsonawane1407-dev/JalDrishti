// Land-use distribution per site.
//   - REAL: computed from an uploaded land-cover raster (ESA WorldCover /
//     Dynamic World), stored in `site_landcover`. See routes/analyze.js.
//   - SAMPLE (fallback): curated, NDVI-correlated, deterministic — clearly
//     labelled — so the UI always has something to show.

import { db } from '../db.js';
import { seededRng } from './heatmap.js';

export const CLASS_COLORS = {
  Agriculture: '#c2963a',
  Forest: '#2f8f5b',
  'Built-up': '#9a8c7a',
  Water: '#2c8fb8',
  Other: '#b8b0a0',
};
const CLASSES = Object.keys(CLASS_COLORS);

/** Stored REAL land-cover distribution for a site, or null. */
export function storedLandUse(siteId) {
  const row = db.prepare('SELECT distribution, source, updated_at FROM site_landcover WHERE site_id = ?').get(siteId);
  if (!row) return null;
  try { return { source: row.source, updatedAt: row.updated_at, distribution: JSON.parse(row.distribution) }; }
  catch { return null; }
}

/** Real land-cover if uploaded, otherwise the curated sample. */
export function resolveLandUse(site, observations) {
  return storedLandUse(site.id) || landUseFor(site, observations);
}

/** Curated sample distribution (fallback). */
export function landUseFor(site, observations = []) {
  const latest = observations[observations.length - 1];
  const ndvi = latest?.ndvi ?? 0.3;
  const ndwi = latest?.ndwi ?? -0.1;
  const rng = seededRng(`landuse-${site.id}`);

  let forest = 12 + ndvi * 45 + (rng() - 0.5) * 6;
  let agri = 22 + ndvi * 28 + (rng() - 0.5) * 8;
  let water = 3 + Math.max(0, ndwi + 0.2) * 26 + (rng() - 0.5) * 3;
  let built = 4 + rng() * 8;
  forest = clamp(forest, 6, 55); agri = clamp(agri, 15, 55); water = clamp(water, 2, 18); built = clamp(built, 3, 16);
  const other = Math.max(0, 100 - (forest + agri + water + built));

  const raw = { Agriculture: agri, Forest: forest, 'Built-up': built, Water: water, Other: other };
  return { source: 'sample', note: 'Curated demo land-use — swap for ESA WorldCover / Dynamic World.', distribution: toDistribution(raw) };
}

/** Turn raw {class: value} weights into rounded percentages summing to 100. */
export function toDistribution(raw) {
  const total = CLASSES.reduce((a, k) => a + (raw[k] || 0), 0) || 1;
  const distribution = CLASSES.map((k) => ({ name: k, color: CLASS_COLORS[k], pct: Math.round(((raw[k] || 0) / total) * 100) }));
  const drift = 100 - distribution.reduce((a, d) => a + d.pct, 0);
  if (distribution.length) [...distribution].sort((a, b) => b.pct - a.pct)[0].pct += drift;
  return distribution;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
