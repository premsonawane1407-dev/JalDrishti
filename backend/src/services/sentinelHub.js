// Sentinel Hub integration — DUAL MODE.
//
//   MOCK mode  (default): no credentials needed. Produces deterministic,
//              realistic NDVI/NDWI values + an SVG heatmap so the whole app
//              works offline and demos never depend on API latency.
//
//   LIVE mode  (SH_CLIENT_ID + SH_CLIENT_SECRET set in .env): fetches real
//              Sentinel-2 data via Sentinel Hub — mean NDVI/NDWI from the
//              Statistical API and a coloured NDVI heatmap PNG from the
//              Process API, using Sentinel Hub's own evalscripts (no local
//              raster math).
//
// The public API (getObservation) is identical in both modes, so dropping
// credentials into .env flips the app to live with zero code changes.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { IMAGES_DIR } from '../paths.js';
import { generateHeatmapSvg, seededRng } from './heatmap.js';

export function isLiveMode() {
  return Boolean(process.env.SH_CLIENT_ID && process.env.SH_CLIENT_SECRET);
}

export function mode() {
  return isLiveMode() ? 'sentinel-hub' : 'mock';
}

/**
 * Fetch (or synthesise) one satellite observation for a site on a given date.
 * Writes the heatmap image to disk and returns its filename.
 *
 * @returns {Promise<{ndvi:number, ndwi:number, cloudCoverage:number,
 *                     source:string, imageFilename:string, observationDate:string}>}
 */
export async function getObservation({ siteId, latitude, longitude, date }) {
  if (isLiveMode()) {
    try {
      return await getLiveObservation({ siteId, latitude, longitude, date });
    } catch (err) {
      // Never let a transient API failure break the demo — fall back to mock.
      console.warn(`[sentinelHub] live fetch failed, using mock: ${err.message}`);
    }
  }
  return getMockObservation({ siteId, latitude, longitude, date });
}

// ---------------------------------------------------------------------------
// MOCK MODE
// ---------------------------------------------------------------------------

function getMockObservation({ siteId, latitude, longitude, date }) {
  const seed = `${siteId}|${latitude.toFixed(4)}|${longitude.toFixed(4)}|${date}`;
  const rng = seededRng(seed);

  // Plausible baseline greenness with mild seasonal + spatial variation.
  const month = Number(date.slice(5, 7)) || 6;
  const monsoonBoost = Math.sin(((month - 3) / 12) * Math.PI * 2) * 0.08; // greener post-monsoon
  const ndvi = clamp(0.32 + monsoonBoost + (rng() - 0.5) * 0.12, 0.08, 0.85);
  const ndwi = clamp(-0.1 + monsoonBoost * 0.6 + (rng() - 0.5) * 0.15, -0.4, 0.45);
  const cloudCoverage = Math.round(rng() * 25);

  const imageFilename = writeHeatmap({ siteId, date, meanNdvi: ndvi, ext: 'svg' });

  return {
    ndvi: round(ndvi, 3),
    ndwi: round(ndwi, 3),
    cloudCoverage,
    source: 'mock',
    imageFilename,
    observationDate: date,
  };
}

/** Exposed so the seed script can render a heatmap for a curated NDVI value. */
export function writeHeatmap({ siteId, date, meanNdvi, ext = 'svg' }) {
  const filename = `site-${siteId}-${date}.svg`;
  const svg = generateHeatmapSvg({ seed: `${siteId}-${date}`, meanNdvi });
  writeFileSync(join(IMAGES_DIR, filename), svg, 'utf8');
  return filename;
}

// ---------------------------------------------------------------------------
// LIVE MODE (Sentinel Hub)
// ---------------------------------------------------------------------------

let cachedToken = null; // { value, expiresAt }

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const url =
    process.env.SH_TOKEN_URL ||
    'https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SH_CLIENT_ID,
    client_secret: process.env.SH_CLIENT_SECRET,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  const json = await res.json();
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 600) * 1000,
  };
  return cachedToken.value;
}

