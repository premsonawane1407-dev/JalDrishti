import { Router } from 'express';
import { db } from '../db.js';
import { listSitesWithTrend } from '../services/enrich.js';

export const dashboardRouter = Router();

// Aggregate view with optional filters:
//   ?district=...&intervention_type=...&from=YYYY-MM-DD&to=YYYY-MM-DD
// (from/to filter on intervention_date)
dashboardRouter.get('/', (req, res) => {
  const { district, intervention_type, from, to } = req.query;
  let sites = listSitesWithTrend();

  if (district) sites = sites.filter((s) => s.district === district);
  if (intervention_type) sites = sites.filter((s) => s.intervention_type === intervention_type);
  if (from) sites = sites.filter((s) => (s.intervention_date || '') >= from);
  if (to) sites = sites.filter((s) => (s.intervention_date || '') <= to);

  const counts = { Improving: 0, Stable: 0, Declining: 0, 'Insufficient data': 0 };
  for (const s of sites) counts[s.trend.label] = (counts[s.trend.label] || 0) + 1;

  const byDistrict = groupCount(sites, 'district');
  const byType = groupCount(sites, 'intervention_type');

  const photoCount = db.prepare('SELECT COUNT(*) AS c FROM photos').get().c;
  const obsCount = db.prepare('SELECT COUNT(*) AS c FROM observations').get().c;

  const avgNdvi =
    sites.length && sites.some((s) => s.latestNdvi != null)
      ? round(
          mean(sites.filter((s) => s.latestNdvi != null).map((s) => s.latestNdvi)),
          3
        )
      : null;

  res.json({
    totals: {
      sites: sites.length,
      observations: obsCount,
      photos: photoCount,
      avgLatestNdvi: avgNdvi,
    },
    counts,
    byDistrict,
    byType,
    filterOptions: {
      districts: distinct(listSitesWithTrend(), 'district'),
      interventionTypes: distinct(listSitesWithTrend(), 'intervention_type'),
    },
    sites: sites.map((s) => ({
      id: s.id,
      name: s.name,
      district: s.district,
      intervention_type: s.intervention_type,
      trend: s.trend.label,
      color: s.trend.color,
      ndviChangePct: s.trend.ndviChangePct,
      latestNdvi: s.latestNdvi,
    })),
  });
});

function groupCount(sites, key) {
  const out = {};
  for (const s of sites) {
    const k = s[key] || 'Unknown';
    if (!out[k]) out[k] = { total: 0, Improving: 0, Stable: 0, Declining: 0, 'Insufficient data': 0 };
    out[k].total += 1;
    out[k][s.trend.label] += 1;
  }
  return Object.entries(out).map(([name, v]) => ({ name, ...v }));
}
function distinct(sites, key) {
  return [...new Set(sites.map((s) => s[key]).filter(Boolean))].sort();
}
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
