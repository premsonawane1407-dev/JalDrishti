import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import TrendBadge from '../components/TrendBadge.jsx';
import NdviChart from '../components/NdviChart.jsx';

export default function SiteDetailPage() {
  const { id } = useParams();
  const notify = useToast();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedObs, setSelectedObs] = useState(null);
  const [fetchDate, setFetchDate] = useState(new Date().toISOString().slice(0, 10));
  const [fetching, setFetching] = useState(false);

  const load = () =>
    api.getSite(id).then((s) => {
      setSite(s);
      setSelectedObs((prev) =>
        s.observations.find((o) => o.id === prev?.id) || s.observations[s.observations.length - 1] || null
      );
      setLoading(false);
    });

  useEffect(() => { setLoading(true); load().catch((e) => { notify(e.message, 'err'); setLoading(false); }); }, [id]); // eslint-disable-line

  const handleFetch = async () => {
    setFetching(true);
    try {
      const r = await api.fetchObservation(id, fetchDate, true);
      notify(r.cached ? 'Loaded cached observation' : `Fetched observation (NDVI ${r.observation.ndvi})`);
      await load();
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setFetching(false);
    }
  };

  if (loading) return <div className="empty"><span className="spinner" /> Loading site…</div>;
  if (!site) return <div className="card pad empty">Site not found. <Link to="/">Back to map</Link></div>;

  const t = site.trend;

  return (
    <div>
      <Link to="/" className="back-link">← Back to map</Link>

      <div className="page-head">
        <div>
          <h1>{site.name}</h1>
          <p>
            {site.district}, {site.state} · <span className="pill">{site.intervention_type}</span>
            {site.intervention_date ? ` · intervention ${site.intervention_date}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <TrendBadge label={t.label} pct={t.ndviChangePct} />
          <a className="btn primary sm" href={`/api/sites/${site.id}/report`} target="_blank" rel="noopener noreferrer">
            ⬇ Download PDF report
          </a>
        </div>
      </div>

      {site.description && <div className="card pad" style={{ marginBottom: 20 }}><span className="muted">{site.description}</span></div>}

      {/* Trend summary tiles */}
      <div className="stats">
        <Tile label="Baseline NDVI" value={t.baseline?.ndvi ?? '—'} sub={t.baseline?.observation_date} />
        <Tile label="Latest NDVI" value={t.latest?.ndvi ?? '—'} sub={t.latest?.observation_date} />
        <Tile
          label="NDVI change"
          value={t.ndviChangePct == null ? '—' : `${t.ndviChangePct > 0 ? '+' : ''}${t.ndviChangePct}%`}
          className={t.ndviChangePct > 0 ? 'green' : t.ndviChangePct < 0 ? 'red' : 'yellow'}
        />
        <Tile label="Observations" value={site.observations.length} sub={`${site.photos.length} field photos`} />
      </div>

      <div className="grid detail">
        {/* Chart */}
        <div className="card pad">
          <h3 className="section-title">📈 NDVI &amp; NDWI over time</h3>
          <NdviChart observations={site.observations} />
        </div>

        {/* Satellite heatmap */}
        <div className="card pad">
          <h3 className="section-title">🛰 Satellite NDVI heatmap</h3>
          {selectedObs ? (
            <>
              <img className="heatmap" src={`/images/${selectedObs.image_filename}`} alt="NDVI heatmap" />
              <div className="muted" style={{ fontSize: 13, margin: '8px 0' }}>
                {selectedObs.observation_date} · NDVI {selectedObs.ndvi} · NDWI {selectedObs.ndwi} · cloud {selectedObs.cloud_coverage}% · <span className="pill">{selectedObs.source}</span>
              </div>
              <div className="thumb-row">
                {site.observations.map((o) => (
                  <div
                    key={o.id}
                    className={`thumb ${o.id === selectedObs.id ? 'active' : ''}`}
                    onClick={() => setSelectedObs(o)}
                  >
                    <img src={`/images/${o.image_filename}`} alt={o.observation_date} />
                    <small>{o.observation_date.slice(0, 7)}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">No satellite imagery yet — fetch one below.</div>
          )}

          <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Fetch satellite observation</label>
            <div className="btn-row">
              <input type="date" value={fetchDate} onChange={(e) => setFetchDate(e.target.value)} />
              <button className="btn primary" onClick={handleFetch} disabled={fetching}>
                {fetching ? <span className="spinner" /> : '🛰'} Fetch NDVI
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Analyze uploaded satellite imagery (GeoTIFF) */}
      <div className="card pad" style={{ marginTop: 20 }}>
        <h3 className="section-title">🧮 Analyze your own satellite image (GeoTIFF)</h3>
        <ImageryAnalysis site={site} onChange={load} notify={notify} />
      </div>

      {/* Photo timeline */}
      <div className="card pad" style={{ marginTop: 20 }}>
        <h3 className="section-title">📷 Field photo timeline</h3>
        <PhotoTimeline site={site} onChange={load} notify={notify} />
      </div>
    </div>
  );
}

function Tile({ label, value, sub, className = 'brand' }) {
  return (
    <div className={`stat ${className}`}>
      <div className="n">{value}</div>
      <div className="l">{label}{sub ? <><br /><span className="muted" style={{ fontSize: 11 }}>{sub}</span></> : null}</div>
    </div>
  );
}

function ImageryAnalysis({ site, onChange, notify }) {
  const fileRef = useRef(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [redBand, setRedBand] = useState('1');
  const [nirBand, setNirBand] = useState('2');
  const [greenBand, setGreenBand] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const analyze = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { notify('Choose a GeoTIFF (.tif) first', 'err'); return; }
    const fd = new FormData();
    fd.append('image', file);
    fd.append('date', date);
    fd.append('redBand', redBand);
    fd.append('nirBand', nirBand);
    if (greenBand) fd.append('greenBand', greenBand);
    setBusy(true);
    try {
      const r = await api.analyzeImagery(site.id, fd);
      setResult(r.analysis);
      notify(`Analyzed: NDVI ${r.observation.ndvi}`);
      if (fileRef.current) fileRef.current.value = '';
      await onChange();
    } catch (err) {
      notify(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Upload a Sentinel-2 / Landsat GeoTIFF and the platform computes NDVI (and NDWI) directly from its
        bands — no GIS software needed. The result is added to this site's time-series, chart and report.
      </p>
      <form onSubmit={analyze} className="card pad" style={{ background: '#fafcfd' }}>
        <div className="form-grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <div className="field">
            <label>GeoTIFF file (.tif / .tiff)</label>
            <input ref={fileRef} type="file" accept=".tif,.tiff,image/tiff" />
          </div>
          <div className="field">
            <label>Observation date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12 }}>
          <div className="field"><label>Red band #</label><input value={redBand} onChange={(e) => setRedBand(e.target.value)} inputMode="numeric" /></div>
          <div className="field"><label>NIR band #</label><input value={nirBand} onChange={(e) => setNirBand(e.target.value)} inputMode="numeric" /></div>
          <div className="field"><label>Green band # (optional)</label><input value={greenBand} onChange={(e) => setGreenBand(e.target.value)} placeholder="for NDWI" inputMode="numeric" /></div>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>
          Band numbers are 1-based. Red+NIR file → Red 1, NIR 2. A 4-band RGBN → Red 3, NIR 4. A single-band
          file is treated as ready-made NDVI.
        </p>
        <div style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : '🧮'} Analyze image</button>
        </div>
      </form>
      {result && (
        <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          Last analysis: {result.width}×{result.height}px, {result.bands} band(s) → NDVI <b>{result.ndvi}</b>
          {result.ndwi != null ? <> · NDWI <b>{result.ndwi}</b></> : ''}. See the updated chart &amp; heatmap above.
        </div>
      )}
    </>
  );
}

function PhotoTimeline({ site, onChange, notify }) {
  const fileRef = useRef(null);
  const [caption, setCaption] = useState('');
  const [takenAt, setTakenAt] = useState('');
  const [uploading, setUploading] = useState(false);

  const upload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { notify('Choose an image first', 'err'); return; }
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('caption', caption);
    if (takenAt) fd.append('taken_at', takenAt);
    setUploading(true);
    try {
      const r = await api.uploadPhoto(site.id, fd);
      notify(`Photo uploaded (GPS: ${r.gpsSource})`);
      setCaption(''); setTakenAt('');
      if (fileRef.current) fileRef.current.value = '';
      await onChange();
    } catch (err) {
      notify(err.message, 'err');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (photo) => {
    if (!window.confirm('Delete this photo?')) return;
    try { await api.deletePhoto(photo.id); notify('Photo deleted'); await onChange(); }
    catch (e) { notify(e.message, 'err'); }
  };

  return (
    <>
      <form onSubmit={upload} className="card pad" style={{ marginBottom: 16, background: '#fafcfd' }}>
        <div className="form-grid" style={{ gridTemplateColumns: '1.4fr 1fr auto' }}>
          <div className="field">
            <label>Photo file</label>
            <input ref={fileRef} type="file" accept="image/*" />
          </div>
          <div className="field">
            <label>Caption</label>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Check-dam after monsoon" />
          </div>
          <div className="field">
            <label>Date (optional)</label>
            <input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>
          GPS is auto-read from photo EXIF when present; otherwise the site's coordinates are used.
        </p>
        <div style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={uploading}>
            {uploading ? <span className="spinner" /> : null} Upload photo
          </button>
        </div>
      </form>

      {site.photos.length === 0 ? (
        <div className="empty">No field photos yet.</div>
      ) : (
        <div className="photo-grid">
          {site.photos.map((p) => (
            <div className="photo-card" key={p.id}>
              <img src={`/uploads/${p.filename}`} alt={p.caption || 'field photo'} />
              <div className="cap">{p.caption || <span className="muted">No caption</span>}</div>
              <div className="date">
                {p.taken_at || '—'}
                {Number.isFinite(p.latitude) && ` · ${p.latitude.toFixed(3)}, ${p.longitude.toFixed(3)}`}
              </div>
              <button className="btn danger sm" style={{ marginTop: 6 }} onClick={() => remove(p)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
