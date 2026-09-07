import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, Marker, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { api } from '../api.js';
import TrendBadge from '../components/TrendBadge.jsx';
import BeforeAfter from '../components/BeforeAfter.jsx';
import { useToast } from '../components/Toast.jsx';

const boundaryStyle = { color: '#0e7b84', weight: 2.4, dashArray: '2 7', lineCap: 'round', fillColor: '#0e7b84', fillOpacity: 0.05 };
const streamStyle = (f) => ({ color: '#2c8fb8', weight: f.properties.order >= 3 ? 3 : 1.5, opacity: 0.9 });
const waterStyle = { color: '#1f7fa8', weight: 1, fillColor: '#3aa0c9', fillOpacity: 0.5 };

const cameraIcon = L.divIcon({ className: '', html: '<div class="photo-pin">📷</div>', iconSize: [32, 32], iconAnchor: [16, 16] });

function FrameTo({ bounds }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => { map.invalidateSize(); if (bounds) map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.1 }); }, 220);
    return () => clearTimeout(t);
  }, [map, bounds]);
  return null;
}

export default function WorkspacePage() {
  const { id } = useParams();
  const notify = useToast();
  const [site, setSite] = useState(null);
  const [geo, setGeo] = useState(null);
  const [landuse, setLanduse] = useState(null);
  const [dateIndex, setDateIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [layers, setLayers] = useState({ boundary: true, vegetation: true, water: true, streams: true, photos: true });
  const timer = useRef(null);

  const loadLanduse = () => api.landuse(id).then(setLanduse).catch(() => {});
  useEffect(() => {
    let alive = true;
    api.getSite(id).then((s) => { if (!alive) return; setSite(s); setDateIndex(Math.max(0, s.observations.length - 1)); });
    api.geo().then((g) => alive && setGeo(g)).catch(() => {});
    api.landuse(id).then((l) => alive && setLanduse(l)).catch(() => {});
    return () => { alive = false; clearInterval(timer.current); };
  }, [id]);

  useEffect(() => {
    clearInterval(timer.current);
    if (!playing || !site) return;
    timer.current = setInterval(() => {
      setDateIndex((i) => (i >= site.observations.length - 1 ? 0 : i + 1));
    }, 1100);
    return () => clearInterval(timer.current);
  }, [playing, site]);

  const siteGeo = useMemo(() => {
    if (!geo || !site) return null;
    const f = (fc) => fc.features.filter((x) => x.properties.site_id === site.id);
    return { boundary: f(geo.watersheds)[0], streams: f(geo.streams), waterbodies: f(geo.waterbodies), structures: f(geo.structures) };
  }, [geo, site]);

  const bounds = useMemo(() => {
    if (!siteGeo?.boundary) return null;
    const [w, s, e, n] = turf.bbox(siteGeo.boundary);
    return [[s, w], [n, e]];
  }, [siteGeo]);

  if (!site) return <div className="loader"><span className="spinner" /> Opening watershed…</div>;

  const obs = site.observations;
  const current = obs[dateIndex] || obs[obs.length - 1];
  const baseline = obs[0];
  const latest = obs[obs.length - 1];
  const t = site.trend;

  const veg = clamp(((latest?.ndvi ?? 0) / 0.8) * 100, 0, 100);
  const water = clamp((((latest?.ndwi ?? -0.1) + 0.3) / 0.6) * 100, 0, 100);
  const trendScore = t.label === 'Improving' ? 88 : t.label === 'Declining' ? 42 : 66;
  const health = Math.round(0.5 * veg + 0.2 * water + 0.3 * trendScore);
  const healthLabel = health >= 70 ? 'Good' : health >= 50 ? 'Moderate' : 'Low';
  const ringColor = health >= 70 ? 'var(--improving)' : health >= 50 ? 'var(--stable)' : 'var(--declining)';

  const layerDefs = { boundary: 'Boundary', vegetation: 'Vegetation (NDVI)', water: 'Water', streams: 'Drainage', photos: 'Field photos' };

  return (
    <div className="workspace">
      <Link to="/" className="back-link">← All watersheds</Link>

      <div className="map-wrap ws-map reveal">
        <MapContainer center={[site.latitude, site.longitude]} zoom={11} scrollWheelZoom zoomControl={false}>
          <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
          {bounds && <FrameTo bounds={bounds} />}
          <ZoomControl position="bottomright" />
          {layers.vegetation && current && bounds && (
            <ImageOverlay key={current.image_filename} url={`/images/${current.image_filename}`} bounds={bounds} opacity={0.7} />
          )}
          {layers.boundary && siteGeo?.boundary && <GeoJSON key={`b-${site.id}`} data={siteGeo.boundary} style={boundaryStyle} />}
          {layers.streams && siteGeo && <GeoJSON key="s" data={{ type: 'FeatureCollection', features: siteGeo.streams }} style={streamStyle} />}
          {layers.water && siteGeo && (
            <GeoJSON key="w" data={{ type: 'FeatureCollection', features: siteGeo.waterbodies }} style={waterStyle}
              onEachFeature={(f, layer) => layer.bindPopup(`<b>${f.properties.name}</b><br/>${f.properties.area_ha} ha`)} />
          )}
          {layers.photos && site.photos.filter((p) => Number.isFinite(p.latitude)).map((p) => (
            <Marker key={p.id} position={[p.latitude, p.longitude]} icon={cameraIcon}
              eventHandlers={{ click: () => setSelectedPhoto(p) }} />
          ))}
        </MapContainer>

        {/* Watershed overview (context) */}
        <div className="map-panel ws-overview">
          <div className="eyebrow">{site.district}{site.state ? `, ${site.state}` : ''}</div>
          <h2>{site.name}</h2>
          <div className="ws-meta"><span className="pill">{site.intervention_type}</span><TrendBadge label={t.label} pct={t.ndviChangePct} /></div>
          <div className="ws-health">
            <div className="ring" style={{ '--v': health, '--rc': ringColor }}><span>{health}</span></div>
            <div><div className="hl" style={{ color: ringColor }}>{healthLabel}</div><div className="hk">Watershed health<br /><span className="muted">sample composite</span></div></div>
          </div>
          <div className="ws-facts">
            <div><b>{siteGeo?.boundary?.properties?.area_km2 ?? '—'}</b><span>km² catchment</span></div>
            <div><b>{latest?.ndvi ?? '—'}</b><span>latest NDVI</span></div>
            <div><b>{site.photos.length}</b><span>field photos</span></div>
          </div>
        </div>

        {/* Timeline */}
        <div className="map-panel ws-timeline">
          <button className="play" onClick={() => setPlaying((p) => !p)} aria-label="Play timeline">{playing ? '❚❚' : '►'}</button>
          <input className="ws-range" type="range" min={0} max={obs.length - 1} value={dateIndex}
            onChange={(e) => { setPlaying(false); setDateIndex(Number(e.target.value)); }} />
          <div className="cur">{current?.observation_date}</div>
        </div>

        {/* Layer chips */}
        <div className="map-panel ws-layers">
          {Object.entries(layerDefs).map(([k, label]) => (
            <button key={k} className={`chip ${layers[k] ? 'on' : ''}`} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}>{label}</button>
          ))}
        </div>

        {/* Field photo ↔ satellite compare */}
        {selectedPhoto && (
          <div className="map-panel ws-photo">
            <button className="assess-close" onClick={() => setSelectedPhoto(null)} aria-label="Close">×</button>
            <div className="assess-title">Field photo ↔ satellite</div>
            <div className="ws-compare">
              <figure><img src={`/uploads/${selectedPhoto.filename}`} alt="field" /><figcaption>Ground · {selectedPhoto.taken_at || '—'}</figcaption></figure>
              <figure><img src={`/images/${current.image_filename}`} alt="ndvi" /><figcaption>NDVI · {current.observation_date}</figcaption></figure>
            </div>
            {selectedPhoto.caption && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{selectedPhoto.caption}</div>}
          </div>
        )}
      </div>

      {/* Analytics */}
      <div className="ws-analytics">
        <div className="card pad">
          <h3 className="section-title">Land use</h3>
          {landuse ? <LandUseDonut data={landuse.distribution} area={siteGeo?.boundary?.properties?.area_km2} /> : <div className="empty">…</div>}
          <LandcoverSource landuse={landuse} siteId={site.id} onChange={loadLanduse} notify={notify} />
        </div>
        <div className="card pad">
          <h3 className="section-title">Vegetation trend</h3>
          <VegTrend observations={obs} />
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            NDVI {baseline?.ndvi} → {latest?.ndvi} <b style={{ color: t.ndviChangePct >= 0 ? 'var(--improving)' : 'var(--declining)' }}>({t.ndviChangePct > 0 ? '+' : ''}{t.ndviChangePct}%)</b>
          </div>
        </div>
        <div className="card pad">
          <h3 className="section-title">Change detection · {baseline?.observation_date?.slice(0, 4)} → {latest?.observation_date?.slice(0, 4)}</h3>
          <BeforeAfter
            before={`/images/${baseline?.image_filename}`}
            after={`/images/${latest?.image_filename}`}
            beforeLabel={baseline?.observation_date}
            afterLabel={latest?.observation_date}
          />
          <div className="ws-change" style={{ color: t.ndviChangePct >= 0 ? 'var(--improving)' : 'var(--declining)' }}>
            {t.ndviChangePct >= 0 ? '▲' : '▼'} {Math.abs(t.ndviChangePct)}% vegetation
          </div>
        </div>
      </div>

      <div className="ws-actions">
        <a className="btn primary" href={`/api/sites/${site.id}/report`} target="_blank" rel="noreferrer">⬇ Generate report</a>
        <Link className="btn ghost" to={`/sites/${site.id}`}>Full data &amp; uploads →</Link>
      </div>
    </div>
  );
}

