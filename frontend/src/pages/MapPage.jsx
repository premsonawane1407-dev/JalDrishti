import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
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

  const counts = sites.reduce((a, s) => { a[s.trend.label] = (a[s.trend.label] || 0) + 1; return a; }, {});

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Watershed sites</h1>
          <p>Field-verified interventions monitored against Sentinel-2 vegetation &amp; water indices.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat brand"><div className="n">{sites.length}</div><div className="l">Sites monitored</div></div>
        <div className="stat green"><div className="n">{counts.Improving || 0}</div><div className="l">Improving</div></div>
        <div className="stat yellow"><div className="n">{counts.Stable || 0}</div><div className="l">Stable</div></div>
        <div className="stat red"><div className="n">{counts.Declining || 0}</div><div className="l">Declining</div></div>
      </div>

      {geo && (
        <div className="stats">
          <div className="stat brand"><div className="n">{geo.summary.watershedAreaKm2}<small className="unit"> km²</small></div><div className="l">Watershed area (catchments)</div></div>
          <div className="stat brand"><div className="n">{geo.summary.waterBodies}</div><div className="l">Water bodies · {geo.summary.waterBodyAreaHa} ha</div></div>
          <div className="stat brand"><div className="n">{geo.summary.drainageKm}<small className="unit"> km</small></div><div className="l">Drainage · {geo.summary.streamSegments} segments</div></div>
          <div className="stat brand"><div className="n">{geo.summary.structures}</div><div className="l">Conservation structures</div></div>
        </div>
      )}

      {loading ? (
        <div className="empty"><span className="spinner" /> Loading map…</div>
      ) : sites.length === 0 ? (
        <div className="card pad empty">
          No sites yet. <Link to="/sites">Add your first watershed site →</Link>
        </div>
      ) : (
        <>
          <MapView sites={sites} geo={geo} externalLayers={externalLayers} />

          <div className="card" style={{ marginTop: 20, overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Site</th><th>District</th><th>Intervention</th>
                  <th>Latest NDVI</th><th>Trend</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={`/sites/${s.id}`}><strong>{s.name}</strong></Link></td>
                    <td>{s.district}, {s.state}</td>
                    <td><span className="pill">{s.intervention_type}</span></td>
                    <td>{s.latestNdvi ?? '—'}</td>
                    <td><TrendBadge label={s.trend.label} pct={s.trend.ndviChangePct} /></td>
                    <td><Link to={`/sites/${s.id}`}>Details →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
