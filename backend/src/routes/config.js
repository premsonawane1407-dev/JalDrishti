import { Router } from 'express';
import { mode } from '../services/sentinelHub.js';

export const configRouter = Router();

// Frontend runtime config, including EXTERNAL MAP DATA SOURCES (Phase 4).
//
// Government / EO layers (SRISHTI-DRISHTI, Bhuvan, NASA GIBS) are surfaced in the
// map's layer switcher. They're config-driven so the exact endpoints/credentials
// can be dropped in via .env without code changes — the same swap-in philosophy
// as the satellite provider. Overlays fail transparently (the base map stays), so
// a government endpoint needing access never breaks the demo.
configRouter.get('/config', (req, res) => {
  res.json({ satelliteMode: mode(), externalLayers: buildExternalLayers() });
});

function buildExternalLayers() {
  if (String(process.env.EXTERNAL_LAYERS || '').toLowerCase() === 'off') return [];
  const layers = [];

  // A working EO base layer (NASA GIBS, no key) — proves the external-source path.
  if (process.env.GIBS !== 'off') {
    const time = process.env.GIBS_TIME || '2024-01-01';
    layers.push({
      id: 'gibs-truecolor',
      name: 'NASA MODIS true-colour',
      type: 'xyz',
      url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      attribution: 'Imagery © NASA EOSDIS GIBS',
      kind: 'base',
      maxZoom: 9,
    });
  }

  // Bhuvan (ISRO / NRSC) — India's national geoplatform. Endpoint/layer are
  // env-overridable; shown as an overlay so it fails transparently.
  layers.push({
    id: 'bhuvan',
    name: 'Bhuvan (ISRO/NRSC)',
    type: 'wms',
    url: process.env.BHUVAN_WMS_URL || 'https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms',
    layers: process.env.BHUVAN_WMS_LAYERS || 'india3',
    attribution: 'ISRO Bhuvan / NRSC',
    kind: 'overlay',
    note: 'Government WMS — may require access/registration to render.',
  });

  // SRISHTI-DRISHTI (DoLR) — the PS's own platform. Added only when configured.
  if (process.env.SRISHTI_WMS_URL) {
    layers.push({
      id: 'srishti-drishti',
      name: 'SRISHTI-DRISHTI (DoLR)',
      type: 'wms',
      url: process.env.SRISHTI_WMS_URL,
      layers: process.env.SRISHTI_WMS_LAYERS || '',
      attribution: 'DoLR SRISHTI-DRISHTI',
      kind: 'overlay',
      note: 'Configured via SRISHTI_WMS_URL.',
    });
  }

  return layers;
}
