import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast.jsx';
import Sidebar from './components/Sidebar.jsx';
import MapPage from './pages/MapPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SitesPage from './pages/SitesPage.jsx';
import SiteDetailPage from './pages/SiteDetailPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import GalleryPage from './pages/GalleryPage.jsx';

export default function App() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  return (
    <ToastProvider>
      <div className="shell">
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        {navOpen && <div className="sb-scrim" onClick={() => setNavOpen(false)} />}

        <div className="shell-main">
          <header className="mobile-bar">
            <button className="hamburger" onClick={() => setNavOpen((o) => !o)} aria-label="Menu">
              <span /><span /><span />
            </button>
            <div className="mb-brand"><span className="drop">💧</span><b>JalDrishti</b></div>
          </header>

          <main className="content">
            <Routes>
              <Route path="/" element={<MapPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/sites" element={<SitesPage />} />
              <Route path="/sites/:id/explore" element={<WorkspacePage />} />
              <Route path="/sites/:id" element={<SiteDetailPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
