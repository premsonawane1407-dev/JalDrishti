// Reads an uploaded GeoTIFF satellite image and computes NDVI/NDWI from its
// bands — the geoprocessing a GIS tool (QGIS) would do, done automatically on
// the server. Pure JavaScript via geotiff.js; no Python/GDAL needed.
//
//   NDVI = (NIR - Red) / (NIR + Red)   (vegetation)
//   NDWI = (Green - NIR) / (Green + NIR)  (water; optional, needs a green band)
//
// The ratio is scale-invariant, so raw DN or reflectance both work.

import { fromFile } from 'geotiff';
import { generateHeatmapSvgFromGrid } from './heatmap.js';

const ANALYSIS_SIZE = 128; // resample to this grid for stats (fast, low memory)
const HEATMAP_COLS = 32; // downsampled heatmap resolution

/**
 * @param {string} path  local path to the GeoTIFF
 * @param {{redBand?:number, nirBand?:number, greenBand?:number}} bands  1-based indices
 * @returns {Promise<{ndvi:number, ndwi:number|null, heatmapGrid:number[][],
 *                     width:number, height:number, bands:number, bbox:number[]}>}
 */
export async function analyzeGeoTiff(path, { redBand = 1, nirBand = 2, greenBand } = {}) {
  const tiff = await fromFile(path);
  const image = await tiff.getImage();
  const spp = image.getSamplesPerPixel();
  const bbox = safe(() => image.getBoundingBox(), null);
  const nodata = safe(() => {
    const v = image.getGDALNoData();
    return v == null ? null : Number(v);
  }, null);

  const rasters = await image.readRasters({ width: ANALYSIS_SIZE, height: ANALYSIS_SIZE, interleave: false });
  const W = ANALYSIS_SIZE, H = ANALYSIS_SIZE;

  const isNoData = (v) => v == null || Number.isNaN(v) || (nodata != null && v === nodata);

  // ndviAt(i) computes NDVI for pixel i, or null if invalid.
  let ndviAt;
  if (spp === 1) {
    // Single band = already an NDVI product; use its values directly.
    const b = rasters[0];
    ndviAt = (i) => {
      const v = b[i];
      if (isNoData(v)) return null;
      // If values look like scaled ints (e.g. -1..1 stored *10000), normalise.
      return Math.abs(v) > 1.5 ? v / 10000 : v;
    };
  } else {
    const red = rasters[bandIndex(redBand, spp)];
    const nir = rasters[bandIndex(nirBand, spp)];
    ndviAt = (i) => {
      const r = red[i], n = nir[i];
      if (isNoData(r) || isNoData(n)) return null;
      const denom = n + r;
      if (denom === 0) return null;
      return (n - r) / denom;
    };
  }

  // Mean NDVI + a downsampled grid for the heatmap.
  let sum = 0, count = 0;
  const values = new Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const v = ndviAt(i);
    values[i] = v;
    if (v != null) { sum += v; count += 1; }
  }
  if (count === 0) throw new Error('No valid pixels — check the band numbers or the file.');
  const ndvi = round(sum / count, 3);

  // NDWI (optional) — needs a green band and a NIR band.
  let ndwi = null;
  if (greenBand && spp >= 2) {
    const green = rasters[bandIndex(greenBand, spp)];
    const nir = rasters[bandIndex(nirBand, spp)];
    let ws = 0, wc = 0;
    for (let i = 0; i < W * H; i++) {
      const g = green[i], n = nir[i];
      if (isNoData(g) || isNoData(n)) continue;
      const d = g + n;
      if (d === 0) continue;
      ws += (g - n) / d; wc += 1;
    }
    if (wc) ndwi = round(ws / wc, 3);
  }

  const heatmapGrid = downsampleGrid(values, W, H, HEATMAP_COLS);

  return { ndvi, ndwi, heatmapGrid, width: image.getWidth(), height: image.getHeight(), bands: spp, bbox };
}

/** Convenience: analyse + render the heatmap SVG in one call. */
export async function analyzeToObservation(path, bands) {
  const r = await analyzeGeoTiff(path, bands);
  const svg = generateHeatmapSvgFromGrid(r.heatmapGrid);
  return { ...r, heatmapSvg: svg };
}

// Average WxH values into a cols x cols grid (null cells where all no-data).
function downsampleGrid(values, W, H, cols) {
  const rows = cols;
  const bw = Math.floor(W / cols);
  const bh = Math.floor(H / rows);
  const grid = [];
  for (let gy = 0; gy < rows; gy++) {
    const row = [];
    for (let gx = 0; gx < cols; gx++) {
      let s = 0, c = 0;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const v = values[(gy * bh + y) * W + (gx * bw + x)];
          if (v != null) { s += v; c += 1; }
        }
      }
      row.push(c ? s / c : null);
    }
    grid.push(row);
  }
  return grid;
}

function bandIndex(oneBased, spp) {
  const i = Math.max(1, Math.min(spp, Math.round(oneBased))) - 1;
  return i;
}
function round(n, dp) { const f = 10 ** dp; return Math.round(n * f) / f; }
function safe(fn, fallback) { try { return fn(); } catch { return fallback; } }
