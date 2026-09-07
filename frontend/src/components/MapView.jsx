import { useEffect, useMemo, useState } from 'react';
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

function pinIcon(color, assess = false) {
  return L.divIcon({
    className: '',
    html: `<div class="pin${assess ? ' pin-assess' : ''}" style="background:${color}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

// Leaflet mis-sizes when its container isn't laid out yet — force a resize.
function SizeFix() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t = setTimeout(fix, 200);
    map.whenReady(fix);
    window.addEventListener('resize', fix);
    return () => { clearTimeout(t); window.removeEventListener('resize', fix); };
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

// Click anywhere → Turf spatial analysis (containing watershed, nearest water/drainage).
function ClickAssess({ layers, onResult }) {
  useMapEvents({
    click(e) {
      if (!layers) return;
      const pt = turf.point([e.latlng.lng, e.latlng.lat]);
      let watershed = null;
      for (const f of layers.watersheds.features) {
        if (turf.booleanPointInPolygon(pt, f)) { watershed = f.properties.name; break; }
      }
      const nearest = (features, toGeom) => {
        let best = null;
        for (const f of features) {
          const km = toGeom(f);
          if (!best || km < best.km) best = { km, name: f.properties.name };
        }
        return best;
      };
      const water = nearest(layers.waterbodies.features, (f) => turf.distance(pt, turf.centroid(f), { units: 'kilometers' }));
      const stream = nearest(layers.streams.features, (f) => turf.nearestPointOnLine(f, pt, { units: 'kilometers' }).properties.dist);
      onResult({ latlng: e.latlng, watershed, water, stream });
    },
  });
  return null;
}

const boundaryStyle = { color: '#0e7b84', weight: 2.2, dashArray: '2 7', lineCap: 'round', fillColor: '#0e7b84', fillOpacity: 0.07 };
const streamStyle = (f) => ({ color: '#2c8fb8', weight: f.properties.order >= 3 ? 3 : 1.5, opacity: 0.9 });
const waterStyle = { color: '#1f7fa8', weight: 1, fillColor: '#3aa0c9', fillOpacity: 0.5 };

function ExternalTile({ layer }) {
  if (layer.type === 'wms') {
    return <WMSTileLayer url={layer.url} layers={layer.layers} format="image/png" transparent={layer.kind === 'overlay'} attribution={layer.attribution} />;
  }
  return <TileLayer url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom || 19} />;
}

export default function MapView({ sites, geo, externalLayers = [] }) {
  const [assessment, setAssessment] = useState(null);
  const points = sites.map((s) => [s.latitude, s.longitude]);
  const center = points[0] || [22.5, 78.9];
  const extBase = externalLayers.filter((l) => l.kind === 'base');
  const extOverlay = externalLayers.filter((l) => l.kind === 'overlay');

  const counts = sites.reduce((a, s) => { a[s.trend.label] = (a[s.trend.label] || 0) + 1; return a; }, {});
  const sum = geo?.summary;

  return (
    <div className="map-wrap">
      <MapContainer center={center} zoom={6} scrollWheelZoom zoomControl={false}>
        <SizeFix />
        <FitBounds points={points} />
        <ZoomControl position="bottomright" />

        <LayersControl position="topright">
          <BaseLayer checked name="Satellite">
            <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
          </BaseLayer>
          <BaseLayer name="Terrain">
            <TileLayer attribution="&copy; OpenTopoMap (CC-BY-SA)" url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" maxZoom={17} />
          </BaseLayer>
          <BaseLayer name="Street">
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </BaseLayer>
          <BaseLayer name="Dark GIS">
            <TileLayer attribution="&copy; OpenStreetMap, &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          </BaseLayer>
          {extBase.map((l) => (
            <BaseLayer key={l.id} name={l.name}><ExternalTile layer={l} /></BaseLayer>
          ))}

          {geo && (
            <>
              <Overlay checked name={`Watershed boundary (${geo.watersheds.features.length})`}>
                <GeoJSON data={geo.watersheds} style={boundaryStyle} />
              </Overlay>
              <Overlay checked name={`Streams / drainage (${geo.streams.features.length})`}>
                <GeoJSON data={geo.streams} style={streamStyle} />
              </Overlay>
              <Overlay checked name={`Water bodies (${geo.waterbodies.features.length})`}>
                <GeoJSON data={geo.waterbodies} style={waterStyle}
                  onEachFeature={(f, layer) => layer.bindPopup(`<b>${f.properties.name}</b><br/>${f.properties.area_ha} ha`)} />
              </Overlay>
              <Overlay name="Structures">
                <GeoJSON
                  data={{ type: 'FeatureCollection', features: geo.structures.features.filter((f) => !f.properties.primary) }}
                  pointToLayer={(f, latlng) => L.circleMarker(latlng, { radius: 5, color: '#fffdf8', weight: 1.5, fillColor: '#b56445', fillOpacity: 1 })
                    .bindPopup(`<b>${f.properties.name}</b><br/>${f.properties.structure_type}`)} />
              </Overlay>
            </>
          )}

          <Overlay checked name="Watershed sites">
            <SitesLayer sites={sites} />
          </Overlay>
          {extOverlay.map((l) => (
            <Overlay key={l.id} name={l.name}><ExternalTile layer={l} /></Overlay>
          ))}
        </LayersControl>

        <ClickAssess layers={geo} onResult={setAssessment} />
        {assessment && <Marker position={assessment.latlng} icon={pinIcon('#17241d', true)} />}
      </MapContainer>

      {/* Floating glass summary (hero) */}
      <div className="map-panel hero-summary">
        <div className="eyebrow">Watershed programme</div>
        <div className="big">{sites.length}<small> sites</small></div>
        <div className="hero-legend">
          <div className="row"><span className="swatch" style={{ background: TREND_COLORS.green }} />Improving<span className="c">{counts.Improving || 0}</span></div>
          <div className="row"><span className="swatch" style={{ background: TREND_COLORS.yellow }} />Stable<span className="c">{counts.Stable || 0}</span></div>
          <div className="row"><span className="swatch" style={{ background: TREND_COLORS.red }} />Declining<span className="c">{counts.Declining || 0}</span></div>
        </div>
        {sum && (
          <div className="hero-metrics">
            <div className="m"><div className="v">{sum.watershedAreaKm2}<span style={{ fontSize: 11 }}> km²</span></div><div className="k">Catchment area</div></div>
            <div className="m"><div className="v">{sum.drainageKm}<span style={{ fontSize: 11 }}> km</span></div><div className="k">Drainage</div></div>
            <div className="m"><div className="v">{sum.waterBodies}</div><div className="k">Water bodies</div></div>
            <div className="m"><div className="v">{sum.structures}</div><div className="k">Structures</div></div>
          </div>
        )}
      </div>

      {!assessment && (
        <div className="hero-hint"><span className="ping" /> Click anywhere on the map to assess a location</div>
      )}

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

function SitesLayer({ sites }) {
  return (
    <LayerGroup>
      {sites.map((s) => (
        <Marker key={s.id} position={[s.latitude, s.longitude]} icon={pinIcon(TREND_COLORS[s.trend.color])}>
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

function fmt(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}
