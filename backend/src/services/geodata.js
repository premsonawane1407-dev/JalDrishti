// GIS layers per site: watershed boundary, streams, water bodies, structures —
// as GeoJSON FeatureCollections + summary totals.
//
// Phase 3: layers are DATA-DRIVEN. If a site has REAL GeoJSON uploaded (from
// QGIS / SRISHTI-DRISHTI, stored in the `site_geo` table), those features are
// used. Anything not supplied is synthesised as clearly-labelled sample geometry
// (anchored to the real boundary when one exists), so the map is always complete.

import * as turf from '@turf/turf';
import { db } from '../db.js';
import { seededRng } from './heatmap.js';

let cache = null;
let cacheKey = '';

function currentKey() {
  const s = db.prepare('SELECT id, latitude, longitude FROM sites ORDER BY id').all();
  const g = db.prepare('SELECT site_id, updated_at FROM site_geo').all();
  return (
    s.map((r) => `${r.id}:${r.latitude}:${r.longitude}`).join('|') +
    '#' + g.map((r) => `${r.site_id}@${r.updated_at}`).join('|')
  );
}

export function getGeoLayers() {
  const key = currentKey();
  if (cache && key === cacheKey) return cache;

  const sites = db.prepare('SELECT * FROM sites ORDER BY id').all();
  const geoStmt = db.prepare('SELECT geojson FROM site_geo WHERE site_id = ?');

  const watersheds = [], streams = [], waterbodies = [], structures = [];
  for (const site of sites) {
    const row = geoStmt.get(site.id);
    const real = row ? safeParse(row.geojson) : null;
    const L = siteLayers(site, real);
    watersheds.push(...L.watersheds);
    streams.push(...L.streams);
    waterbodies.push(...L.waterbodies);
    structures.push(...L.structures);
  }

  const summary = {
    watershedAreaKm2: round(watersheds.reduce((a, f) => a + (f.properties.area_km2 || 0), 0), 1),
    waterBodies: waterbodies.length,
    waterBodyAreaHa: round(waterbodies.reduce((a, f) => a + (f.properties.area_ha || 0), 0), 1),
    streamSegments: streams.length,
    drainageKm: round(streams.reduce((a, f) => a + safe(() => turf.length(f, { units: 'kilometers' }), 0), 0), 1),
    structures: structures.length,
    realSites: db.prepare('SELECT COUNT(*) AS c FROM site_geo').get().c,
  };

  cache = {
    watersheds: turf.featureCollection(watersheds),
    streams: turf.featureCollection(streams),
    waterbodies: turf.featureCollection(waterbodies),
    structures: turf.featureCollection(structures),
    summary,
  };
  cacheKey = key;
  return cache;
}

// Build the four layers for one site, mixing real (uploaded) and synthetic.
function siteLayers(site, real) {
  const rng = seededRng(`geo-${site.id}-${site.latitude}-${site.longitude}`);
  const center = [site.longitude, site.latitude];

  let boundaryFeature = null;
  let realStreams = [];
  let realWaterbodies = [];
  let realPoints = [];
  let isReal = false;

  if (real) {
    const feats = toFeatures(real);
    const polys = feats.filter((f) => /Polygon$/.test(f.geometry?.type || ''));
    const lines = feats.filter((f) => /LineString$/.test(f.geometry?.type || ''));
    realPoints = feats.filter((f) => /Point$/.test(f.geometry?.type || ''));

    if (polys.length) {
      // Boundary = a polygon tagged as such, else the largest polygon.
      const tagged = polys.find((f) => /watershed|boundary|catchment|basin/.test(hint(f)));
      boundaryFeature = tagged || polys.slice().sort((a, b) => turf.area(b) - turf.area(a))[0];
      realWaterbodies = polys.filter((f) => f !== boundaryFeature);
      isReal = true;
    }
    realStreams = lines;
  }

  // ---- Boundary (real or synthetic) ----
  let boundary, radiusKm;
  if (boundaryFeature) {
    boundary = turf.feature(boundaryFeature.geometry, {
      kind: 'watershed', site_id: site.id,
      name: boundaryFeature.properties?.name || `${site.name} catchment`,
      area_km2: round(turf.area(boundaryFeature) / 1e6, 1),
      real: true,
    });
    const c = turf.centroid(boundary).geometry.coordinates;
    radiusKm = Math.max(1, Math.sqrt(turf.area(boundary) / 1e6 / Math.PI));
    boundary._center = c;
  } else {
    const b = synthBoundary(center, site, rng);
    boundary = b.feature;
    radiusKm = b.radiusKm;
    boundary._center = center;
  }
  const anchor = boundary._center;
  delete boundary._center;

  // ---- Streams ----
  let streams;
  if (realStreams.length) {
    streams = realStreams.map((f, i) =>
      turf.feature(f.geometry, {
        kind: 'stream', site_id: site.id,
        name: f.properties?.name || `Channel ${i + 1}`,
        order: f.properties?.order || (i === 0 ? 3 : 2), real: true,
      })
    );
  } else {
    streams = synthStreams(anchor, radiusKm, rng, site.id);
  }

  // ---- Water bodies ----
  let waterbodies;
  if (realWaterbodies.length) {
    waterbodies = realWaterbodies.map((f, i) =>
      turf.feature(f.geometry, {
        kind: 'waterbody', site_id: site.id,
        name: f.properties?.name || `Water body ${i + 1}`,
        area_ha: round(turf.area(f) / 1e4, 1), real: true,
      })
    );
  } else {
    waterbodies = synthWaterbodies(streams, radiusKm, rng, site.id);
  }

  // ---- Structures: the site itself + real points, else synthetic extras ----
  const structures = [
    turf.point(center, { kind: 'structure', site_id: site.id, name: site.name, structure_type: site.intervention_type, primary: true }),
  ];
  if (realPoints.length) {
    realPoints.forEach((f, i) =>
      structures.push(turf.point(f.geometry.coordinates, {
        kind: 'structure', site_id: site.id,
        name: f.properties?.name || `Structure ${i + 1}`,
        structure_type: f.properties?.structure_type || site.intervention_type, primary: false, real: true,
      }))
    );
  } else {
    structures.push(...synthStructures(site, streams, radiusKm, rng));
  }

  return { watersheds: [boundary], streams, waterbodies, structures };
}

