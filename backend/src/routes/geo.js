import { Router } from 'express';
import { getGeoLayers } from '../services/geodata.js';

export const geoRouter = Router();

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
