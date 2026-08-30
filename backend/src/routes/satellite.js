import { Router } from 'express';
import { db } from '../db.js';
import { getObservation, mode } from '../services/sentinelHub.js';
import { computeTrend } from '../services/trend.js';

export const satelliteRouter = Router();

// Report whether we're running against real Sentinel Hub or the mock layer.
satelliteRouter.get('/mode', (req, res) => {
  res.json({ mode: mode(), live: mode() === 'sentinel-hub' });
});

// List cached observations for a site.
satelliteRouter.get('/sites/:id/observations', (req, res) => {
  const id = Number(req.params.id);
  const rows = db
    .prepare('SELECT * FROM observations WHERE site_id = ? ORDER BY observation_date')
    .all(id);
  res.json({ observations: rows, trend: computeTrend(rows) });
});

// Fetch (or return cached) a satellite observation for a site on a date.
// Caching: if an observation already exists for (site, date) we return it
// unless ?force=1 is passed — this avoids repeated Sentinel Hub calls.
satelliteRouter.post('/sites/:id/observations/fetch', async (req, res) => {
  const id = Number(req.params.id);
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const date = normaliseDate(req.body?.date) || today();
  const force = req.query.force === '1' || req.body?.force === true;

  const existing = db
    .prepare('SELECT * FROM observations WHERE site_id = ? AND observation_date = ?')
    .get(id, date);
  if (existing && !force) {
    return res.json({ observation: existing, cached: true });
  }

  const obs = await getObservation({
    siteId: id,
    latitude: site.latitude,
    longitude: site.longitude,
    date,
  });

  db.prepare(
    `INSERT INTO observations (site_id, observation_date, ndvi, ndwi, cloud_coverage, image_filename, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(site_id, observation_date) DO UPDATE SET
       ndvi=excluded.ndvi, ndwi=excluded.ndwi, cloud_coverage=excluded.cloud_coverage,
       image_filename=excluded.image_filename, source=excluded.source`
  ).run(id, date, obs.ndvi, obs.ndwi, obs.cloudCoverage, obs.imageFilename, obs.source);

  const saved = db
    .prepare('SELECT * FROM observations WHERE site_id = ? AND observation_date = ?')
    .get(id, date);
  res.status(201).json({ observation: saved, cached: false });
});

// Delete a cached observation.
satelliteRouter.delete('/observations/:obsId', (req, res) => {
  const info = db.prepare('DELETE FROM observations WHERE id = ?').run(Number(req.params.obsId));
  if (info.changes === 0) return res.status(404).json({ error: 'Observation not found' });
  res.json({ ok: true });
});

function normaliseDate(d) {
  if (!d || typeof d !== 'string') return null;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
