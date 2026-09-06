import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer, TileLayer, WMSTileLayer, Marker, Popup, GeoJSON, LayersControl,
  LayerGroup, CircleMarker, useMap, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import * as turf from '@turf/turf';
import { TREND_COLORS } from '../api.js';
import TrendBadge from './TrendBadge.jsx';

const { BaseLayer, Overlay } = LayersControl;

function pinIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div class="pin" style="background:${color}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });
}

// Leaflet initialises with the wrong size when its container isn't laid out yet
// (e.g. below the fold / inside a grid). Force a resize once mounted + on load.
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
    else map.fitBounds(points, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

// Click anywhere → Turf spatial analysis: which watershed, nearest water body,
// nearest drainage line. Mirrors a GIS "assess surrounding resources" tool.
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
          const d = toGeom(f);
          if (!best || d.km < best.km) best = { km: d.km, name: f.properties.name };
        }
        return best;
      };
      const nearestWater = nearest(layers.waterbodies.features, (f) => ({
        km: turf.distance(pt, turf.centroid(f), { units: 'kilometers' }),
      }));
      const nearestStream = nearest(layers.streams.features, (f) => ({
        km: turf.nearestPointOnLine(f, pt, { units: 'kilometers' }).properties.dist,
      }));

      onResult({
        latlng: e.latlng,
        watershed,
        water: nearestWater,
        stream: nearestStream,
      });
    },
  });
  return null;
}

const boundaryStyle = { color: '#0d5c75', weight: 2, dashArray: '6 5', fillColor: '#0d5c75', fillOpacity: 0.06 };
const streamStyle = (f) => ({ color: '#2c7fb8', weight: f.properties.order >= 3 ? 3 : 1.6, opacity: 0.85 });
const waterStyle = { color: '#1f6feb', weight: 1, fillColor: '#3b9ae1', fillOpacity: 0.55 };

function ExternalTile({ layer }) {
  if (layer.type === 'wms') {
    return (
      <WMSTileLayer
        url={layer.url}
        layers={layer.layers}
        format="image/png"
        transparent={layer.kind === 'overlay'}
        attribution={layer.attribution}
      />
    );
  }
  return <TileLayer url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom || 19} />;
}

export default function MapView({ sites, geo, externalLayers = [] }) {
  const [assessment, setAssessment] = useState(null);
  const extBase = externalLayers.filter((l) => l.kind === 'base');
  const extOverlay = externalLayers.filter((l) => l.kind === 'overlay');
  const points = sites.map((s) => [s.latitude, s.longitude]);
  const center = points[0] || [22.5, 78.9];

  return (
    <div className="map-wrap">
      <MapContainer center={center} zoom={6} scrollWheelZoom>
        <SizeFix />
        <FitBounds points={points} />

        <LayersControl position="topright">
          <BaseLayer checked name="Satellite">
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </BaseLayer>
          <BaseLayer name="Terrain">
            <TileLayer
              attribution="&copy; OpenTopoMap (CC-BY-SA)"
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxZoom={17}
            />
          </BaseLayer>
          <BaseLayer name="Street">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>
          <BaseLayer name="Dark GIS">
            <TileLayer
              attribution="&copy; OpenStreetMap, &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </BaseLayer>
          {extBase.map((l) => (
            <BaseLayer key={l.id} name={l.name}>
              <ExternalTile layer={l} />
            </BaseLayer>
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
                <GeoJSON
                  data={geo.waterbodies}
                  style={waterStyle}
                  onEachFeature={(f, layer) =>
                    layer.bindPopup(`<b>${f.properties.name}</b><br/>${f.properties.area_ha} ha`)
                  }
                />
              </Overlay>
              <Overlay name="Structures">
                <GeoJSON
                  data={{
                    type: 'FeatureCollection',
                    features: geo.structures.features.filter((f) => !f.properties.primary),
                  }}
                  pointToLayer={(f, latlng) =>
                    L.circleMarker(latlng, { radius: 5, color: '#fff', weight: 1.5, fillColor: '#e07b00', fillOpacity: 1 })
                      .bindPopup(`<b>${f.properties.name}</b><br/>${f.properties.structure_type}`)
                  }
                />
              </Overlay>
            </>
          )}

          <Overlay checked name="Watershed sites">
            <SitesLayer sites={sites} />
          </Overlay>

          {extOverlay.map((l) => (
            <Overlay key={l.id} name={l.name}>
              <ExternalTile layer={l} />
            </Overlay>
          ))}
        </LayersControl>

        <ClickAssess layers={geo} onResult={setAssessment} />
        {assessment && <Marker position={assessment.latlng} icon={pinIcon('#111')} />}
      </MapContainer>

      {assessment && (
        <div className="assess-panel">
          <button className="assess-close" onClick={() => setAssessment(null)} aria-label="Close">×</button>
          <div className="assess-title">📍 Location assessment</div>
          <div className="assess-coord">
            {assessment.latlng.lat.toFixed(4)}°, {assessment.latlng.lng.toFixed(4)}°
          </div>
          <div className="assess-row">
            <span>Watershed</span>
            <b>{assessment.watershed || 'Outside mapped catchments'}</b>
          </div>
          <div className="assess-row">
            <span>Nearest water body</span>
            <b>{assessment.water ? fmt(assessment.water.km) : '—'}</b>
          </div>
          <div className="assess-row">
            <span>Nearest drainage</span>
            <b>{assessment.stream ? fmt(assessment.stream.km) : '—'}</b>
          </div>
        </div>
      )}

      <div className="legend map-legend">
        <div className="row"><span className="swatch" style={{ background: TREND_COLORS.green }} />Improving</div>
        <div className="row"><span className="swatch" style={{ background: TREND_COLORS.yellow }} />Stable</div>
        <div className="row"><span className="swatch" style={{ background: TREND_COLORS.red }} />Declining</div>
        <div className="row" style={{ marginTop: 4, fontSize: 11, color: '#5b6b78' }}>Click the map to assess a point</div>
      </div>
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
              <div style={{ marginTop: 8 }}>
                <Link to={`/sites/${s.id}`}>View details →</Link>
              </div>
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
