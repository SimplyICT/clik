import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { getUser, logout } from './api/client';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import LocationsPage from './pages/LocationsPage';
import RequestsPage from './pages/RequestsPage';

function RequireAuth({ children }) {
  if (!getUser()) return <Navigate to="/login" replace />;
  return children;
}

function Nav() {
  const loc = useLocation().pathname;
  const u = getUser();
  const isContractor = sessionStorage.getItem('role') === 'contractor';
  const tabs = isContractor
    ? [{ p: '/dashboard', l: 'Jobs' }, { p: '/jobs', l: 'All Jobs' }]
    : [{ p: '/dashboard', l: 'Home' }, { p: '/locations', l: 'Locations' }, { p: '/requests', l: 'Requests' }];

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1a1a2e', display: 'flex', zIndex: 100 }}>
      {tabs.map(t => (
        <Link key={t.p} to={t.p} style={{
          flex: 1, textAlign: 'center', padding: '10px 4px', color: loc === t.p ? '#00d4ff' : '#888',
          textDecoration: 'none', fontSize: 12, fontWeight: 600
        }}>{t.l}</Link>
      ))}
      <button onClick={logout} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', color: '#888', background: 'none', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Logout</button>
    </div>
  );
}

function Layout({ children, title }) {
  const u = getUser();
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: 52 }}>
      <header style={{ background: '#1a1a2e', color: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{title || 'SimplyClik'}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{u?.email}</span>
      </header>
      <main style={{ padding: '12px 14px', maxWidth: 600, margin: '0 auto' }}>{children}</main>
      <Nav />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<RequireAuth><Layout title="Dashboard"><DashboardPage /></Layout></RequireAuth>} />
        <Route path="/jobs" element={<RequireAuth><Layout title="Jobs"><JobsPage /></Layout></RequireAuth>} />
        <Route path="/jobs/:id" element={<RequireAuth><Layout><JobDetailPage /></Layout></RequireAuth>} />
        <Route path="/locations" element={<RequireAuth><Layout title="Locations"><LocationsPage /></Layout></RequireAuth>} />
        <Route path="/requests" element={<RequireAuth><Layout title="Requests"><RequestsPage /></Layout></RequireAuth>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