function LandUseDonut({ data, area }) {
  return (
    <div className="ws-donut">
      <ResponsiveContainer width="100%" height={168}>
        <PieChart>
          <Pie data={data} dataKey="pct" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v}%`, n]} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e7e1d4' }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="ws-donut-center"><b>{area ?? '—'}</b><span>km²</span></div>
      <ul className="ws-legend">
        {data.map((d) => <li key={d.name}><span style={{ background: d.color }} />{d.name}<b>{d.pct}%</b></li>)}
      </ul>
    </div>
  );
}

const LC_SOURCE_LABEL = { sample: 'Curated sample', worldcover: 'Real · ESA WorldCover', dynamicworld: 'Real · Dynamic World' };

function LandcoverSource({ landuse, siteId, onChange, notify }) {
  const fileRef = useRef(null);
  const [scheme, setScheme] = useState('worldcover');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const src = landuse?.source || 'sample';
  const isReal = src !== 'sample';

  const upload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { notify('Choose a land-cover GeoTIFF first', 'err'); return; }
    const fd = new FormData();
    fd.append('image', file);
    fd.append('scheme', scheme);
    setBusy(true);
    try {
      const r = await api.uploadLandcover(siteId, fd);
      notify(`Land cover classified (${r.source})`);
      if (fileRef.current) fileRef.current.value = '';
      setOpen(false);
      await onChange();
    } catch (err) { notify(err.message, 'err'); } finally { setBusy(false); }
  };
  const revert = async () => {
    try { await api.deleteLandcover(siteId); notify('Reverted to sample land use'); await onChange(); }
    catch (err) { notify(err.message, 'err'); }
  };

  return (
    <div className="lc-source">
      <div className="lc-row">
        <span className={`lc-tag ${isReal ? 'real' : ''}`}>{isReal ? '● ' : '○ '}{LC_SOURCE_LABEL[src]}</span>
        <button className="lc-link" onClick={() => setOpen((o) => !o)}>{open ? 'Cancel' : 'Use real data'}</button>
      </div>
      {open && (
        <form onSubmit={upload} className="lc-form">
          <p className="muted" style={{ fontSize: 11.5, margin: '0 0 8px' }}>
            Upload a land-cover GeoTIFF clipped to this site (single band of class codes).
          </p>
          <input ref={fileRef} type="file" accept=".tif,.tiff,image/tiff" />
          <div className="btn-row" style={{ marginTop: 9 }}>
            <select value={scheme} onChange={(e) => setScheme(e.target.value)}>
              <option value="worldcover">ESA WorldCover</option>
              <option value="dynamicworld">Dynamic World</option>
            </select>
            <button className="btn primary sm" disabled={busy}>{busy ? <span className="spinner" /> : null} Classify</button>
          </div>
        </form>
      )}
      {isReal && !open && <button className="lc-link" onClick={revert} style={{ marginTop: 4 }}>Revert to sample</button>}
    </div>
  );
}

function VegTrend({ observations }) {
  const data = observations.map((o) => ({ date: o.observation_date, NDVI: o.ndvi }));
  return (
    <ResponsiveContainer width="100%" height={130}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="veg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f8f5b" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2f8f5b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip formatter={(v) => [v, 'NDVI']} labelFormatter={(l) => l} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e7e1d4' }} />
        <Area type="monotone" dataKey="NDVI" stroke="#2f8f5b" strokeWidth={2.4} fill="url(#veg)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
