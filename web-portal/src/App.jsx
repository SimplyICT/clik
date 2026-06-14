import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LocationsPage from './pages/LocationsPage';
import RequestsPage from './pages/RequestsPage';
import ActivityPage from './pages/ActivityPage';
import ManagePage from './pages/ManagePage';
import HelpPage from './pages/HelpPage';
import DevDocsPage from './pages/DevDocsPage';

const styles = document.createElement('style');
styles.textContent = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .mobile-only { display: none; }
  input, select, textarea, button { font-family: inherit; }
  @media (max-width: 640px) {
    .desktop-only { display: none !important; }
    .responsive-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .responsive-grid { grid-template-columns: 1fr !important; }
    .modal-content { width: 95vw !important; max-height: 90vh !important; }
    .header-compact { padding: 0 12px !important; gap: 8px !important; height: 48px !important; }
    .header-compact span.font16 { font-size: 14px !important; }
    .main-pad { padding: 12px !important; }
    .two-panel { grid-template-columns: 1fr !important; }
    .mobile-only { display: block !important; }
    .tab-btn { font-size: 12px !important; padding: 6px 10px !important; }
  }
`;
document.head.appendChild(styles);

function RequireAuth({ children }) {
  const user = localStorage.getItem('user') || sessionStorage.getItem('user');
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

const NAV = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/locations', label: 'Locations' },
  { path: '/requests', label: 'Requests' },
  { path: '/activity', label: 'Activity' },
  { path: '/manage', label: 'Manage' },
];

function Layout({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const loc = useLocation().pathname;
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <header className="header-compact" style={{ background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', height: 52, padding: '0 20px', gap: 20 }}>
        <span className="font16" style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>Simplyclik</span>
        <nav className="desktop-only" style={{ display: 'flex', gap: 12, flex: 1 }}>
          {NAV.map(n => (
            <Link key={n.path} to={n.path} style={{
              color: loc === n.path ? '#00d4ff' : '#ccc', textDecoration: 'none', fontSize: 13, fontWeight: 600
            }}>{n.label}</Link>
          ))}
          <Link to="/help" style={{ color: '#888', textDecoration: 'none', fontSize: 13, marginLeft: 'auto' }}>?</Link>
          <Link to="/devdocs" style={{ color: '#888', textDecoration: 'none', fontSize: 13 }}>{'</>'}</Link>
        </nav>
        <button onClick={() => setMenuOpen(!menuOpen)} className="mobile-only" style={{ display: 'none', background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: 4 }}
          onPointerDown={() => {}}>
          {menuOpen ? '✕' : '☰'}
        </button>
        <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }} className="desktop-only">{user.email}</span>
        <button onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/login'; }}
          style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Logout</button>
      </header>
      {menuOpen && (
        <div style={{ background: '#1a1a2e', padding: '8px 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {NAV.map(n => (
            <Link key={n.path} to={n.path} onClick={() => setMenuOpen(false)} style={{
              color: loc === n.path ? '#00d4ff' : '#ccc', textDecoration: 'none', fontSize: 14, fontWeight: 600, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 4
            }}>{n.label}</Link>
          ))}
          <Link to="/help" onClick={() => setMenuOpen(false)} style={{ color: '#888', textDecoration: 'none', fontSize: 14, padding: '6px 12px' }}>Help (?)</Link>
          <Link to="/devdocs" onClick={() => setMenuOpen(false)} style={{ color: '#888', textDecoration: 'none', fontSize: 14, padding: '6px 12px' }}>Dev ({'</>'})</Link>
        </div>
      )}
      <main className="main-pad" style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/portal">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><Layout><DashboardPage /></Layout></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Layout><DashboardPage /></Layout></RequireAuth>} />
        <Route path="/locations" element={<RequireAuth><Layout><LocationsPage /></Layout></RequireAuth>} />
        <Route path="/requests" element={<RequireAuth><Layout><RequestsPage /></Layout></RequireAuth>} />
        <Route path="/activity" element={<RequireAuth><Layout><ActivityPage /></Layout></RequireAuth>} />
        <Route path="/manage" element={<RequireAuth><Layout><ManagePage /></Layout></RequireAuth>} />
        <Route path="/help" element={<RequireAuth><Layout><HelpPage /></Layout></RequireAuth>} />
        <Route path="/devdocs" element={<RequireAuth><Layout><DevDocsPage /></Layout></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}