// ~500 m box around the point (roughly; fine for a demo AOI).
function bbox(lat, lng, halfDeg = 0.0045) {
  return [lng - halfDeg, lat - halfDeg, lng + halfDeg, lat + halfDeg];
}

// A ±10-day window around the requested date, so we catch a clear pass.
function dateRange(date) {
  const d = new Date(date + 'T00:00:00Z');
  const from = new Date(d.getTime() - 10 * 86400000);
  const to = new Date(d.getTime() + 10 * 86400000);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function getLiveObservation({ siteId, latitude, longitude, date }) {
  const token = await getToken();
  const [stats, png] = await Promise.all([
    fetchStatistics({ token, latitude, longitude, date }),
    fetchHeatmapPng({ token, latitude, longitude, date }),
  ]);

  const filename = `site-${siteId}-${date}.png`;
  writeFileSync(join(IMAGES_DIR, filename), png);

  return {
    ndvi: round(stats.ndvi, 3),
    ndwi: round(stats.ndwi, 3),
    cloudCoverage: stats.cloudCoverage ?? 0,
    source: 'sentinel-hub',
    imageFilename: filename,
    observationDate: date,
  };
}

const STATS_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03","B04","B08","SCL","dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "ndwi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-9);
  let ndwi = (s.B03 - s.B08) / (s.B03 + s.B08 + 1e-9);
  return { ndvi: [ndvi], ndwi: [ndwi], dataMask: [s.dataMask] };
}`;

async function fetchStatistics({ token, latitude, longitude, date }) {
  const { from, to } = dateRange(date);
  const url =
    (process.env.SH_PROCESS_URL || 'https://services.sentinel-hub.com/api/v1/process').replace(
      '/process',
      '/statistics'
    );
  const payload = {
    input: {
      bounds: {
        bbox: bbox(latitude, longitude),
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { maxCloudCoverage: 60 } }],
    },
    aggregation: {
      timeRange: { from, to },
      aggregationInterval: { of: 'P30D' },
      evalscript: STATS_EVALSCRIPT,
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`statistics ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const interval = json?.data?.[0];
  const ndvi = interval?.outputs?.ndvi?.bands?.B0?.stats?.mean;
  const ndwi = interval?.outputs?.ndwi?.bands?.B0?.stats?.mean;
  if (ndvi === undefined || ndvi === null) throw new Error('no NDVI in statistics response');
  return { ndvi, ndwi: ndwi ?? 0, cloudCoverage: 0 };
}

const HEATMAP_EVALSCRIPT = `//VERSION=3
function setup() {
  return { input: ["B04","B08","dataMask"], output: { bands: 4 } };
}
function ramp(v) {
  // brown -> yellow -> green NDVI colour ramp
  if (v < 0.0) return [0.55,0.32,0.04];
  if (v < 0.2) return [0.85,0.70,0.40];
  if (v < 0.4) return [1.00,1.00,0.75];
  if (v < 0.6) return [0.57,0.81,0.38];
  return [0.10,0.47,0.16];
}
function evaluatePixel(s) {
  let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-9);
  let c = ramp(ndvi);
  return [c[0], c[1], c[2], s.dataMask];
}`;

async function fetchHeatmapPng({ token, latitude, longitude, date }) {
  const { from, to } = dateRange(date);
  const url = process.env.SH_PROCESS_URL || 'https://services.sentinel-hub.com/api/v1/process';
  const payload = {
    input: {
      bounds: {
        bbox: bbox(latitude, longitude),
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: { timeRange: { from, to }, maxCloudCoverage: 60 },
        },
      ],
    },
    output: { width: 320, height: 320, responses: [{ identifier: 'default', format: { type: 'image/png' } }] },
    evalscript: HEATMAP_EVALSCRIPT,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`process ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