// --------------------------- synthetic helpers ---------------------------

function synthBoundary(center, site, rng) {
  const baseR = 4 + rng() * 2;
  const ring = [];
  const steps = 22;
  for (let i = 0; i < steps; i++) {
    const r = baseR * (0.72 + rng() * 0.5);
    ring.push(turf.destination(center, r, (360 / steps) * i, { units: 'kilometers' }).geometry.coordinates);
  }
  ring.push(ring[0]);
  const feature = turf.polygon([ring], {
    kind: 'watershed', site_id: site.id, name: `${site.name} catchment`, area_km2: 0, real: false,
  });
  feature.properties.area_km2 = round(turf.area(feature) / 1e6, 1);
  return { feature, radiusKm: baseR };
}

function synthStreams(anchor, radiusKm, rng, siteId) {
  const out = [];
  const mainBearing = 150 + rng() * 60;
  const main = buildStream(anchor, radiusKm * 0.95, mainBearing, rng, 7);
  out.push(turf.lineString(main, { kind: 'stream', site_id: siteId, name: 'Main drainage channel', order: 3, real: false }));
  const tribs = 2 + Math.floor(rng() * 2);
  for (let t = 0; t < tribs; t++) {
    const start = main[1 + Math.floor(rng() * (main.length - 2))];
    const b = mainBearing + (rng() > 0.5 ? 1 : -1) * (55 + rng() * 40);
    out.push(turf.lineString(buildStream(start, radiusKm * (0.4 + rng() * 0.3), b, rng, 4),
      { kind: 'stream', site_id: siteId, name: `Tributary ${t + 1}`, order: 2, real: false }));
  }
  return out;
}

function synthWaterbodies(streams, radiusKm, rng, siteId) {
  const out = [];
  const n = 1 + Math.floor(rng() * 3);
  for (let w = 0; w < n; w++) {
    const line = streams[streams.length - 1 - Math.floor(rng() * Math.min(2, streams.length))];
    const along = turf.along(line, radiusKm * rng() * 0.5, { units: 'kilometers' });
    const wb = turf.circle(along.geometry.coordinates, 0.12 + rng() * 0.35, { steps: 16, units: 'kilometers', properties: {} });
    wb.properties = { kind: 'waterbody', site_id: siteId, name: w === 0 ? 'Reservoir / lake' : `Pond ${w}`, area_ha: round(turf.area(wb) / 1e4, 1), real: false };
    out.push(wb);
  }
  return out;
}

function synthStructures(site, streams, radiusKm, rng) {
  const out = [];
  const extra = 1 + Math.floor(rng() * 2);
  for (let s = 0; s < extra; s++) {
    const p = turf.along(streams[streams.length - 1], radiusKm * (0.2 + rng() * 0.5), { units: 'kilometers' });
    out.push(turf.point(p.geometry.coordinates, { kind: 'structure', site_id: site.id, name: `${labelFor(site.intervention_type)} ${s + 1}`, structure_type: site.intervention_type, primary: false }));
  }
  return out;
}

function buildStream(start, lengthKm, bearing, rng, n) {
  const pts = [start];
  let cur = start, b = bearing;
  const seg = lengthKm / (n - 1);
  for (let i = 1; i < n; i++) {
    b += (rng() - 0.5) * 35;
    cur = turf.destination(cur, seg, b, { units: 'kilometers' }).geometry.coordinates;
    pts.push(cur);
  }
  return pts;
}

function labelFor(type) {
  return ({ 'Check-dam': 'Check-dam', 'Percolation tank': 'Percolation tank', Pond: 'Farm pond', 'Contour trench': 'Trench block', Afforestation: 'Plantation plot', Plantation: 'Plantation plot' })[type] || 'Structure';
}

// --------------------------- helpers ---------------------------

function toFeatures(geojson) {
  if (!geojson) return [];
  if (geojson.type === 'FeatureCollection') return geojson.features || [];
  if (geojson.type === 'Feature') return [geojson];
  if (geojson.type && geojson.coordinates) return [{ type: 'Feature', geometry: geojson, properties: {} }];
  return [];
}
function hint(f) {
  return String([f.properties?.kind, f.properties?.type, f.properties?.layer, f.properties?.name].filter(Boolean).join(' ')).toLowerCase();
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
function safe(fn, fb) { try { return fn(); } catch { return fb; } }
function round(n, dp) { const f = 10 ** dp; return Math.round(n * f) / f; }
