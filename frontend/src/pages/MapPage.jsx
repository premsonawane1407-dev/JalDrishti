import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, TREND_COLORS } from '../api.js';
import MapView from '../components/MapView.jsx';
import TrendBadge from '../components/TrendBadge.jsx';

const ACT_ICON = { camera: '📷', leaf: '🌿', pin: '📍', plus: '✚' };

export default function MapPage() {
  const [sites, setSites] = useState([]);
  const [geo, setGeo] = useState(null);
  const [externalLayers, setExternalLayers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listSites().then((s) => { setSites(s); setLoading(false); }).catch(() => setLoading(false));
    api.geo().then(setGeo).catch(() => setGeo(null));
    api.config().then((c) => setExternalLayers(c.externalLayers || [])).catch(() => setExternalLayers([]));
    api.activity(12).then(setActivity).catch(() => setActivity([]));
  }, []);

  const regions = useMemo(() => [...new Set(sites.map((s) => s.state).filter(Boolean))].sort(), [sites]);
  const shown = region ? sites.filter((s) => s.state === region) : sites;
  const shownIds = useMemo(() => new Set(shown.map((s) => s.id)), [shown]);
  const fgeo = useMemo(() => filterGeo(geo, shownIds), [geo, shownIds]);

  return (
    <div>
      <div className="page-head reveal">
        <div>
          <h1>Watershed atlas</h1>
          <p>Field-verified interventions read against Sentinel-2 vegetation &amp; water indices. Explore the catchments, then click anywhere to assess a location.</p>
        </div>
        {regions.length > 0 && (
          <label className="region-pick">
            <span>📍</span>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">All regions</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <div className="loader"><span className="spinner" /> Composing the map…</div>
      ) : sites.length === 0 ? (
        <div className="card pad empty">No sites yet. <Link to="/sites">Add your first watershed site →</Link></div>
      ) : (
        <>
          <div className="map-stage reveal">
            <MapView sites={shown} geo={fgeo} externalLayers={externalLayers} />
          </div>

          <div className="atlas-lower">
            <div>
              <div className="section-head">
                <h2>Watersheds</h2>
                <span className="muted">{shown.length}{region ? ` in ${region}` : ' monitored'}</span>
              </div>
              <div className="site-list">
                {shown.map((s) => (
                  <Link className="site-row" to={`/sites/${s.id}/explore`} key={s.id}>
                    <span className="tick" style={{ background: TREND_COLORS[s.trend.color] }} />
                    <div>
                      <div className="name">{s.name}</div>
                      <div className="sub">{s.district}{s.state ? `, ${s.state}` : ''} · {s.intervention_type}</div>
                    </div>
                    <TrendBadge label={s.trend.label} pct={s.trend.ndviChangePct} />
                    <div className="ndvi"><div className="v">{s.latestNdvi ?? '—'}</div><div className="k">LATEST NDVI</div></div>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="section-head"><h2>Recent activity</h2></div>
              <div className="activity">
                {activity.length === 0 ? (
                  <div className="empty" style={{ padding: 24 }}>No activity yet.</div>
                ) : activity.map((a, i) => (
                  <Link className="act-item" to={`/sites/${a.site_id}/explore`} key={i}>
                    <span className={`act-icon ${a.type}`}>{ACT_ICON[a.icon] || '•'}</span>
                    <div className="act-body">
                      <div className="act-title">{a.title}</div>
                      <div className="act-sub">{a.sub}</div>
                    </div>
                    <div className="act-date">{a.date}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function filterGeo(geo, ids) {
  if (!geo) return null;
  const pick = (fc) => ({ type: 'FeatureCollection', features: fc.features.filter((f) => ids.has(f.properties.site_id)) });
  const w = pick(geo.watersheds), s = pick(geo.streams), wb = pick(geo.waterbodies), st = pick(geo.structures);
  const r1 = (n) => Math.round(n * 10) / 10;
  return {
    watersheds: w, streams: s, waterbodies: wb, structures: st,
    summary: {
      watershedAreaKm2: r1(w.features.reduce((a, f) => a + (f.properties.area_km2 || 0), 0)),
      waterBodies: wb.features.length,
      waterBodyAreaHa: r1(wb.features.reduce((a, f) => a + (f.properties.area_ha || 0), 0)),
      streamSegments: s.features.length,
      drainageKm: r1(s.features.reduce((a, f) => a + (f.properties.length_km || 0), 0)),
      structures: st.features.length,
    },
  };
}
