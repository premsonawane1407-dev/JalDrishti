// Seeds JalDrishti with 5 real-world Indian watershed sites and pre-computed
// quarterly NDVI/NDWI time-series + heatmaps, so the app is demo-ready without
// any live Sentinel Hub calls. Placeholder field photos are generated as SVGs.
//
//   node src/seed.js           # seed (skips if sites already exist)
//   node src/seed.js --reset   # wipe everything and re-seed

import 'dotenv/config';
import { writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { db, initSchema } from './db.js';
import { IMAGES_DIR, UPLOADS_DIR } from './paths.js';
import { writeHeatmap } from './services/sentinelHub.js';
import { ndviColor } from './services/heatmap.js';

const QUARTERS = [
  '2023-01-15', '2023-04-15', '2023-07-15', '2023-10-15',
  '2024-01-15', '2024-04-15', '2024-07-15', '2024-10-15',
];

// Real watershed / DoLR-relevant locations with curated NDVI trajectories.
const SITES = [
  {
    name: 'Hiware Bazar Watershed',
    district: 'Ahmednagar',
    state: 'Maharashtra',
    latitude: 19.1512,
    longitude: 74.7215,
    intervention_type: 'Check-dam',
    intervention_date: '2023-02-01',
    description:
      'Model watershed village; series of check-dams and continuous contour trenching to recharge groundwater.',
    ndvi: [0.28, 0.31, 0.36, 0.34, 0.39, 0.44, 0.52, 0.55],
    photos: ['Baseline survey — sparse cover, dry stream bed', 'Post-monsoon — filled check-dam, greener slopes'],
  },
  {
    name: 'Ralegan Siddhi Watershed',
    district: 'Ahmednagar',
    state: 'Maharashtra',
    latitude: 18.9812,
    longitude: 74.6790,
    intervention_type: 'Percolation tank',
    intervention_date: '2023-03-10',
    description:
      'Percolation tanks and gully plugs raising the water table across the micro-watershed.',
    ndvi: [0.33, 0.35, 0.38, 0.37, 0.41, 0.43, 0.47, 0.49],
    photos: ['Percolation tank under construction', 'Standing water, expanded cultivation'],
  },
  {
    name: 'Arvari River Catchment',
    district: 'Alwar',
    state: 'Rajasthan',
    latitude: 27.5620,
    longitude: 76.6050,
    intervention_type: 'Afforestation',
    intervention_date: '2023-01-20',
    description:
      'Johad (earthen check-dam) revival and afforestation credited with reviving the Arvari river.',
    ndvi: [0.22, 0.26, 0.30, 0.33, 0.38, 0.45, 0.51, 0.58],
    photos: ['Degraded aravalli foothills before works', 'Regenerated scrub-forest and johad'],
  },
  {
    name: 'Anantapur Dryland Block',
    district: 'Anantapur',
    state: 'Andhra Pradesh',
    latitude: 14.6810,
    longitude: 77.6000,
    intervention_type: 'Contour trench',
    intervention_date: '2023-02-15',
    description:
      'Rain-shadow dryland; contour trenching under stress from consecutive deficit-rainfall years.',
    ndvi: [0.41, 0.39, 0.37, 0.35, 0.33, 0.30, 0.28, 0.27],
    photos: ['Contour trenches, early season', 'Drought-stressed plots, thinning cover'],
  },
  {
    name: 'Jhabua Micro-Watershed',
    district: 'Jhabua',
    state: 'Madhya Pradesh',
    latitude: 22.7700,
    longitude: 74.5900,
    intervention_type: 'Pond',
    intervention_date: '2023-03-01',
    description:
      'Farm ponds and field bunding; vegetation holding steady across seasons.',
    ndvi: [0.36, 0.37, 0.35, 0.38, 0.36, 0.37, 0.38, 0.37],
    photos: ['Newly dug farm pond', 'Stable mixed cropping around pond'],
  },
];

function ndwiFor(ndvi, i) {
  // Loosely correlated water index; a little seasonal wiggle.
  const wiggle = Math.sin(i) * 0.03;
  return round(-0.18 + ndvi * 0.45 + wiggle, 3);
}
function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function placeholderPhotoSvg({ siteName, label, date, ndvi }) {
  const sky = ndviColor(Math.min(0.8, ndvi + 0.2));
  const land = ndviColor(ndvi);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
  <rect width="480" height="320" fill="${sky}"/>
  <rect y="180" width="480" height="140" fill="${land}"/>
  <rect y="176" width="480" height="8" fill="rgba(0,0,0,0.15)"/>
  <circle cx="400" cy="60" r="34" fill="#fff8e1" opacity="0.85"/>
  <rect x="0" y="0" width="480" height="56" fill="rgba(0,0,0,0.55)"/>
  <text x="16" y="26" fill="#fff" font-family="Segoe UI, Arial" font-size="18" font-weight="700">${escapeXml(siteName)}</text>
  <text x="16" y="46" fill="#dbeafe" font-family="Segoe UI, Arial" font-size="13">${escapeXml(label)}</text>
  <rect x="0" y="290" width="480" height="30" fill="rgba(0,0,0,0.5)"/>
  <text x="16" y="310" fill="#fff" font-family="Segoe UI, Arial" font-size="13">${date}  •  field photo (placeholder)  •  NDVI ≈ ${ndvi}</text>
</svg>`;
}
function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function reset() {
  db.exec('DELETE FROM photos; DELETE FROM observations; DELETE FROM sites;');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('sites','photos','observations');");
  for (const dir of [IMAGES_DIR, UPLOADS_DIR]) {
    for (const f of readdirSync(dir)) {
      try { rmSync(join(dir, f)); } catch { /* ignore */ }
    }
  }
  console.log('Reset: cleared sites, photos, observations, and generated files.');
}

function seed() {
  initSchema();

  if (process.argv.includes('--reset')) reset();

  const existing = db.prepare('SELECT COUNT(*) AS c FROM sites').get().c;
  if (existing > 0 && !process.argv.includes('--reset')) {
    console.log(`Sites already present (${existing}). Use --reset to wipe and re-seed.`);
    return;
  }

  const insertSite = db.prepare(
    `INSERT INTO sites (name, district, state, latitude, longitude, intervention_type, intervention_date, description)
     VALUES (@name, @district, @state, @latitude, @longitude, @intervention_type, @intervention_date, @description)`
  );
  const insertObs = db.prepare(
    `INSERT INTO observations (site_id, observation_date, ndvi, ndwi, cloud_coverage, image_filename, source)
     VALUES (?, ?, ?, ?, ?, ?, 'mock')`
  );
  const insertPhoto = db.prepare(
    `INSERT INTO photos (site_id, filename, original_name, caption, latitude, longitude, taken_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const s of SITES) {
    const info = insertSite.run({
      name: s.name,
      district: s.district,
      state: s.state,
      latitude: s.latitude,
      longitude: s.longitude,
      intervention_type: s.intervention_type,
      intervention_date: s.intervention_date,
      description: s.description,
    });
    const siteId = Number(info.lastInsertRowid);

    QUARTERS.forEach((date, i) => {
      const ndvi = s.ndvi[i];
      const ndwi = ndwiFor(ndvi, i);
      const cloud = (i * 7) % 22;
      const image = writeHeatmap({ siteId, date, meanNdvi: ndvi });
      insertObs.run(siteId, date, ndvi, ndwi, cloud, image);
    });

    // Two placeholder field photos: baseline (first quarter) and latest.
    // Offset each within the catchment so map markers are distinct.
    const photoDates = [QUARTERS[0], QUARTERS[QUARTERS.length - 1]];
    const offsets = [{ dlat: 0.011, dlng: -0.013 }, { dlat: -0.009, dlng: 0.015 }];
    s.photos.forEach((label, i) => {
      const date = photoDates[i] ?? QUARTERS[QUARTERS.length - 1];
      const ndvi = i === 0 ? s.ndvi[0] : s.ndvi[s.ndvi.length - 1];
      const filename = `seed-site${siteId}-${i + 1}.svg`;
      const o = offsets[i] ?? { dlat: 0, dlng: 0 };
      writeFileSync(join(UPLOADS_DIR, filename), placeholderPhotoSvg({ siteName: s.name, label, date, ndvi }), 'utf8');
      insertPhoto.run(siteId, filename, `${s.name} ${i === 0 ? 'baseline' : 'latest'}.svg`, label,
        s.latitude + o.dlat, s.longitude + o.dlng, date);
    });

    console.log(`Seeded ${s.name} (id=${siteId}) with ${QUARTERS.length} observations + 2 photos.`);
  }

  console.log(`\nDone. ${SITES.length} sites seeded and demo-ready.`);
}

seed();
