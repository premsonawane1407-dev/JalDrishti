# JalDrishti — Complete Project Report (A to Z)

> **Read this if you have never seen the project before.** It explains what
> JalDrishti is, the problem it solves, every technology used (and *why* that
> one and not another), every file and how the files connect, how each part
> answers the official problem statement, and what is still left to build.
>
> _Last updated: 2026-09-06 • Status: Features 1–7 complete, deployed live._

---

## 0. The 30-second summary

**JalDrishti** ("Jal" = water, "Drishti" = vision → *"water vision"*) is a web
application that helps government planners **see whether a watershed project is
actually working**. Field officers build check-dams, ponds, and plantations to
conserve water and land. Today, the geo-tagged photos they take are only used as
paperwork. JalDrishti combines those **ground photos** with **satellite imagery**,
automatically measures how green (vegetation) and how wet (water) each location is
over time, labels every site **Improving / Stable / Declining**, and shows it all
on an interactive **GIS map**, a **dashboard**, and a downloadable **PDF report**.

- **Live app:** https://jaldrishti-5qym.onrender.com
- **Code:** https://github.com/premsonawane1407-dev/JalDrishti
- **Problem statement:** SIH **PS 26015** — Ministry of Rural Development,
  Department of Land Resources (DoLR).

---

## 1. The problem we are solving (in plain words)

India spends heavily on **watershed development** — building small structures
(check-dams, ponds, contour trenches) and planting trees so rainwater soaks into
the ground instead of running off. The hard part is **monitoring**: did the work
actually improve the land and water?

Officially (PS 26015), the pain points are:
1. Monitoring is manual, slow, and fragmented (field visits, paper reports).
2. **Geo-tagged photos are collected but only used for documentation**, never
   analysed against satellite data.
3. There is no single tool that ties **field photos + satellite data + maps +
   change-over-time** together into evidence a planner can act on.

**JalDrishti is that single tool.** You register a site, the system pulls
satellite data for its coordinates, computes vegetation/water indices, compares
them across time, and gives you a clear verdict with visuals and a report.

### The official "expected solutions" (a–g) and where we stand

| PS asks for | JalDrishti today |
|---|---|
| **(a)** Integrated framework: geo-photos + satellite | ✅ Sites + photos + satellite indices unified on one map/dashboard |
| **(b)** Better geo-coded **image interpretation** | 🟡 Photos are GPS-placed & shown beside indices; deeper photo analysis is a future phase |
| **(c)** Thematic maps (vegetation, water, drainage, boundaries) | ✅ NDVI/NDWI + GIS layers: watershed boundary, streams, water bodies, structures |
| **(d)** Enhanced monitoring & change detection | ✅ Time-series + Improving/Stable/Declining trend engine |
| **(e)** Scientific support for decisions | ✅ Dashboard rollups + per-site PDF evidence reports |
| **(f)** Scalable, cost-effective | ✅ Lightweight web app, free tiers, cached data |
| **(g)** Use the SRISHTI-DRISHTI satellite platform | 🔜 Built with a swappable satellite layer; SRISHTI-DRISHTI is a planned drop-in |

---

## 2. What a user can actually do (the features)

1. **Register & manage watershed sites** — name, district, coordinates,
   intervention type/date. Pick the location by clicking a map.
2. **Upload field photos** — GPS is read automatically from the photo's EXIF
   data; a photo timeline is kept per site.
3. **Fetch satellite data** for a site on any date — vegetation index (NDVI) and
   water index (NDWI) plus a colour heatmap. Results are cached.
4. **See the trend** — the app compares the latest reading to the baseline and
   labels the site Improving / Stable / Declining with a % change.
5. **GIS map** — satellite/terrain/street/dark basemaps, toggleable layers
   (watershed boundaries, streams, water bodies, structures), trend-coloured
   pins, and **click-anywhere spatial analysis** (which watershed, nearest water
   body, nearest drainage).
6. **Dashboard** — counts of improving/stable/declining, charts by district and
   intervention type, filters.
7. **PDF report** — one-click professional report per site (trend, chart,
   heatmap, table, photos).

---

## 3. The big picture: how it all works together

