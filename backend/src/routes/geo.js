import { Router } from 'express';
import multer from 'multer';
import { db } from '../db.js';
import { getGeoLayers } from '../services/geodata.js';

export const geoRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// All GIS layers (watershed boundaries, streams, water bodies, structures)
// as GeoJSON FeatureCollections, plus summary totals for the stat cards.
geoRouter.get('/geo', (req, res) => {
  res.json(getGeoLayers());
});

// Individual layer (handy for debugging / selective loading).
geoRouter.get('/geo/:layer', (req, res) => {
  const layers = getGeoLayers();
  const layer = layers[req.params.layer];
  if (!layer) return res.status(404).json({ error: 'Unknown layer' });
  res.json(layer);
});

// --- Per-site real GeoJSON (Phase 3) ---

// Status of a site's boundary/layers: real (uploaded) vs sample.
geoRouter.get('/sites/:id/geo', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT source, updated_at FROM site_geo WHERE site_id = ?').get(id);
  const layers = getGeoLayers();
  const pick = (fc) => fc.features.filter((f) => f.properties.site_id === id);
  const boundary = pick(layers.watersheds)[0];
  res.json({
    hasReal: Boolean(row),
    source: row?.source ?? 'sample',
    updatedAt: row?.updated_at ?? null,
    boundaryAreaKm2: boundary?.properties?.area_km2 ?? null,
    counts: {
      streams: pick(layers.streams).length,
      waterbodies: pick(layers.waterbodies).length,
      structures: pick(layers.structures).length,
    },
  });
});

// Upload a real GeoJSON (from QGIS / SRISHTI-DRISHTI) for a site.
// Accepts a file (field "geojson") or a JSON body { geojson: <object|string> }.
geoRouter.post('/sites/:id/geo', upload.single('geojson'), (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT id FROM sites WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Site not found' });
  }

  let raw = null;
  if (req.file) raw = req.file.buffer.toString('utf8');
  else if (typeof req.body?.geojson === 'string') raw = req.body.geojson;
  else if (req.body?.geojson && typeof req.body.geojson === 'object') raw = JSON.stringify(req.body.geojson);
  if (!raw) return res.status(400).json({ error: 'No GeoJSON provided (file field "geojson" or body.geojson)' });

  let gj;
  try { gj = JSON.parse(raw); } catch { return res.status(400).json({ error: 'File is not valid JSON/GeoJSON' }); }

  const check = validateGeoJson(gj);
  if (check.error) return res.status(400).json({ error: check.error });

  db.prepare(
    `INSERT INTO site_geo (site_id, geojson, source, updated_at) VALUES (?, ?, 'upload', datetime('now'))
     ON CONFLICT(site_id) DO UPDATE SET geojson=excluded.geojson, source='upload', updated_at=datetime('now')`
  ).run(id, JSON.stringify(gj));

  // Return the freshly-computed status for this site.
  const layers = getGeoLayers();
  const boundary = layers.watersheds.features.find((f) => f.properties.site_id === id);
  res.status(201).json({
    ok: true,
    features: check.counts,
    boundaryAreaKm2: boundary?.properties?.area_km2 ?? null,
  });
});

geoRouter.delete('/sites/:id/geo', (req, res) => {
  const info = db.prepare('DELETE FROM site_geo WHERE site_id = ?').run(Number(req.params.id));
  res.json({ ok: true, removed: info.changes > 0 });
});

function validateGeoJson(gj) {
  let feats = [];
  if (gj?.type === 'FeatureCollection') feats = gj.features || [];
  else if (gj?.type === 'Feature') feats = [gj];
  else if (gj?.type && gj.coordinates) feats = [{ type: 'Feature', geometry: gj }];
  else return { error: 'Not a GeoJSON Feature, FeatureCollection or Geometry' };

  const counts = { polygons: 0, lines: 0, points: 0 };
  let sample = null;
  for (const f of feats) {
    const t = f.geometry?.type || '';
    if (/Polygon$/.test(t)) counts.polygons++;
    else if (/LineString$/.test(t)) counts.lines++;
    else if (/Point$/.test(t)) counts.points++;
    if (!sample) sample = firstCoord(f.geometry);
  }
  if (counts.polygons + counts.lines + counts.points === 0) return { error: 'GeoJSON has no usable geometry' };
  if (counts.polygons === 0 && counts.lines === 0) return { error: 'Provide at least one polygon (boundary/water body) or line (stream)' };
  // Must be WGS84 lon/lat degrees, not a projected CRS in metres.
  if (sample && (Math.abs(sample[0]) > 180 || Math.abs(sample[1]) > 90)) {
    return { error: 'Coordinates look projected (metres). Re-export as EPSG:4326 / WGS84 (lon-lat degrees).' };
  }
  return { counts };
}

function firstCoord(geom) {
  let c = geom?.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) ? c : null;
}
