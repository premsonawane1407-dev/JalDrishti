// Time-series trend computation for NDVI/NDWI observations.
// A "trend" compares the most recent observation against the baseline
// (earliest) observation for a site and classifies the change.

const IMPROVING_THRESHOLD = 5; // percent change in NDVI to count as improving
const DECLINING_THRESHOLD = -5;

/**
 * @param {Array<{observation_date:string, ndvi:number, ndwi:number}>} observations
 *        Need not be sorted; this function sorts ascending by date.
 * @returns {{
 *   label: 'Improving'|'Stable'|'Declining'|'Insufficient data',
 *   color: 'green'|'yellow'|'red'|'grey',
 *   ndviChangePct: number|null,
 *   ndwiChangePct: number|null,
 *   baseline: object|null,
 *   latest: object|null,
 *   points: number
 * }}
 */
export function computeTrend(observations = []) {
  const sorted = [...observations].sort((a, b) =>
    a.observation_date.localeCompare(b.observation_date)
  );

  if (sorted.length < 2) {
    return {
      label: 'Insufficient data',
      color: 'grey',
      ndviChangePct: null,
      ndwiChangePct: null,
      baseline: sorted[0] ?? null,
      latest: sorted[sorted.length - 1] ?? null,
      points: sorted.length,
    };
  }

  const baseline = sorted[0];
  const latest = sorted[sorted.length - 1];

  const ndviChangePct = pctChange(baseline.ndvi, latest.ndvi);
  const ndwiChangePct = pctChange(baseline.ndwi, latest.ndwi);

  let label = 'Stable';
  let color = 'yellow';
  if (ndviChangePct >= IMPROVING_THRESHOLD) {
    label = 'Improving';
    color = 'green';
  } else if (ndviChangePct <= DECLINING_THRESHOLD) {
    label = 'Declining';
    color = 'red';
  }

  return {
    label,
    color,
    ndviChangePct: round(ndviChangePct, 1),
    ndwiChangePct: round(ndwiChangePct, 1),
    baseline,
    latest,
    points: sorted.length,
  };
}

function pctChange(from, to) {
  if (from === 0) return to === 0 ? 0 : 100;
  return ((to - from) / Math.abs(from)) * 100;
}

function round(n, dp) {
  if (n === null || n === undefined) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