```
        ┌──────────────────────── THE USER (browser) ────────────────────────┐
        │  React app: Map · Dashboard · Sites · Site detail · PDF button       │
        └───────────────▲───────────────────────────────────────┬────────────┘
                        │  asks for data / actions (HTTP /api)   │  gets JSON,
                        │                                        │  images, PDF
        ┌───────────────┴────────────────────────────────────────▼────────────┐
        │                    BACKEND  (Node.js + Express)                      │
        │                                                                      │
        │  Routes  → sites · satellite · photos · dashboard · geo · report     │
        │  Services→ sentinelHub (satellite) · trend · heatmap · geodata ·     │
        │            enrich · report                                           │
        │                                                                      │
        │  Database (SQLite): sites · photos · observations                    │
        │  Files: generated heatmaps (/images) · uploaded photos (/uploads)    │
        └──────────────────────────────────────────────────────────────────────┘
```

**Two halves talk over HTTP.** The frontend (what you see) never touches the
database directly — it asks the backend through URLs starting with `/api`. In
development a proxy forwards those calls; in production a single server serves
both, so there is one web address and no cross-site complications.

---

## 4. The technology stack — what each piece is, and *why this one*

### Language & runtime
- **JavaScript on Node.js** for *both* frontend and backend. **Why:** one
  language across the whole project = faster to build and reason about. Python
  (Flask) was the brief's first suggestion, but Python wasn't installed and the
  satellite math can be done by the satellite provider, so Node avoided a whole
  toolchain.

### Backend
- **Express** — the web-server framework that defines the `/api` endpoints.
  *Why:* the standard, minimal, well-documented choice for Node APIs.
- **`node:sqlite`** (SQLite built into Node) — the database. *Why:* zero
  install, one file on disk, perfect for a demo with a handful of sites. We
  deliberately avoided **PostgreSQL/PostGIS** (powerful but needs a server to
  install/run) and **MongoDB** (also a separate service). We also avoided the
  popular `better-sqlite3` package because it is a *native* add-on that needs
  compiling; the built-in module needs nothing.
- **multer** — handles file uploads (the field photos). *Why:* the de-facto
  Express upload middleware.
- **exifr** — reads **EXIF** metadata (GPS coordinates, capture date) out of a
  photo. *Why:* small, fast, works on buffers/paths, no native build.
- **@turf/turf** — geospatial maths in pure JavaScript (areas, lengths,
  point-in-polygon, nearest feature). *Why:* gives us "GIS analysis" without
  installing a GIS database. Used on **both** sides.
- **pdfkit** + **svg-to-pdfkit** — build the PDF report in code, and embed our
  SVG heatmaps/photos into it. *Why pdfkit and not a headless browser
  (Puppeteer):* Puppeteer downloads a whole Chromium browser (~150 MB) and is
  heavy to run on a small server; pdfkit is pure JavaScript and light.
- **dotenv** — loads secrets/config from a `.env` file (e.g., satellite API
  keys). **cors** — lets the browser call the API safely.

### Frontend
- **React** — builds the interface out of reusable components. *Why:* the most
  common UI library; huge ecosystem (maps, charts, routing all have React
  wrappers).
- **Vite** — the dev server + build tool. *Why over Create-React-App:* far
  faster startup and builds; modern standard.
- **react-router-dom** — client-side navigation between Map/Dashboard/Sites
  pages without full page reloads.
- **Leaflet** + **react-leaflet** — the interactive map. *Why Leaflet over
  Mapbox/Google:* free, no API key, lightweight, and supports all the layer
  types we need. react-leaflet lets us drive Leaflet with React components.
- **Recharts** — the NDVI/NDWI line charts and dashboard bar charts. *Why over
  Chart.js:* Recharts components are React-native (you write `<LineChart>` as
  JSX), so they fit the codebase cleanly.

### Map data sources (tiles) — free, no keys
- **Esri World Imagery** (satellite), **OpenTopoMap** (terrain),
  **OpenStreetMap** (street), **CARTO** (dark). The user switches between them.

