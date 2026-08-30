import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const icon = L.divIcon({
  className: '',
  html: '<div class="pin" style="background:#0d5c75"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Small map: click anywhere to set latitude/longitude.
export default function LocationPicker({ lat, lng, onPick }) {
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
  const center = hasPoint ? [lat, lng] : [22.5, 78.9];
  return (
    <div style={{ height: 220, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8ee' }}>
      <MapContainer center={center} zoom={hasPoint ? 9 : 4} scrollWheelZoom style={{ height: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickHandler onPick={onPick} />
        {hasPoint && <Marker position={[lat, lng]} icon={icon} />}
      </MapContainer>
    </div>
  );
}
