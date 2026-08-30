import { Router } from 'express';
import { db } from '../db.js';
import { getSiteWithTrend, listSitesWithTrend } from '../services/enrich.js';

export const sitesRouter = Router();

const INTERVENTION_TYPES = [
  'Check-dam',
  'Plantation',
  'Pond',
  'Contour trench',
  'Percolation tank',
  'Afforestation',
  'Other',
];

// List all sites with trend (for map + dashboard).
sitesRouter.get('/', (req, res) => {
  res.json(listSitesWithTrend());
});

sitesRouter.get('/meta/intervention-types', (req, res) => {
  res.json(INTERVENTION_TYPES);
});

// Single site with observations, photos, trend.
sitesRouter.get('/:id', (req, res) => {
  const site = getSiteWithTrend(Number(req.params.id));
  if (!site) return res.status(404).json({ error: 'Site not found' });
  res.json(site);
});

sitesRouter.post('/', (req, res) => {
  const parsed = validate(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const v = parsed.value;
  const info = db
    .prepare(
      `INSERT INTO sites (name, district, state, latitude, longitude, intervention_type, intervention_date, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      v.name,
      v.district,
      v.state,
      v.latitude,
      v.longitude,
      v.intervention_type,
      v.intervention_date,
      v.description
    );
  res.status(201).json(getSiteWithTrend(Number(info.lastInsertRowid)));
});

sitesRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Site not found' });
  const parsed = validate({ ...existing, ...req.body });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const v = parsed.value;
  db.prepare(
    `UPDATE sites SET name=?, district=?, state=?, latitude=?, longitude=?,
       intervention_type=?, intervention_date=?, description=? WHERE id=?`
  ).run(
    v.name,
    v.district,
    v.state,
    v.latitude,
    v.longitude,
    v.intervention_type,
    v.intervention_date,
    v.description,
    id
  );
  res.json(getSiteWithTrend(id));
});

sitesRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM sites WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Site not found' });
  res.json({ ok: true, deleted: id });
});

function validate(body) {
  const name = str(body.name);
  const district = str(body.district);
  const latitude = num(body.latitude);
  const longitude = num(body.longitude);
  const intervention_type = str(body.intervention_type);

  if (!name) return { error: 'name is required' };
  if (!district) return { error: 'district is required' };
  if (latitude === null || latitude < -90 || latitude > 90)
    return { error: 'latitude must be between -90 and 90' };
  if (longitude === null || longitude < -180 || longitude > 180)
    return { error: 'longitude must be between -180 and 180' };
  if (!intervention_type) return { error: 'intervention_type is required' };

  return {
    value: {
      name,
      district,
      state: str(body.state) || '',
      latitude,
      longitude,
      intervention_type,
      intervention_date: str(body.intervention_date) || null,
      description: str(body.description) || '',
    },
  };
}

function str(v) {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}
function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