### Satellite data
- **Sentinel Hub** — fetches Sentinel-2 satellite readings and computes NDVI/NDWI
  with the provider's own "evalscript," so we don't do raw pixel maths locally.
  It runs in **mock mode** by default (realistic synthetic data, works offline)
  and flips to **live** the moment real API credentials are added — no code
  change. **SRISHTI-DRISHTI** (the government's platform named in the PS) is a
  planned drop-in behind this same layer.

### Hosting
- **Render** — runs the single Node service (API + built React app) at one
  public URL. *Why not Vercel:* Vercel is serverless and can't keep a SQLite
  file or store uploaded photos on disk; our app needs a normal always-on server.

---

## 5. Every file, what it does, and how it connects

### Backend (`backend/`)

| File | Purpose | Connects to |
|---|---|---|
| `src/server.js` | The entry point. Creates the Express app, enables CORS/JSON, serves `/images` and `/uploads` files, mounts every route group, and (in production) serves the built React app with SPA fallback. Starts listening on the port. | Imports every `routes/*` file, `db.js` (schema init), `paths.js`, and `services/sentinelHub.js` (to report mock/live mode). |
| `src/db.js` | Opens the SQLite database and creates the three tables (`sites`, `photos`, `observations`) if missing. Exposes the `db` handle. | Used by every route and by `enrich.js`, `geodata.js`, `seed.js`. |
| `src/paths.js` | Central definition of folder locations: `DATA_DIR`, `IMAGES_DIR` (generated heatmaps), `UPLOADS_DIR` (user photos), `ROOT_DIR`. Creates them on startup. | Imported by `server.js`, `sentinelHub.js`, `photos.js`, `report.js`, `seed.js`. |
| `src/seed.js` | Fills the database with **5 real Indian watershed demo sites**, 8 quarterly satellite observations each (curated to show all trend types), and placeholder field photos. Run with `npm run seed` / `npm run reset`. | Uses `db.js`, `paths.js`, `services/sentinelHub.js` (heatmap writer), `services/heatmap.js`. |
| `src/routes/sites.js` | CRUD for sites (create/read/update/delete) with validation, the intervention-type list, **and the PDF report endpoint** (`GET /:id/report`). | Uses `db.js`, `services/enrich.js`, `services/report.js`. |
| `src/routes/satellite.js` | Fetch/cache a satellite **observation** for a site+date (`/sites/:id/observations/fetch`), list observations, delete one, and report `/mode` (mock vs live). | Uses `db.js`, `services/sentinelHub.js`, `services/trend.js`. |
| `src/routes/photos.js` | Upload a field photo (reads EXIF GPS/date), list a site's photos, delete a photo. | Uses `db.js`, `paths.js`, multer, exifr. |
| `src/routes/dashboard.js` | Aggregates for the dashboard: counts by trend, breakdowns by district and intervention type, totals, filter options. | Uses `db.js`, `services/enrich.js`. |
| `src/routes/geo.js` | Serves the **GIS layers** (`/geo`) — watershed boundaries, streams, water bodies, structures — as GeoJSON, plus summary totals. | Uses `services/geodata.js`. |
| `src/services/sentinelHub.js` | The **satellite brain**. Dual-mode: mock (deterministic NDVI/NDWI + SVG heatmap) or live (Sentinel Hub OAuth + Statistical/Process API). Same output either way. | Uses `paths.js`, `services/heatmap.js`. Called by `satellite.js`, `seed.js`. |
| `src/services/trend.js` | Pure logic: given a site's observations, sorts by date, compares latest vs baseline NDVI, returns **Improving/Stable/Declining** + % change + colour. | Used by `enrich.js`, `satellite.js`. |
| `src/services/heatmap.js` | Generates the NDVI **heatmap image** as an SVG (colour ramp brown→green), plus a seeded random-number generator for deterministic visuals. | Used by `sentinelHub.js`, `geodata.js`, `seed.js`. |
| `src/services/enrich.js` | Helper that assembles a full site object: its observations, photos, and computed trend. Two functions: one site with detail, all sites for the map/dashboard. | Uses `db.js`, `services/trend.js`. Used by `sites.js`, `dashboard.js`. |
| `src/services/geodata.js` | Generates deterministic **sample GeoJSON** (catchment boundary, streams, water bodies, structures) around each site using Turf, and summary stats. Clearly labelled demo geometry — swappable for real QGIS/SRISHTI-DRISHTI data. | Uses `db.js`, `services/heatmap.js` (seeded RNG), @turf/turf. Used by `geo.js`. |
| `src/services/report.js` | Builds the per-site **PDF** with pdfkit: header, trend verdict box, hand-drawn NDVI/NDWI chart, embedded heatmap, observation table, photos, footer. | Uses `paths.js`, pdfkit, svg-to-pdfkit. Called by `sites.js`. |
| `package.json` | Lists backend dependencies and scripts (`start`, `start:prod`, `seed`, `reset`). | — |
| `.env.example` | Template for configuration (port, Sentinel Hub keys). Copy to `.env` to go live. | Read by `dotenv` in `server.js`/`seed.js`. |

**Backend request flow example — "show me site 1":**
`Browser → GET /api/sites/1 → sites.js → enrich.getSiteWithTrend() → db.js
(reads sites+observations+photos) + trend.js (labels it) → JSON back to browser.`

### Frontend (`frontend/`)

| File | Purpose | Connects to |
|---|---|---|
| `index.html` | The single HTML page React mounts into; sets the title and favicon. | Loads `src/main.jsx`. |
| `vite.config.js` | Dev config: proxies `/api`, `/images`, `/uploads` to the backend so the frontend can use same-origin URLs. | — |
| `src/main.jsx` | Boots React, wraps the app in the router, imports Leaflet CSS + global styles. | Renders `App.jsx`. |
| `src/App.jsx` | The shell: top navigation bar, the mock/live satellite badge, the toast (notification) provider, and the route table (which page shows for which URL). | Imports all `pages/*`, `components/Toast.jsx`, `api.js`. |
| `src/api.js` | One tidy place for **every** backend call (sites, satellite, photos, dashboard, geo, report) plus shared trend colours. | Used by every page/component that needs data. |
| `src/styles.css` | All the visual styling (layout, cards, map, tables, forms, buttons, badges, the assessment panel). | Global. |
| `src/components/MapView.jsx` | The **GIS map**: basemap switcher, thematic GeoJSON layers with toggles, trend-coloured site pins, and Turf-powered click-to-assess side panel. | Uses react-leaflet, @turf/turf, `TrendBadge.jsx`, `api.js` colours. |
| `src/components/NdviChart.jsx` | The NDVI + NDWI line chart over time. | Recharts. Used by `SiteDetailPage`. |
| `src/components/LocationPicker.jsx` | Small click-to-set-coordinates map used inside the site form. | react-leaflet. Used by `SiteForm`. |
| `src/components/SiteForm.jsx` | The create/edit site form with validation and the location picker. | Uses `api.js`, `LocationPicker.jsx`. Used by `SitesPage`. |
| `src/components/TrendBadge.jsx` | The little coloured Improving/Stable/Declining pill. | Used across pages. |
| `src/components/Toast.jsx` | Lightweight pop-up notifications ("Site created", errors). | Provided in `App.jsx`, used by pages. |
| `src/pages/MapPage.jsx` | Home page: trend stat tiles, **GIS stat tiles** (area, water bodies, drainage, structures), the map, and a site table. | Uses `api.js`, `MapView.jsx`, `TrendBadge.jsx`. |
| `src/pages/DashboardPage.jsx` | Program dashboard: filters, stat tiles, stacked bar charts by district/type, and a site table. | Uses `api.js`, Recharts, `TrendBadge.jsx`. |
| `src/pages/SitesPage.jsx` | Manage sites: table with add/edit/delete via a modal form. | Uses `api.js`, `SiteForm.jsx`, `TrendBadge.jsx`. |
| `src/pages/SiteDetailPage.jsx` | The rich single-site view: trend tiles, NDVI/NDWI chart, satellite heatmap + thumbnail timeline, "Fetch NDVI" controls, photo timeline + upload, and the **Download PDF report** button. | Uses `api.js`, `NdviChart.jsx`, `TrendBadge.jsx`, `Toast.jsx`. |
| `package.json` | Frontend dependencies + scripts (`dev`, `build`, `preview`). | — |

### Project root
| File | Purpose |
|---|---|
| `README.md` | Quick-start: what it is, how to run, how to go live, API list. |
| `PROJECT_REPORT.md` | **This document.** |
| `render.yaml` | Tells Render how to build & run the app as one service. |
| `.nvmrc` | Pins the Node version (22) for the host. |
| `.gitignore` | Keeps `node_modules`, the database, and uploads out of Git. |
| `.claude/launch.json` | Local dev convenience for launching the servers. |

---

## 6. The data model (what we store)

Three tables in SQLite:

- **`sites`** — one row per watershed project: name, district, state, latitude,
  longitude, intervention type, intervention date, description.
- **`photos`** — field photos linked to a site: filename, caption, GPS
  latitude/longitude (from EXIF or the map), date taken.
- **`observations`** — one satellite reading per site per date: NDVI, NDWI, cloud
  %, the heatmap image filename, and the source (mock/sentinel-hub). A uniqueness
  rule prevents duplicate readings for the same date (this is the **cache**).

Everything else (the trend label, the GIS layers) is **computed on demand** from
these tables, so it's always consistent.

---

## 7. Key ideas explained simply (glossary for non-technical friends)

- **NDVI (Normalized Difference Vegetation Index)** — a number from satellite
  bands that says *how green/vegetated* a place is. Higher = more/healthier
  plants. Rising NDVI after a watershed project = success.
- **NDWI (Normalized Difference Water Index)** — similar, but for *water
  content/water bodies*. Helps spot ponds filling up.
- **Trend** — we compare a site's newest NDVI to its first (baseline). Up ≥5% =
  **Improving** (green), down ≥5% = **Declining** (red), otherwise **Stable**
  (yellow).
- **GIS (Geographic Information System)** — software for data tied to real-world
  locations, drawn as **layers** (points, lines, polygons, satellite images) you
  can stack and analyse. JalDrishti *is* a GIS app.
- **GeoJSON** — a text format for map shapes (a boundary polygon, a river line).
  Our backend serves the boundaries/streams/water bodies as GeoJSON.
- **EXIF** — hidden metadata inside a photo (including GPS) that a phone camera
  records. We read it to place photos on the map automatically.
- **Evalscript** — a small formula run by the satellite provider's servers to
  compute NDVI/NDWI, so we don't process raw satellite images ourselves.
- **Mock mode** — the app invents realistic satellite numbers so it works with no
  API keys and no internet; flip a switch (add keys) for real data.
- **Turf.js** — a library that does map-maths in the browser: "is this point
  inside that watershed?", "how far to the nearest pond?".

---

## 8. Why each choice helps solve the problem statement

- **Field photos + EXIF GPS + timeline** → directly attacks the PS complaint that
  "geo-tagged photos are used only for documentation." Here they're placed on the
  map and shown next to satellite trends. *(PS a, b)*
- **Satellite NDVI/NDWI via evalscript** → the scientific, cost-effective
  measurement the PS wants, without heavy local processing. *(PS c, d, f)*
- **Trend engine (Improving/Declining)** → turns raw numbers into an
  actionable verdict for planners. *(PS d, e)*
- **GIS map (boundaries, streams, water bodies, structures + click-to-assess)** →
  the "integrated visualization framework" and thematic maps the PS asks for.
  *(PS a, c)*
- **Dashboard** → program/district-level evidence for decisions. *(PS e)*
- **PDF report** → shareable, printable proof of impact per site. *(PS e)*
- **Swappable satellite layer** → ready to plug into **SRISHTI-DRISHTI**. *(PS g)*
- **Lightweight, free, deployed** → the scalable/replicable approach. *(PS f)*

---

## 9. What is done, and what is next

### Done (verified, live)
- ✅ Feature 1 — Site & field-photo registry (CRUD, EXIF GPS, timeline)
- ✅ Feature 2 — Satellite integration (mock + live, cached)
- ✅ Feature 3 — NDVI/NDWI computation
- ✅ Feature 4 — Time-series change detection + trend labels
- ✅ Feature 5 — Interactive **GIS** map (basemaps, thematic layers, spatial analysis)
- ✅ Feature 6 — Summary dashboard with filters
- ✅ Feature 7 — Per-site PDF report
- ✅ Deployed as one service on Render

### Next phases (planned)
1. **Phase 2 — Upload-your-own-imagery analysis** (`geotiff.js`): a user uploads
   satellite images (e.g., 3 years) and the platform itself computes NDVI/change
   and returns a report — fully automated, no manual GIS tool. *Strongest answer
   to the PS "single framework" demand.* *(PS a, b, c)*
2. **Phase 3 — Real watershed boundaries & thematic layers**: replace the sample
   GeoJSON with real boundaries/drainage authored in **QGIS** or from
   SRISHTI-DRISHTI; add land-use maps. *(PS a, c)*
3. **Phase 4 — SRISHTI-DRISHTI / Bhuvan data source**: wire the government
   satellite platform behind the existing satellite layer, add Bhuvan basemaps.
   *(PS g)*
4. **Nice-to-haves**: district/program-level PDF, single-admin login, a
   persistent disk so uploaded photos survive redeploys, and code-splitting to
   shrink the JavaScript bundle.

---

## 10. How to run it (for a teammate)

**Prerequisite:** Node.js 22+.

```bash
# Backend (terminal 1)
cd backend
npm install
npm run seed        # load the 5 demo sites
npm start           # API on http://localhost:4000

# Frontend (terminal 2)
cd frontend
npm install
npm run dev         # app on http://localhost:5173
```

Open http://localhost:5173. To use **real** satellite data, copy
`backend/.env.example` to `backend/.env`, add Sentinel Hub credentials, and
restart — the badge flips to "live" with no code changes.

**Deploy:** push to GitHub; Render auto-builds the whole app as one service from
`render.yaml`.

---

*JalDrishti — turning field photos and satellites into clear watershed evidence.*
