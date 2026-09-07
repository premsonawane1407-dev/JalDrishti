import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function GalleryPage() {
  const [photos, setPhotos] = useState(null);

  useEffect(() => { api.allPhotos().then(setPhotos).catch(() => setPhotos([])); }, []);

  return (
    <div>
      <div className="page-head reveal">
        <div>
          <h1>Field images</h1>
          <p>Every geo-tagged field photograph across the programme, newest first. Each links back to its watershed.</p>
        </div>
      </div>

      {!photos ? (
        <div className="loader"><span className="spinner" /> Loading images…</div>
      ) : photos.length === 0 ? (
        <div className="card pad empty">No field photos uploaded yet.</div>
      ) : (
        <div className="gallery-grid reveal">
          {photos.map((p) => (
            <Link className="gallery-card" to={`/sites/${p.site_id}/explore`} key={p.id}>
              <img src={`/uploads/${p.filename}`} alt={p.caption || 'field photo'} />
              <div className="gc-body">
                <div className="gc-site">{p.site_name}</div>
                <div className="gc-cap">{p.caption || <span className="muted">No caption</span>}</div>
                <div className="gc-meta">
                  <span>{p.taken_at || '—'}</span>
                  {Number.isFinite(p.latitude) && <span>{p.latitude.toFixed(3)}, {p.longitude.toFixed(3)}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
