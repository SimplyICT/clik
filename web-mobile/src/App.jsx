import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { getUser, logout, canView } from './api/client';
import { setItem } from './api/storage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import ManagerSitesPage from './pages/ManagerSitesPage';
import ManagerRequestsPage from './pages/ManagerRequestsPage';
import ProfilePage from './pages/ProfilePage';
import PwaInstall from './pages/PwaInstall';
import AssetsPage from './pages/AssetsPage';
import AssetDetailPage from './pages/AssetDetailPage';
import AssetFormPage from './pages/AssetFormPage';
import QRScannerPage from './pages/QRScannerPage';
import CreateJobPage from './pages/CreateJobPage';
import RecordPartsPage from './pages/RecordPartsPage';

function TokenHandler() {
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const token = params.get('token');
    if (token) {
      setItem('token', token);
      setItem('_remember', 'true');
      const inviteUser = sessionStorage.getItem('invite_user');
      if (inviteUser) {
        try { setItem('user', inviteUser); } catch {}
        sessionStorage.removeItem('invite_user');
      }
      sessionStorage.removeItem('invite_token');
      nav(loc.pathname.replace(/[?&]token=[^&]*/, ''), { replace: true });
    } else if (!getUser()) {
      fetch('/api/auth/cookie', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && d.token) {
            setItem('token', d.token);
            setItem('user', JSON.stringify(d.user));
            setItem('_remember', 'true');
            window.location.reload();
          }
        }).catch(() => {});
    }
  }, []);
  return null;
}

function RequireAuth({ children }) {
  if (!getUser()) return <Navigate to="/login" replace />;
  return children;
}

function Nav() {
  const loc = useLocation().pathname;
  const role = localStorage.getItem('role');
  const isContractor = role === 'contractor';
  const allTabs = isContractor
    ? [{ p: '/', l: 'Jobs' }, { p: '/assets', l: 'Assets' }, { p: '/profile', l: 'Profile' }]
    : [{ p: '/', l: 'Sites' }, { p: '/requests', l: 'Requests' }, { p: '/assets', l: 'Assets' }, { p: '/profile', l: 'Profile' }];
  const tabs = allTabs.filter(t => {
    if (t.p === '/') return true;
    if (t.p === '/profile') return true;
    if (t.p === '/assets') return canView('assets');
    if (t.p === '/requests') return canView('requests');
    return true;
  });

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1a1a2e', display: 'flex', zIndex: 100, borderTop: '1px solid #333' }}>
      {tabs.map(t => (
        <Link key={t.p} to={t.p} style={{
          flex: 1, textAlign: 'center', padding: '12px 4px', color: loc === t.p ? '#00d4ff' : '#888',
          textDecoration: 'none', fontSize: 13, fontWeight: 600
        }}>{t.l}</Link>
      ))}
    </div>
  );
}

function Layout({ children, title }) {
  const u = getUser();
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: 56 }}>
      <header style={{ background: '#1a1a2e', color: '#fff', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>{title || 'SimplyClik'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u?.email}</span>
          <button onClick={logout} style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>Logout</button>
        </div>
      </header>
      <main style={{ padding: '12px 14px', maxWidth: 600, margin: '0 auto' }}>
        <PwaInstall />
        {children}
      </main>
      <Nav />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/mobile">
      <TokenHandler />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><Layout><DashboardPage /></Layout></RequireAuth>} />
        <Route path="/jobs/:id" element={<RequireAuth><Layout><JobDetailPage /></Layout></RequireAuth>} />
        <Route path="/sites" element={<RequireAuth><Layout title="Sites"><ManagerSitesPage /></Layout></RequireAuth>} />
        <Route path="/requests" element={<RequireAuth><Layout title="Requests"><ManagerRequestsPage /></Layout></RequireAuth>} />
        <Route path="/requests/new" element={<RequireAuth><Layout title="New Request"><ManagerRequestsPage createMode /></Layout></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Layout title="Profile"><ProfilePage /></Layout></RequireAuth>} />
        <Route path="/assets" element={<RequireAuth><Layout title="Assets"><AssetsPage /></Layout></RequireAuth>} />
        <Route path="/assets/new" element={<RequireAuth><Layout title="New Asset"><AssetFormPage /></Layout></RequireAuth>} />
        <Route path="/assets/:id" element={<RequireAuth><Layout><AssetDetailPage /></Layout></RequireAuth>} />
        <Route path="/assets/:id/edit" element={<RequireAuth><Layout title="Edit Asset"><AssetFormPage /></Layout></RequireAuth>} />
        <Route path="/assets/:id/create-job" element={<RequireAuth><Layout title="Create Job"><CreateJobPage /></Layout></RequireAuth>} />
        <Route path="/assets/:id/record-parts" element={<RequireAuth><Layout title="Record Parts"><RecordPartsPage /></Layout></RequireAuth>} />
        <Route path="/qr-scanner" element={<RequireAuth><Layout title="Scan QR"><QRScannerPage /></Layout></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
