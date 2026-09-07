import { Router } from 'express';
import multer from 'multer';
import exifr from 'exifr';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { db } from '../db.js';
import { UPLOADS_DIR } from '../paths.js';

export const photosRouter = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = (extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image uploads are allowed'));
  },
});

// Upload a field photo for a site.
// GPS: taken from EXIF if present; otherwise the client can supply lat/lng
// (e.g. from pinning on the map). Body: caption, taken_at, latitude, longitude.
photosRouter.post('/sites/:id/photos', upload.single('photo'), async (req, res) => {
  const siteId = Number(req.params.id);
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
  if (!site) {
    if (req.file) safeUnlink(req.file.path);
    return res.status(404).json({ error: 'Site not found' });
  }
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded (field name: photo)' });

  // Try to read GPS + capture date from EXIF.
  let exifLat = null;
  let exifLng = null;
  let exifDate = null;
  try {
    const gps = await exifr.gps(req.file.path);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      exifLat = gps.latitude;
      exifLng = gps.longitude;
    }
    const meta = await exifr.parse(req.file.path, ['DateTimeOriginal', 'CreateDate']).catch(() => null);
    const dt = meta?.DateTimeOriginal || meta?.CreateDate;
    if (dt instanceof Date && !Number.isNaN(dt.getTime())) {
      exifDate = dt.toISOString().slice(0, 10);
    }
  } catch {
    // Non-image or stripped EXIF — fall back to client-supplied / site coords.
  }

  const latitude = firstNum(req.body.latitude, exifLat, site.latitude);
  const longitude = firstNum(req.body.longitude, exifLng, site.longitude);
  const takenAt = normaliseDate(req.body.taken_at) || exifDate || today();
  const gpsSource = Number.isFinite(exifLat) ? 'exif' : req.body.latitude ? 'manual' : 'site';

  const info = db
    .prepare(
      `INSERT INTO photos (site_id, filename, original_name, caption, latitude, longitude, taken_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      siteId,
      req.file.filename,
      req.file.originalname || '',
      (req.body.caption || '').trim(),
      latitude,
      longitude,
      takenAt
    );

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...photo, gpsSource });
});

// List a site's photos (timeline order).
photosRouter.get('/sites/:id/photos', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM photos WHERE site_id = ? ORDER BY COALESCE(taken_at, created_at)')
    .all(Number(req.params.id));
  res.json(rows);
});

// All field photos across sites (for the Field Images gallery).
photosRouter.get('/photos', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, s.name AS site_name, s.district, s.intervention_type
       FROM photos p JOIN sites s ON s.id = p.site_id
       ORDER BY COALESCE(p.taken_at, p.created_at) DESC`
    )
    .all();
  res.json(rows);
});

photosRouter.delete('/photos/:photoId', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.photoId));
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
  safeUnlink(join(UPLOADS_DIR, photo.filename));
  res.json({ ok: true });
});

function safeUnlink(path) {
  try {
    unlinkSync(path);
  } catch {
    /* already gone */
  }
}
function firstNum(...vals) {
  for (const v of vals) {
    if (v === '' || v === null || v === undefined) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function normaliseDate(d) {
  if (!d || typeof d !== 'string') return null;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
