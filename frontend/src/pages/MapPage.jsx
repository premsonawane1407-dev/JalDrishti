import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, TREND_COLORS } from '../api.js';
import MapView from '../components/MapView.jsx';
import TrendBadge from '../components/TrendBadge.jsx';

export default function MapPage() {
  const [sites, setSites] = useState([]);
  const [geo, setGeo] = useState(null);
  const [externalLayers, setExternalLayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listSites().then((s) => { setSites(s); setLoading(false); }).catch(() => setLoading(false));
    api.geo().then(setGeo).catch(() => setGeo(null));
    api.config().then((c) => setExternalLayers(c.externalLayers || [])).catch(() => setExternalLayers([]));
  }, []);

  return (
    <div>
      <div className="page-head reveal">
        <div>
          <h1>Watershed atlas</h1>
          <p>Field-verified interventions read against Sentinel-2 vegetation &amp; water indices. Explore the catchments, then click anywhere to assess a location.</p>
        </div>
      </div>

      {loading ? (
        <div className="loader"><span className="spinner" /> Composing the map…</div>
      ) : sites.length === 0 ? (
        <div className="card pad empty">No sites yet. <Link to="/sites">Add your first watershed site →</Link></div>
      ) : (
        <>
          <div className="map-stage reveal">
            <MapView sites={sites} geo={geo} externalLayers={externalLayers} />
          </div>

          <div className="section-head">
            <h2>All sites</h2>
            <span className="muted">{sites.length} monitored</span>
          </div>
          <div className="site-list">
            {sites.map((s) => (
              <Link className="site-row" to={`/sites/${s.id}/explore`} key={s.id}>
                <span className="tick" style={{ background: TREND_COLORS[s.trend.color] }} />
                <div>
                  <div className="name">{s.name}</div>
                  <div className="sub">{s.district}{s.state ? `, ${s.state}` : ''} · {s.intervention_type}</div>
                </div>
                <TrendBadge label={s.trend.label} pct={s.trend.ndviChangePct} />
                <div className="ndvi">
                  <div className="v">{s.latestNdvi ?? '—'}</div>
                  <div className="k">LATEST NDVI</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
