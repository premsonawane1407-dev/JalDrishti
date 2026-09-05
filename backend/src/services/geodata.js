// Generates deterministic SAMPLE geospatial layers for each site — watershed
// boundary, drainage/streams, water bodies, and conservation structures — as
// GeoJSON FeatureCollections. This is clearly-labelled demo geometry (like the
// SRISHTI-DRISHTI "sample geospatial data"): real coordinates, synthesised
// shapes, so the GIS map has boundaries/streams/water to interpret offline.
//
// Swap this out later for real QGIS-exported / SRISHTI-DRISHTI GeoJSON with no
// frontend changes — the routes serve whatever this returns.

import * as turf from '@turf/turf';
import { db } from '../db.js';
import { seededRng } from './heatmap.js';

let cache = null;
let cacheKey = '';

function currentKey() {
  const rows = db.prepare('SELECT id, latitude, longitude FROM sites ORDER BY id').all();
  return rows.map((r) => `${r.id}:${r.latitude}:${r.longitude}`).join('|');
}

/** All GIS layers as GeoJSON FeatureCollections, cached until sites change. */
export function getGeoLayers() {
  const key = currentKey();
  if (cache && key === cacheKey) return cache;

  const sites = db.prepare('SELECT * FROM sites ORDER BY id').all();
  const watersheds = [];
  const streams = [];
  const waterbodies = [];
  const structures = [];

  for (const site of sites) {
    const rng = seededRng(`geo-${site.id}-${site.latitude}-${site.longitude}`);
    const center = [site.longitude, site.latitude];

    // ---- Watershed boundary: irregular polygon (~4-6 km radius) ----
    const baseR = 4 + rng() * 2;
    const ringPts = [];
    const steps = 22;
    for (let i = 0; i < steps; i++) {
      const bearing = (360 / steps) * i;
      const r = baseR * (0.72 + rng() * 0.5); // jitter radius for a natural catchment shape
      ringPts.push(turf.destination(center, r, bearing, { units: 'kilometers' }).geometry.coordinates);
    }
    ringPts.push(ringPts[0]);
    const boundary = turf.polygon([ringPts], {
      kind: 'watershed',
      site_id: site.id,
      name: `${site.name} catchment`,
      area_km2: 0,
    });
    boundary.properties.area_km2 = round(turf.area(boundary) / 1e6, 1);
    watersheds.push(boundary);

    // ---- Streams: a main channel + 2-3 tributaries within the boundary ----
    const mainBearing = 150 + rng() * 60; // roughly NW->SE drainage
    const mainLine = buildStream(center, baseR * 0.95, mainBearing, rng, 7);
    streams.push(
      turf.lineString(mainLine, { kind: 'stream', site_id: site.id, name: 'Main drainage channel', order: 3 })
    );
    const tribCount = 2 + Math.floor(rng() * 2);
    for (let t = 0; t < tribCount; t++) {
      // Tributary starts partway along the main channel and flows outward.
      const anchor = mainLine[1 + Math.floor(rng() * (mainLine.length - 2))];
      const tb = mainBearing + (rng() > 0.5 ? 1 : -1) * (55 + rng() * 40);
      const trib = buildStream(anchor, baseR * (0.4 + rng() * 0.3), tb, rng, 4);
      streams.push(
        turf.lineString(trib, { kind: 'stream', site_id: site.id, name: `Tributary ${t + 1}`, order: 2 })
      );
    }

    // ---- Water bodies: 1-3 small ponds/lakes near the channel ----
    const wbCount = 1 + Math.floor(rng() * 3);
    for (let w = 0; w < wbCount; w++) {
      const along = turf.along(streams[streams.length - 1 - Math.floor(rng() * 2)], baseR * rng() * 0.5, {
        units: 'kilometers',
      });
      const wr = 0.12 + rng() * 0.35;
      const wb = turf.circle(along.geometry.coordinates, wr, { steps: 16, units: 'kilometers', properties: {} });
      wb.properties = {
        kind: 'waterbody',
        site_id: site.id,
        name: w === 0 ? 'Reservoir / lake' : `Pond ${w}`,
        area_ha: round((turf.area(wb) / 1e4), 1),
      };
      waterbodies.push(wb);
    }

    // ---- Structures: the intervention itself + a couple along the channel ----
    structures.push(
      turf.point(center, {
        kind: 'structure',
        site_id: site.id,
        name: site.name,
        structure_type: site.intervention_type,
        primary: true,
      })
    );
    const extra = 1 + Math.floor(rng() * 2);
    for (let s = 0; s < extra; s++) {
      const p = turf.along(streams[streams.length - 1], baseR * (0.2 + rng() * 0.5), { units: 'kilometers' });
      structures.push(
        turf.point(p.geometry.coordinates, {
          kind: 'structure',
          site_id: site.id,
          name: `${labelFor(site.intervention_type)} ${s + 1}`,
          structure_type: site.intervention_type,
          primary: false,
        })
      );
    }
  }

  // Totals for the map's GIS stat cards.
  const summary = {
    watershedAreaKm2: round(watersheds.reduce((a, f) => a + f.properties.area_km2, 0), 1),
    waterBodies: waterbodies.length,
    waterBodyAreaHa: round(waterbodies.reduce((a, f) => a + f.properties.area_ha, 0), 1),
    streamSegments: streams.length,
    drainageKm: round(streams.reduce((a, f) => a + turf.length(f, { units: 'kilometers' }), 0), 1),
    structures: structures.length,
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

// Build a stream as a jittered polyline of `n` points radiating from `start`.
function buildStream(start, lengthKm, bearing, rng, n) {
  const pts = [start];
  let cur = start;
  const seg = lengthKm / (n - 1);
  let b = bearing;
  for (let i = 1; i < n; i++) {
    b += (rng() - 0.5) * 35; // meander
    cur = turf.destination(cur, seg, b, { units: 'kilometers' }).geometry.coordinates;
    pts.push(cur);
  }
  return pts;
}

function labelFor(type) {
  const map = {
    'Check-dam': 'Check-dam',
    'Percolation tank': 'Percolation tank',
    Pond: 'Farm pond',
    'Contour trench': 'Trench block',
    Afforestation: 'Plantation plot',
    Plantation: 'Plantation plot',
  };
  return map[type] || 'Structure';
}

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
