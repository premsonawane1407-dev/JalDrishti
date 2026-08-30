import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { api, TREND_COLORS } from '../api.js';
import TrendBadge from '../components/TrendBadge.jsx';

const COLORS = { Improving: TREND_COLORS.green, Stable: TREND_COLORS.yellow, Declining: TREND_COLORS.red };

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ district: '', intervention_type: '', from: '', to: '' });
  const [opts, setOpts] = useState({ districts: [], interventionTypes: [] });

  const load = (f) => api.dashboard(f).then((d) => { setData(d); setOpts(d.filterOptions); });
  useEffect(() => { load(filters); }, []); // eslint-disable-line

  const apply = (next) => { setFilters(next); load(next); };
  const set = (k) => (e) => apply({ ...filters, [k]: e.target.value });
  const reset = () => apply({ district: '', intervention_type: '', from: '', to: '' });

  if (!data) return <div className="empty"><span className="spinner" /> Loading dashboard…</div>;

  const c = data.counts;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Program dashboard</h1>
          <p>District &amp; program-level watershed outcomes at a glance.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card pad" style={{ marginBottom: 20 }}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="field">
            <label>District</label>
            <select value={filters.district} onChange={set('district')}>
              <option value="">All</option>
              {opts.districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Intervention type</label>
            <select value={filters.intervention_type} onChange={set('intervention_type')}>
              <option value="">All</option>
              {opts.interventionTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Intervention from</label>
            <input type="date" value={filters.from} onChange={set('from')} />
          </div>
          <div className="field">
            <label>Intervention to</label>
            <input type="date" value={filters.to} onChange={set('to')} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn ghost sm" onClick={reset}>Reset filters</button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="stats">
        <div className="stat brand"><div className="n">{data.totals.sites}</div><div className="l">Sites in view</div></div>
        <div className="stat green"><div className="n">{c.Improving}</div><div className="l">Improving</div></div>
        <div className="stat yellow"><div className="n">{c.Stable}</div><div className="l">Stable</div></div>
        <div className="stat red"><div className="n">{c.Declining}</div><div className="l">Declining</div></div>
        <div className="stat brand"><div className="n">{data.totals.avgLatestNdvi ?? '—'}</div><div className="l">Avg latest NDVI</div></div>
      </div>

      <div className="grid two">
        <div className="card pad">
          <h3 className="section-title">Outcomes by district</h3>
          <StackedBar rows={data.byDistrict} />
        </div>
        <div className="card pad">
          <h3 className="section-title">Outcomes by intervention type</h3>
          <StackedBar rows={data.byType} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 20, overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr><th>Site</th><th>District</th><th>Intervention</th><th>Latest NDVI</th><th>Trend</th></tr>
          </thead>
          <tbody>
            {data.sites.map((s) => (
              <tr key={s.id}>
                <td><Link to={`/sites/${s.id}`}><strong>{s.name}</strong></Link></td>
                <td>{s.district}</td>
                <td><span className="pill">{s.intervention_type}</span></td>
                <td>{s.latestNdvi ?? '—'}</td>
                <td><TrendBadge label={s.trend} pct={s.ndviChangePct} /></td>
              </tr>
            ))}
            {data.sites.length === 0 && (
              <tr><td colSpan={5} className="empty">No sites match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StackedBar({ rows }) {
  if (!rows || rows.length === 0) return <div className="empty">No data.</div>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5b6b78' }} interval={0} angle={-12} textAnchor="end" height={50} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5b6b78' }} />
        <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e2e8ee' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Improving" stackId="a" fill={COLORS.Improving} />
        <Bar dataKey="Stable" stackId="a" fill={COLORS.Stable} />
        <Bar dataKey="Declining" stackId="a" fill={COLORS.Declining} />
      </BarChart>
    </ResponsiveContainer>
  );
}
