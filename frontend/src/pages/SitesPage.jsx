import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import SiteForm from '../components/SiteForm.jsx';
import TrendBadge from '../components/TrendBadge.jsx';

export default function SitesPage() {
  const notify = useToast();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | {mode:'create'} | {mode:'edit', site}
  const [submitting, setSubmitting] = useState(false);

  const load = () => api.listSites().then((s) => { setSites(s); setLoading(false); });
  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (modal.mode === 'edit') {
        await api.updateSite(modal.site.id, data);
        notify('Site updated');
      } else {
        await api.createSite(data);
        notify('Site created');
      }
      setModal(null);
      await load();
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (site) => {
    if (!window.confirm(`Delete "${site.name}" and all its photos & observations?`)) return;
    try {
      await api.deleteSite(site.id);
      notify('Site deleted');
      await load();
    } catch (e) {
      notify(e.message, 'err');
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Manage sites</h1>
          <p>Register and edit watershed intervention sites.</p>
        </div>
        <button className="btn primary" onClick={() => setModal({ mode: 'create' })}>+ New site</button>
      </div>

      {loading ? (
        <div className="empty"><span className="spinner" /> Loading…</div>
      ) : sites.length === 0 ? (
        <div className="card pad empty">No sites yet — create one to get started.</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th><th>District</th><th>Type</th><th>Coordinates</th>
                <th>Intervention date</th><th>Trend</th><th></th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/sites/${s.id}`}><strong>{s.name}</strong></Link></td>
                  <td>{s.district}, {s.state}</td>
                  <td><span className="pill">{s.intervention_type}</span></td>
                  <td className="muted">{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</td>
                  <td>{s.intervention_date || '—'}</td>
                  <td><TrendBadge label={s.trend.label} pct={s.trend.ndviChangePct} /></td>
                  <td>
                    <div className="btn-row">
                      <button className="btn ghost sm" onClick={() => setModal({ mode: 'edit', site: s })}>Edit</button>
                      <button className="btn danger sm" onClick={() => handleDelete(s)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h2>{modal.mode === 'edit' ? 'Edit site' : 'New watershed site'}</h2>
            <SiteForm
              initial={modal.mode === 'edit' ? modal.site : null}
              onSubmit={handleSubmit}
              onCancel={() => setModal(null)}
              submitting={submitting}
            />
          </div>
        </div>
      )}
    </div>
  );
}
