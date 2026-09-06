import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { writeFileSync, unlinkSync } from 'node:fs';
import { db } from '../db.js';
import { IMAGES_DIR, UPLOADS_DIR } from '../paths.js';
import { analyzeToObservation } from '../services/raster.js';

export const analyzeRouter = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `tiff-${Date.now()}-${randomUUID().slice(0, 8)}${extname(file.originalname) || '.tif'}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 }, // 80 MB
  fileFilter: (req, file, cb) => {
    const ok = /\.tiff?$/i.test(file.originalname) || /tiff?/.test(file.mimetype);
    cb(ok ? null : new Error('Please upload a GeoTIFF (.tif/.tiff) file'), ok);
  },
});

// Upload a GeoTIFF and compute NDVI/NDWI from its bands, storing the result as
// a satellite observation for the site (source = "uploaded").
// Body: date, redBand, nirBand, greenBand (1-based band numbers).
analyzeRouter.post('/sites/:id/analyze', upload.single('image'), async (req, res) => {
  const siteId = Number(req.params.id);
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
  if (!site) { if (req.file) safeUnlink(req.file.path); return res.status(404).json({ error: 'Site not found' }); }
  if (!req.file) return res.status(400).json({ error: 'No image uploaded (field name: image)' });

  const date = normaliseDate(req.body?.date) || today();
  const bands = {
    redBand: intOr(req.body?.redBand, 1),
    nirBand: intOr(req.body?.nirBand, 2),
    greenBand: req.body?.greenBand ? intOr(req.body.greenBand, undefined) : undefined,
  };

  try {
    const result = await analyzeToObservation(req.file.path, bands);
    const imageFilename = `site-${siteId}-${date}.svg`;
    writeFileSync(join(IMAGES_DIR, imageFilename), result.heatmapSvg, 'utf8');

    db.prepare(
      `INSERT INTO observations (site_id, observation_date, ndvi, ndwi, cloud_coverage, image_filename, source)
       VALUES (?, ?, ?, ?, 0, ?, 'uploaded')
       ON CONFLICT(site_id, observation_date) DO UPDATE SET
         ndvi=excluded.ndvi, ndwi=excluded.ndwi, image_filename=excluded.image_filename, source='uploaded'`
    ).run(siteId, date, result.ndvi, result.ndwi ?? 0, imageFilename);

    const observation = db
      .prepare('SELECT * FROM observations WHERE site_id = ? AND observation_date = ?')
      .get(siteId, date);

    res.status(201).json({
      observation,
      analysis: { bands: result.bands, width: result.width, height: result.height, ndvi: result.ndvi, ndwi: result.ndwi },
    });
  } catch (err) {
    console.error('[analyze]', err.message);
    res.status(400).json({ error: `Could not analyse image: ${err.message}` });
  } finally {
    // The GeoTIFF can be large; we only keep the derived heatmap + numbers.
    safeUnlink(req.file.path);
  }
});

function safeUnlink(p) { try { unlinkSync(p); } catch { /* gone */ } }
function intOr(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }
function normaliseDate(d) { const m = typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : null; }
function today() { return new Date().toISOString().slice(0, 10); }
