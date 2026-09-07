import { useEffect, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { api } from './api.js';
import { ToastProvider } from './components/Toast.jsx';
import MapPage from './pages/MapPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SitesPage from './pages/SitesPage.jsx';
import SiteDetailPage from './pages/SiteDetailPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';

export default function App() {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    api.mode().then((m) => setMode(m)).catch(() => setMode({ mode: 'mock', live: false }));
  }, []);

  return (
    <ToastProvider>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="drop">💧</span>
            <span>
              <b>JalDrishti</b>
              <small>Watershed Intelligence</small>
            </span>
          </div>
          <nav className="nav">
            <NavLink to="/" end>Map</NavLink>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/sites">Sites</NavLink>
          </nav>
          <span className="spacer" />
          {mode && (
            <span className={`mode-badge ${mode.live ? 'live' : ''}`} title="Satellite data source">
              {mode.live ? '🛰 Sentinel Hub (live)' : '🛰 Mock data'}
            </span>
          )}
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/sites" element={<SitesPage />} />
            <Route path="/sites/:id/explore" element={<WorkspacePage />} />
            <Route path="/sites/:id" element={<SiteDetailPage />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}
