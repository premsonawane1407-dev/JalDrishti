import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { initSchema } from './db.js';
import { IMAGES_DIR, UPLOADS_DIR, ROOT_DIR } from './paths.js';
import { mode } from './services/sentinelHub.js';
import { sitesRouter } from './routes/sites.js';
import { satelliteRouter } from './routes/satellite.js';
import { photosRouter } from './routes/photos.js';
import { dashboardRouter } from './routes/dashboard.js';
import { geoRouter } from './routes/geo.js';
import { analyzeRouter } from './routes/analyze.js';
import { configRouter } from './routes/config.js';

initSchema();

const app = express();
app.use(cors());
app.use(express.json());

// Static: generated NDVI heatmaps and uploaded field photos.
app.use('/images', express.static(IMAGES_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'JalDrishti', satelliteMode: mode() });
});

app.use('/api/sites', sitesRouter);
app.use('/api', satelliteRouter);
app.use('/api', photosRouter);
app.use('/api', geoRouter);
app.use('/api', analyzeRouter);
app.use('/api', configRouter);
app.use('/api/dashboard', dashboardRouter);

// In production (single-service deploy) serve the built React app.
// The frontend uses relative /api, /images, /uploads — all same-origin here.
const distDir = join(ROOT_DIR, '..', 'frontend', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback: send index.html for any non-API, non-asset GET route.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/images') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(join(distDir, 'index.html'));
  });
  console.log('Serving built frontend from frontend/dist');
}

// Multer / generic error handler.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('[error]', err.message);
  res.status(err.status || 400).json({ error: err.message || 'Request failed' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`JalDrishti backend on http://localhost:${PORT}  (satellite mode: ${mode()})`);
});
