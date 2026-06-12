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

function RequireAuth({ children }) {
  if (!sessionStorage.getItem('user')) return <Navigate to="/login" replace />;
  return children;
}

const NAV = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/locations', label: 'Service Locations' },
  { path: '/requests', label: 'Requests' },
  { path: '/activity', label: 'Activity' },
  { path: '/manage', label: 'Manage' },
  { path: '/help', label: '?' },
  { path: '/devdocs', label: '</>' },
];

function Layout({ children }) {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const loc = useLocation().pathname;
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <header style={{ background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', height: 52, padding: '0 20px', gap: 20 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Simplyclik Portal</span>
        {NAV.map(n => (
          <Link key={n.path} to={n.path} style={{
            color: loc === n.path ? '#00d4ff' : '#ccc', textDecoration: 'none', fontSize: 13, fontWeight: 600
          }}>{n.label}</Link>
        ))}
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 12, color: '#888' }}>{user.email}</span>
        <button onClick={() => { sessionStorage.clear(); window.location.href = '/login'; }}
          style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Logout</button>
      </header>
      <main style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
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
