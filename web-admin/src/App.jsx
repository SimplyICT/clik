import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { getUser, isAdmin, logout } from './api/client';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import ContractorsPage from './pages/ContractorsPage';
import RequestsPage from './pages/RequestsPage';
import AssetManagementPage from './pages/AssetManagementPage';
import LeadsPage from './pages/LeadsPage';
import ActivityPage from './pages/ActivityPage';
import HelpPage from './pages/HelpPage';
import DevDocsPage from './pages/DevDocsPage';
import UsersPage from './pages/UsersPage';

const styles = document.createElement('style');
styles.textContent = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .mobile-only { display: none; }
  input, select, textarea, button { font-family: inherit; }
  @media (max-width: 640px) {
    .desktop-only { display: none !important; }
    .responsive-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .modal-content { width: 95vw !important; max-height: 90vh !important; }
    .header-compact { padding: 0 12px !important; gap: 6px !important; height: 48px !important; }
    .header-compact span.font16 { font-size: 14px !important; }
    .main-pad { padding: 12px !important; }
    .wizard-card { width: 95vw !important; }
    .two-panel { grid-template-columns: 1fr !important; }
    .mobile-only { display: block !important; }
  }
`;
document.head.appendChild(styles);

const NAV = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/customers', label: 'Customers' },
  { path: '/contractors', label: 'Contractors' },
  { path: '/requests', label: 'Requests' },
  { path: '/assets', label: 'Asset Management' },
  { path: '/leads', label: 'Leads' },
  { path: '/activity', label: 'Activity' },
  { path: '/users', label: 'Users' },
];

function RequireAuth({ children }) {
  if (!getUser() || !isAdmin()) return <Navigate to="/login" replace />;
  return children;
}

function Layout({ children }) {
  const loc = useLocation().pathname;
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <header className="header-compact" style={{ background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', height: 52, padding: '0 20px', gap: 20 }}>
        <span className="font16" style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>Simplyclik</span>
        <nav className="desktop-only" style={{ display: 'flex', gap: 12, flex: 1 }}>
          {NAV.map(n => (
            <Link key={n.path} to={n.path}
               style={{ color: loc === n.path ? '#00d4ff' : '#ccc', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              {n.label}
            </Link>
          ))}
          <Link to="/help" style={{ color: '#888', textDecoration: 'none', fontSize: 13, marginLeft: 'auto' }}>?</Link>
          <Link to="/devdocs" style={{ color: '#888', textDecoration: 'none', fontSize: 13 }}>{'</>'}</Link>
        </nav>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ display: 'none', background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: 4 }}
          className="mobile-only" onPointerDown={() => {}}>{menuOpen ? '✕' : '☰'}</button>
        <span className="desktop-only" style={{ fontSize: 12, color: '#888' }}>{getUser()?.email}</span>
        <button onClick={() => { logout(); window.location.href = '/login'; }}
          style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
          Logout
        </button>
      </header>
      {menuOpen && (
        <div style={{ background: '#1a1a2e', padding: '8px 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {NAV.map(n => (
            <Link key={n.path} to={n.path} onClick={() => setMenuOpen(false)} style={{
              color: loc === n.path ? '#00d4ff' : '#ccc', textDecoration: 'none', fontSize: 14, fontWeight: 600, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 4
            }}>{n.label}</Link>
          ))}
          <Link to="/help" onClick={() => setMenuOpen(false)} style={{ color: '#888', textDecoration: 'none', fontSize: 14, padding: '6px 12px' }}>Help (?)</Link>
        </div>
      )}
      <main className="main-pad" style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>{children}</main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><Layout><DashboardPage /></Layout></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Layout><DashboardPage /></Layout></RequireAuth>} />
        <Route path="/customers" element={<RequireAuth><Layout><CustomersPage /></Layout></RequireAuth>} />
        <Route path="/contractors" element={<RequireAuth><Layout><ContractorsPage /></Layout></RequireAuth>} />
        <Route path="/requests" element={<RequireAuth><Layout><RequestsPage /></Layout></RequireAuth>} />
        <Route path="/assets" element={<RequireAuth><Layout><AssetManagementPage /></Layout></RequireAuth>} />
        <Route path="/leads" element={<RequireAuth><Layout><LeadsPage /></Layout></RequireAuth>} />
        <Route path="/activity" element={<RequireAuth><Layout><ActivityPage /></Layout></RequireAuth>} />
        <Route path="/help" element={<RequireAuth><Layout><HelpPage /></Layout></RequireAuth>} />
        <Route path="/devdocs" element={<RequireAuth><Layout><DevDocsPage /></Layout></RequireAuth>} />
        <Route path="/users" element={<RequireAuth><Layout><UsersPage /></Layout></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
