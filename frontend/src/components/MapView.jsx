import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer, TileLayer, WMSTileLayer, Marker, Popup, GeoJSON, LayersControl,
  LayerGroup, ZoomControl, useMap, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import * as turf from '@turf/turf';
import { TREND_COLORS } from '../api.js';
import TrendBadge from './TrendBadge.jsx';

const { BaseLayer, Overlay } = LayersControl;

const LENSES = [
  { id: 'trend', label: 'Trend' },
  { id: 'vegetation', label: 'Vegetation' },
  { id: 'water', label: 'Water' },
  { id: 'drainage', label: 'Drainage' },
  { id: 'landuse', label: 'Land use' },
];

const svg = (d) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const FsIcon = ({ exit }) => svg(exit
  ? <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />
  : <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />);
const HideIcon = () => svg(<path d="M5 12h14" />);

// --- colour ramps ---
const hex = (c) => { c = c.replace('#', ''); return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)); };
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function mix(h1, h2, t) { const a = hex(h1), b = hex(h2); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; }
const ndviColor = (v) => mix('#c2963a', '#1a7d3f', clamp01(((v ?? 0.1) - 0.1) / 0.6));
const ndwiColor = (v) => mix('#d8c9a6', '#1f7fa8', clamp01(((v ?? -0.3) + 0.3) / 0.6));

