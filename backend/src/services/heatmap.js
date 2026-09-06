// Generates an NDVI-style heatmap as an SVG string (no native image deps).
// Used for MOCK mode so the app has realistic satellite visuals offline.
// Real Sentinel Hub mode returns a genuine PNG instead.

// Standard NDVI colour ramp: bare/water (brown/red) -> sparse (yellow) -> dense veg (green).
const NDVI_STOPS = [
  { v: -0.2, c: [8, 48, 107] },    // water / deep blue
  { v: 0.0, c: [140, 81, 10] },    // bare soil / brown
  { v: 0.2, c: [216, 179, 101] },  // sparse / tan
  { v: 0.4, c: [255, 255, 191] },  // pale yellow
  { v: 0.6, c: [145, 207, 96] },   // light green
  { v: 0.8, c: [26, 120, 40] },    // dense green
];

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

export function ndviColor(v) {
  if (v <= NDVI_STOPS[0].v) return rgb(NDVI_STOPS[0].c);
  if (v >= NDVI_STOPS[NDVI_STOPS.length - 1].v)
    return rgb(NDVI_STOPS[NDVI_STOPS.length - 1].c);
  for (let i = 0; i < NDVI_STOPS.length - 1; i++) {
    const lo = NDVI_STOPS[i];
    const hi = NDVI_STOPS[i + 1];
    if (v >= lo.v && v <= hi.v) {
      const t = (v - lo.v) / (hi.v - lo.v);
      return rgb([lerp(lo.c[0], hi.c[0], t), lerp(lo.c[1], hi.c[1], t), lerp(lo.c[2], hi.c[2], t)]);
    }
  }
  return rgb(NDVI_STOPS[NDVI_STOPS.length - 1].c);
}

function rgb([r, g, b]) {
  return `rgb(${r},${g},${b})`;
}

// Simple deterministic RNG (mulberry32) so the same site+date always renders identically.
export function seededRng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build an NDVI heatmap SVG from a REAL computed grid of NDVI values
 * (used by the uploaded-imagery raster analysis). `grid` is a 2D array of
 * numbers (or null/NaN for no-data pixels).
 * @returns {string} SVG markup
 */
export function generateHeatmapSvgFromGrid(grid, { size = 320 } = {}) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  if (!rows || !cols) return generateHeatmapSvg({ seed: 'empty', meanNdvi: 0.3 });
  const cw = size / cols;
  const ch = size / rows;
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = grid[y][x];
      const fill = v == null || Number.isNaN(v) ? '#222' : ndviColor(Math.max(-0.3, Math.min(0.9, v)));
      cells.push(
        `<rect x="${(x * cw).toFixed(2)}" y="${(y * ch).toFixed(2)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" fill="${fill}"/>`
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="#000"/>
${cells.join('\n')}
</svg>`;
}

/**
 * Build an NDVI heatmap SVG for a site.
 * meanNdvi drives the overall greenness; noise adds spatial texture.
 * @returns {string} SVG markup
 */
export function generateHeatmapSvg({ seed, meanNdvi = 0.4, grid = 24, size = 320 }) {
  const rng = seededRng(seed);
  const cell = size / grid;
  const cells = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      // Smooth-ish field: blend a radial gradient with per-cell noise around meanNdvi.
      const cx = grid / 2;
      const cy = grid / 2;
      const dist = Math.hypot(x - cx, y - cy) / (grid / 1.4);
      const radial = (1 - dist) * 0.15;
      const noise = (rng() - 0.5) * 0.35;
      let v = meanNdvi + radial + noise;
      v = Math.max(-0.25, Math.min(0.9, v));
      cells.push(
        `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" ` +
          `width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="${ndviColor(v)}"/>`
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="#000"/>
${cells.join('\n')}
</svg>`;
}
