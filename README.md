# 💧 JalDrishti — Watershed Geospatial Monitoring Platform

**SIH PS 26015** · Ministry of Rural Development, Dept. of Land Resources (DoLR)

JalDrishti combines **field-collected geo-tagged photos** with **Sentinel-2 satellite
imagery** to show planners whether a watershed intervention (check-dam, pond,
plantation…) is actually working. It computes vegetation (**NDVI**) and water
(**NDWI**) indices over time, classifies each site as **Improving / Stable /
Declining**, and visualises everything on an interactive map + dashboard.

![status](https://img.shields.io/badge/features_1--6-complete-1a9850)

---

## Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Site & field-photo registry (CRUD, EXIF GPS extraction, map pinning, photo timeline) | ✅ |
| 2 | Sentinel Hub satellite integration (multi-date, cached) | ✅ |
| 3 | NDVI / NDWI computation (via Sentinel Hub evalscript — no local raster math) | ✅ |
| 4 | Time-series change detection + trend labels with % change | ✅ |
| 5 | Interactive Leaflet map, trend-coloured pins, per-site detail with NDVI chart & heatmap | ✅ |
| 6 | District/program summary dashboard with filters | ✅ |
| 7 | PDF/report export (per site) | ✅ |

### Beyond the brief

| Area | Capability | Status |
|---|---------|--------|
| **GIS Atlas** | Satellite/terrain/street/dark basemaps, thematic layers (boundary, streams, water bodies, structures), Turf.js right-click/double-tap assessment, **Analyze lenses** (Trend/Vegetation/Water/Drainage/Land use recolouring), search + region filter, field-photo markers, fullscreen | ✅ |
| **Watershed Workspace** | Single-screen per-site flow: satellite map framed to the catchment, **timeline slider + play** driving an NDVI overlay, field-photo ↔ satellite compare, **before/after swipe** change detection, land-use donut, health ring, PDF report | ✅ |
| **Upload-your-own-imagery** | Analyse a GeoTIFF's bands → NDVI/NDWI on the server (geotiff.js) | ✅ |
| **Real watershed boundaries** | Upload GeoJSON (QGIS / SRISHTI-DRISHTI) per site; sample geometry fallback | ✅ |
| **Real land cover** | Upload ESA WorldCover / Dynamic World raster → classified land-use %; curated sample fallback | ✅ |
| **External data sources** | Configurable government/EO map layers (NASA GIBS working; Bhuvan / SRISHTI-DRISHTI via `.env`) | ✅ |
| **App shell** | Dark grouped sidebar (Atlas · Explore · Analyze · Insights), Field Images gallery, activity feed, mobile drawer | ✅ |

## Tech stack

- **Frontend:** React + Vite, `react-leaflet` + Leaflet (maps), `@turf/turf` (spatial analysis),
  Recharts (charts), `react-router-dom`; premium design system (Inter + Fraunces, glass, motion).
- **Backend:** Node.js + Express.
- **Database:** SQLite via Node's built-in `node:sqlite` (zero external DB to install).
- **Satellite:** Sentinel Hub Process + Statistical API — with a **deterministic mock
  layer** so the whole app runs offline and demos never wait on the network.
- **Raster/vector:** `geotiff.js` (NDVI + land-cover classification from uploaded rasters),
  `@turf/turf` (areas, lengths, point-in-polygon), `pdfkit` + `svg-to-pdfkit` (PDF reports),
  `exifr` (photo GPS), `multer` (uploads).

## Project layout

```
JalDrishti/
├─ backend/          Express API + SQLite + Sentinel Hub service
│  ├─ src/
│  │  ├─ server.js           app entry
│  │  ├─ db.js               schema (sites, photos, observations, site_geo, site_landcover)
│  │  ├─ seed.js             5 demo sites + curated NDVI time-series
│  │  ├─ routes/             sites, satellite, photos, dashboard, geo, analyze, config, activity
│  │  └─ services/           sentinelHub (mock+live), trend, heatmap, enrich, geodata (GIS
│  │                         layers), raster (GeoTIFF NDVI + land cover), landuse, report (PDF)
│  └─ .env.example
└─ frontend/         React + Vite SPA
   └─ src/
      ├─ App.jsx              shell (sidebar + routed content)
      ├─ pages/               MapPage (Atlas), WorkspacePage, DashboardPage, SitesPage,
      │                       SiteDetailPage, GalleryPage
      └─ components/          Sidebar, MapView, NdviChart, BeforeAfter, SiteForm,
                              LocationPicker, TrendBadge, Toast
```

## Getting started

**Prerequisites:** Node.js ≥ 22 (uses the built-in `node:sqlite`).

### 1. Backend

```bash
cd backend
npm install
npm run seed        # loads 5 demo sites with pre-computed satellite data
npm start           # → http://localhost:4000  (satellite mode: mock)
```

### 2. Frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev         # → http://localhost:5173
```

Open **http://localhost:5173**. The Vite dev server proxies `/api`, `/images`,
and `/uploads` to the backend, so no extra config is needed.

## Going live with real Sentinel-2 data

The app ships in **mock mode**. To fetch real imagery:

1. Create a free Sentinel Hub trial account and an OAuth client:
   https://apps.sentinel-hub.com/dashboard/
2. `cp backend/.env.example backend/.env` and fill in `SH_CLIENT_ID` +
   `SH_CLIENT_SECRET`.
3. Restart the backend. The top-right badge flips to **🛰 Sentinel Hub (live)** and
   the "Fetch NDVI" button pulls real data. If a live call fails, it falls back to
   mock so the demo never breaks. **No code changes required.**

## Demo data

`npm run seed` loads 5 real Indian watershed locations with 8 quarterly
observations each (2023–2024):

| Site | District | Intervention | Trend |
|------|----------|--------------|-------|
| Hiware Bazar Watershed | Ahmednagar, MH | Check-dam | Improving (+96%) |
| Ralegan Siddhi Watershed | Ahmednagar, MH | Percolation tank | Improving (+49%) |
| Arvari River Catchment | Alwar, RJ | Afforestation | Improving (+164%) |
| Anantapur Dryland Block | Anantapur, AP | Contour trench | Declining (−34%) |
| Jhabua Micro-Watershed | Jhabua, MP | Pond | Stable (+3%) |

Re-seed anytime with `npm run reset` (wipes and reloads).

## API reference (backend, port 4000)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | health + satellite mode |
| GET | `/api/mode` | `mock` or `sentinel-hub` |
| GET | `/api/sites` | all sites with trend (map data) |
| GET | `/api/sites/:id` | site + observations + photos + trend |
| POST/PUT/DELETE | `/api/sites[/:id]` | site CRUD |
| POST | `/api/sites/:id/observations/fetch` | fetch/cache a satellite observation for a date |
| GET | `/api/sites/:id/report` | per-site PDF report |
| GET | `/api/sites/:id/landuse` | land-use distribution (real if uploaded, else curated sample) |
| POST | `/api/sites/:id/analyze` | upload a GeoTIFF → compute NDVI/NDWI from its bands |
| POST/DELETE | `/api/sites/:id/landcover` | upload ESA WorldCover / Dynamic World raster → classified land use / revert |
| GET/POST/DELETE | `/api/sites/:id/geo` | per-site GIS status / upload boundary GeoJSON / revert |
| GET/POST/DELETE | `/api/sites/:id/photos`, `/api/photos/:id` | field photo upload/list/delete (EXIF GPS) |
| GET | `/api/photos` | all field photos (for the gallery + atlas markers) |
| GET | `/api/geo` | all GIS layers (boundaries, streams, water bodies, structures) |
| GET | `/api/config` | runtime config + external map layers (Bhuvan / SRISHTI-DRISHTI / NASA) |
| GET | `/api/activity?limit=` | recent-activity feed (photos, readings, interventions) |
| GET | `/api/dashboard?district=&intervention_type=&from=&to=` | aggregates |

### How the trend is computed
Observations for a site are sorted by date; the latest NDVI is compared to the
baseline (earliest). ≥ +5 % ⇒ **Improving**, ≤ −5 % ⇒ **Declining**, else
**Stable**. See `backend/src/services/trend.js`.

---

_Built for the Smart India Hackathon. Mock satellite data is clearly labelled as
such throughout the UI._