function pinColorFor(site, lens) {
  switch (lens) {
    case 'vegetation': return ndviColor(site.latestNdvi);
    case 'water': return ndwiColor(site.latestNdwi);
    case 'drainage': return '#0e7b84';
    case 'landuse': return site.dominantLandUse?.color ?? '#99a29a';
    default: return TREND_COLORS[site.trend.color];
  }
}
function pinIcon(color, assess = false) {
  return L.divIcon({ className: '', html: `<div class="pin${assess ? ' pin-assess' : ''}" style="background:${color}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -12] });
}

function SizeFix() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t = setTimeout(fix, 200); map.whenReady(fix);
    window.addEventListener('resize', fix);
    document.addEventListener('fullscreenchange', fix);
    return () => { clearTimeout(t); window.removeEventListener('resize', fix); document.removeEventListener('fullscreenchange', fix); };
  }, [map]);
  return null;
}
function FitBounds({ points }) {
  const map = useMap();
  useMemo(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 11);
    else map.fitBounds(points, { padding: [60, 60], animate: false });
  }, [map, points]);
  return null;
}
// Assess a location on RIGHT-CLICK (desktop) or DOUBLE-TAP/dbl-click (touch),
// leaving single-click free for panning/exploring.
function ClickAssess({ layers, onResult }) {
  const assess = (e) => {
    if (!layers) return;
    if (e.originalEvent) e.originalEvent.preventDefault();
    const pt = turf.point([e.latlng.lng, e.latlng.lat]);
    let watershed = null;
    for (const f of layers.watersheds.features) if (turf.booleanPointInPolygon(pt, f)) { watershed = f.properties.name; break; }
    const nearest = (features, toGeom) => { let best = null; for (const f of features) { const km = toGeom(f); if (!best || km < best.km) best = { km, name: f.properties.name }; } return best; };
    const water = nearest(layers.waterbodies.features, (f) => turf.distance(pt, turf.centroid(f), { units: 'kilometers' }));
    const stream = nearest(layers.streams.features, (f) => turf.nearestPointOnLine(f, pt, { units: 'kilometers' }).properties.dist);
    onResult({ latlng: e.latlng, watershed, water, stream });
  };
  useMapEvents({ contextmenu: assess, dblclick: assess });
  return null;
}

const boundaryStyle = (lens) => ({ color: '#0e7b84', weight: 2.2, dashArray: '2 7', lineCap: 'round', fillColor: lens === 'vegetation' ? '#2f8f5b' : '#0e7b84', fillOpacity: lens === 'vegetation' ? 0.12 : 0.06 });
const streamStyle = (lens) => (f) => ({ color: '#2c8fb8', weight: lens === 'drainage' ? (f.properties.order >= 3 ? 4 : 2.4) : (f.properties.order >= 3 ? 3 : 1.5), opacity: lens === 'water' ? 0.4 : 0.9 });
const waterStyle = (lens) => ({ color: '#1f7fa8', weight: 1, fillColor: '#3aa0c9', fillOpacity: lens === 'water' ? 0.72 : 0.5 });

function ExternalTile({ layer }) {
  if (layer.type === 'wms') return <WMSTileLayer url={layer.url} layers={layer.layers} format="image/png" transparent={layer.kind === 'overlay'} attribution={layer.attribution} />;
  return <TileLayer url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom || 19} />;
}

export default function MapView({ sites, geo, externalLayers = [], lens = 'trend', onLens }) {
  const [assessment, setAssessment] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [fsPseudo, setFsPseudo] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const nudge = () => setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
  const toggleFs = async () => {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (fsPseudo) { setFsPseudo(false); nudge(); return; }
    try { await wrapRef.current?.requestFullscreen(); }
    catch { setFsPseudo(true); nudge(); } // embedded/blocked → CSS fallback
  };
  const fs = isFs || fsPseudo;
  const points = sites.map((s) => [s.latitude, s.longitude]);
  const center = points[0] || [22.5, 78.9];
  const extBase = externalLayers.filter((l) => l.kind === 'base');
  const extOverlay = externalLayers.filter((l) => l.kind === 'overlay');
  const counts = sites.reduce((a, s) => { a[s.trend.label] = (a[s.trend.label] || 0) + 1; return a; }, {});
  const sum = geo?.summary;

  const withN = sites.filter((s) => s.latestNdvi != null);
  const avgNdvi = withN.length ? round(mean(withN.map((s) => s.latestNdvi)), 2) : '—';
  const avgNdwi = withN.length ? round(mean(withN.map((s) => s.latestNdwi ?? 0)), 2) : '—';
  const luCounts = tally(sites.map((s) => s.dominantLandUse).filter(Boolean));

  return (
    <div className={`map-wrap ${fsPseudo ? 'fs' : ''}`} ref={wrapRef}>
      <MapContainer center={center} zoom={6} scrollWheelZoom zoomControl={false} doubleClickZoom={false}>
        <SizeFix />
        <FitBounds points={points} />
        <ZoomControl position="bottomright" />

        <LayersControl position="topright">
          <BaseLayer checked name="Satellite"><TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} /></BaseLayer>
          <BaseLayer name="Terrain"><TileLayer attribution="&copy; OpenTopoMap (CC-BY-SA)" url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" maxZoom={17} /></BaseLayer>
          <BaseLayer name="Street"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></BaseLayer>
          <BaseLayer name="Dark GIS"><TileLayer attribution="&copy; OpenStreetMap, &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" /></BaseLayer>
          {extBase.map((l) => <BaseLayer key={l.id} name={l.name}><ExternalTile layer={l} /></BaseLayer>)}

          {geo && (
            <>
              <Overlay checked name={`Watershed boundary (${geo.watersheds.features.length})`}>
                <GeoJSON key={`b-${lens}`} data={geo.watersheds} style={boundaryStyle(lens)} />
              </Overlay>
              <Overlay checked name={`Streams / drainage (${geo.streams.features.length})`}>
                <GeoJSON key={`s-${lens}`} data={geo.streams} style={streamStyle(lens)} />
              </Overlay>
              <Overlay checked name={`Water bodies (${geo.waterbodies.features.length})`}>
                <GeoJSON key={`w-${lens}`} data={geo.waterbodies} style={waterStyle(lens)}
                  onEachFeature={(f, layer) => layer.bindPopup(`<b>${f.properties.name}</b><br/>${f.properties.area_ha} ha`)} />
              </Overlay>
              <Overlay name="Structures">
                <GeoJSON data={{ type: 'FeatureCollection', features: geo.structures.features.filter((f) => !f.properties.primary) }}
                  pointToLayer={(f, latlng) => L.circleMarker(latlng, { radius: 5, color: '#fffdf8', weight: 1.5, fillColor: '#b56445', fillOpacity: 1 }).bindPopup(`<b>${f.properties.name}</b><br/>${f.properties.structure_type}`)} />
              </Overlay>
            </>
          )}

          <Overlay checked name="Watershed sites"><SitesLayer sites={sites} lens={lens} /></Overlay>
          {extOverlay.map((l) => <Overlay key={l.id} name={l.name}><ExternalTile layer={l} /></Overlay>)}
        </LayersControl>

        <ClickAssess layers={geo} onResult={setAssessment} />
        {assessment && <Marker position={assessment.latlng} icon={pinIcon('#17241d', true)} />}
      </MapContainer>

      {/* Restore pill (when the summary is hidden) */}
      {!summaryOpen && (
        <div className="map-panel map-restore">
          <button className="mr-show" onClick={() => setSummaryOpen(true)}>Programme summary</button>
          <button className="mr-icon" onClick={toggleFs} title={fs ? 'Exit fullscreen' : 'Fullscreen'} aria-label="Fullscreen"><FsIcon exit={fs} /></button>
        </div>
      )}

      {/* Lens control */}
      <div className="map-panel lens-bar">
        {LENSES.map((l) => (
          <button key={l.id} className={`lens-btn ${lens === l.id ? 'on' : ''}`} onClick={() => onLens?.(l.id)}>{l.label}</button>
        ))}
      </div>

      {/* Floating glass summary (adapts to the lens) */}
      {summaryOpen && (
      <div className="map-panel hero-summary">
        <div className="panel-ctrls">
          <button onClick={toggleFs} title={fs ? 'Exit fullscreen' : 'Fullscreen'} aria-label="Fullscreen"><FsIcon exit={fs} /></button>
          <button onClick={() => setSummaryOpen(false)} title="Hide panel" aria-label="Hide panel"><HideIcon /></button>
        </div>
        <div className="eyebrow">Watershed programme · {LENSES.find((l) => l.id === lens).label}</div>
        <div className="big">{sites.length}<small> sites</small></div>

        {lens === 'trend' && (
          <div className="hero-legend">
            <div className="row"><span className="swatch" style={{ background: TREND_COLORS.green }} />Improving<span className="c">{counts.Improving || 0}</span></div>
            <div className="row"><span className="swatch" style={{ background: TREND_COLORS.yellow }} />Stable<span className="c">{counts.Stable || 0}</span></div>
            <div className="row"><span className="swatch" style={{ background: TREND_COLORS.red }} />Declining<span className="c">{counts.Declining || 0}</span></div>
          </div>
        )}
        {lens === 'vegetation' && <Ramp from="#c2963a" to="#1a7d3f" lo="sparse" hi="dense" caption={`Avg NDVI ${avgNdvi}`} />}
        {lens === 'water' && <Ramp from="#d8c9a6" to="#1f7fa8" lo="dry" hi="wet" caption={`Avg NDWI ${avgNdwi}`} />}
        {lens === 'drainage' && (
          <div className="hero-legend"><div className="lens-focus"><b>{sum?.drainageKm ?? '—'}</b> km<span>{sum?.streamSegments ?? 0} stream segments</span></div></div>
        )}
        {lens === 'landuse' && (
          <div className="hero-legend">
            {luCounts.map((c) => <div className="row" key={c.name}><span className="swatch" style={{ background: c.color }} />{c.name}<span className="c">{c.count}</span></div>)}
          </div>
        )}

        {sum && (
          <div className="hero-metrics">
            <div className="m"><div className="v">{sum.watershedAreaKm2}<span style={{ fontSize: 11 }}> km²</span></div><div className="k">Catchment area</div></div>
            <div className="m"><div className="v">{sum.drainageKm}<span style={{ fontSize: 11 }}> km</span></div><div className="k">Drainage</div></div>
            <div className="m"><div className="v">{sum.waterBodies}</div><div className="k">Water bodies</div></div>
            <div className="m"><div className="v">{sum.structures}</div><div className="k">Structures</div></div>
          </div>
        )}
      </div>
      )}

      {!assessment && <div className="hero-hint"><span className="ping" /> Right-click (or double-tap) the map to assess a location</div>}

      {assessment && (
        <div className="map-panel assess-panel">
          <button className="assess-close" onClick={() => setAssessment(null)} aria-label="Close">×</button>
          <div className="assess-title">Location assessment</div>
          <div className="assess-coord">{assessment.latlng.lat.toFixed(4)}°, {assessment.latlng.lng.toFixed(4)}°</div>
          <div className="assess-grid">
            <div className="cell"><div className="k">Watershed</div><div className="v" style={{ fontSize: assessment.watershed ? 14 : 13 }}>{assessment.watershed || 'Outside catchments'}</div></div>
            <div className="cell"><div className="k">Nearest water body</div><div className="v">{assessment.water ? fmt(assessment.water.km) : '—'}</div></div>
            <div className="cell"><div className="k">Nearest drainage</div><div className="v">{assessment.stream ? fmt(assessment.stream.km) : '—'}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Ramp({ from, to, lo, hi, caption }) {
  return (
    <div className="hero-legend">
      <div className="lens-ramp" style={{ background: `linear-gradient(90deg, ${from}, ${to})` }} />
      <div className="lens-ramp-labels"><span>{lo}</span><span>{hi}</span></div>
      <div className="lens-caption">{caption}</div>
    </div>
  );
}

function SitesLayer({ sites, lens }) {
  return (
    <LayerGroup>
      {sites.map((s) => (
        <Marker key={s.id} position={[s.latitude, s.longitude]} icon={pinIcon(pinColorFor(s, lens))}>
          <Popup>
            <div className="map-popup">
              <h4>{s.name}</h4>
              <div className="meta">{s.district}, {s.state} · {s.intervention_type}</div>
              <TrendBadge label={s.trend.label} pct={s.trend.ndviChangePct} />
              <div style={{ marginTop: 8 }}><Link to={`/sites/${s.id}/explore`}>Open workspace →</Link></div>
            </div>
          </Popup>
        </Marker>
      ))}
    </LayerGroup>
  );
}

function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function round(n, dp) { const f = 10 ** dp; return Math.round(n * f) / f; }
function tally(items) {
  const m = new Map();
  for (const it of items) { const e = m.get(it.name) || { name: it.name, color: it.color, count: 0 }; e.count++; m.set(it.name, e); }
  return [...m.values()].sort((a, b) => b.count - a.count);
}
function fmt(km) { return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`; }
