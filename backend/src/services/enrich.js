import { db } from '../db.js';
import { computeTrend } from './trend.js';
import { landUseFor } from './landuse.js';

const siteStmt = db.prepare('SELECT * FROM sites WHERE id = ?');
const allSitesStmt = db.prepare('SELECT * FROM sites ORDER BY name');
const obsStmt = db.prepare(
  'SELECT * FROM observations WHERE site_id = ? ORDER BY observation_date'
);
const photosStmt = db.prepare(
  'SELECT * FROM photos WHERE site_id = ? ORDER BY COALESCE(taken_at, created_at)'
);

/** Full detail for one site: observations, photos, and computed trend. */
export function getSiteWithTrend(id) {
  const site = siteStmt.get(id);
  if (!site) return null;
  const observations = obsStmt.all(id);
  const photos = photosStmt.all(id);
  const trend = computeTrend(observations);
  return { ...site, observations, photos, trend };
}

/** Lightweight list for the map/dashboard: each site + its trend (no photos). */
export function listSitesWithTrend() {
  return allSitesStmt.all().map((site) => {
    const observations = obsStmt.all(site.id);
    const trend = computeTrend(observations);
    const latest = observations[observations.length - 1] ?? null;
    const lu = landUseFor(site, observations).distribution;
    const dominantLandUse = [...lu].sort((a, b) => b.pct - a.pct)[0] ?? null;
    return {
      ...site,
      observationCount: observations.length,
      latestNdvi: latest ? latest.ndvi : null,
      latestNdwi: latest ? latest.ndwi : null,
      latestObservationDate: latest ? latest.observation_date : null,
      dominantLandUse,
      trend,
    };
  });
}
