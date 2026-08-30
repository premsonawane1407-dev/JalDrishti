import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { TREND_COLORS } from '../api.js';
import TrendBadge from './TrendBadge.jsx';

function pinIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div class="pin" style="background:${color}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  useMemo(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [map, points]);
  return null;
}

export default function MapView({ sites }) {
  const points = sites.map((s) => [s.latitude, s.longitude]);
  const center = points[0] || [22.5, 78.9]; // India centroid fallback

  return (
    <div className="map-wrap">
      <MapContainer center={center} zoom={5} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {sites.map((s) => (
          <Marker key={s.id} position={[s.latitude, s.longitude]} icon={pinIcon(TREND_COLORS[s.trend.color])}>
            <Popup>
              <div className="map-popup">
                <h4>{s.name}</h4>
                <div className="meta">
                  {s.district}, {s.state} · {s.intervention_type}
                </div>
                <TrendBadge label={s.trend.label} pct={s.trend.ndviChangePct} />
                <div style={{ marginTop: 8 }}>
                  <Link to={`/sites/${s.id}`}>View details →</Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: 'none' }}>
          <div className="leaflet-control legend" style={{ margin: 12 }}>
            <div className="row"><span className="swatch" style={{ background: TREND_COLORS.green }} />Improving</div>
            <div className="row"><span className="swatch" style={{ background: TREND_COLORS.yellow }} />Stable</div>
            <div className="row"><span className="swatch" style={{ background: TREND_COLORS.red }} />Declining</div>
          </div>
        </div>
      </MapContainer>
    </div>
  );
}
