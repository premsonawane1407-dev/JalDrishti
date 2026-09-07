import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';

const I = {
  atlas: 'M12 2 3 7l9 5 9-5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5',
  water: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M9 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  pin: 'M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  leaf: 'M5 21c0-8 5-14 14-15 1 8-4 15-14 15zM8 18c3-5 6-8 10-9',
  drainage: 'M3 6h6l3 6h9M3 12h4M3 18h11',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
};

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const GROUPS = [
  { items: [{ to: '/', lens: 'trend', label: 'Atlas', icon: 'atlas' }] },
  {
    label: 'Explore',
    items: [
      { to: '/sites', label: 'Watersheds', icon: 'water' },
      { to: '/gallery', label: 'Field images', icon: 'image' },
    ],
  },
  {
    label: 'Analyze',
    items: [
      { to: '/?lens=vegetation', lens: 'vegetation', label: 'Vegetation', icon: 'leaf' },
      { to: '/?lens=water', lens: 'water', label: 'Water bodies', icon: 'drop' },
      { to: '/?lens=drainage', lens: 'drainage', label: 'Drainage', icon: 'drainage' },
      { to: '/?lens=landuse', lens: 'landuse', label: 'Land use', icon: 'grid' },
    ],
  },
  { label: 'Insights', items: [{ to: '/dashboard', label: 'Program dashboard', icon: 'chart' }] },
];

export default function Sidebar({ open, onNavigate }) {
  const [mode, setMode] = useState(null);
  const loc = useLocation();
  useEffect(() => { api.mode().then(setMode).catch(() => setMode({ live: false })); }, []);

  const onAtlas = loc.pathname === '/';
  const curLens = new URLSearchParams(loc.search).get('lens') || 'trend';
  const isActive = (it) => {
    if (it.lens !== undefined) return onAtlas && curLens === it.lens;
    return it.to === '/' ? loc.pathname === '/' : (loc.pathname === it.to || loc.pathname.startsWith(it.to + '/'));
  };

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sb-brand">
        <span className="drop">💧</span>
        <span><b>JalDrishti</b><small>Watersheds · Water · A Better Tomorrow</small></span>
      </div>

      <nav className="sb-nav">
        {GROUPS.map((g, gi) => (
          <div className="sb-group" key={gi}>
            {g.label && <div className="sb-label">{g.label}</div>}
            {g.items.map((it) => (
              <Link key={it.label} to={it.to} onClick={onNavigate} className={`sb-item ${isActive(it) ? 'active' : ''}`}>
                <Icon d={I[it.icon]} />
                <span>{it.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sb-foot">
        {mode && (
          <div className={`sb-mode ${mode.live ? 'live' : ''}`}>
            <span className="dot" /> {mode.live ? 'Sentinel Hub · live' : 'Mock satellite data'}
          </div>
        )}
        <div className="sb-user">
          <div className="av">PS</div>
          <div><b>Prem Sonawane</b><small>Project user</small></div>
        </div>
      </div>
    </aside>
  );
}
