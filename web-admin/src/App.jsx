import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { getUser, isAdmin, logout } from './api/client';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import ContractorsPage from './pages/ContractorsPage';
import RequestsPage from './pages/RequestsPage';
import AssetsPage from './pages/AssetsPage';
import LeadsPage from './pages/LeadsPage';
import ActivityPage from './pages/ActivityPage';
import HelpPage from './pages/HelpPage';
import DevDocsPage from './pages/DevDocsPage';

const NAV = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/customers', label: 'Customers' },
  { path: '/contractors', label: 'Contractors' },
  { path: '/requests', label: 'Requests' },
  { path: '/assets', label: 'Assets' },
  { path: '/leads', label: 'Leads' },
  { path: '/activity', label: 'Activity' },
  { path: '/help', label: '?' },
  { path: '/devdocs', label: '</>' },
];

function RequireAuth({ children }) {
  if (!getUser() || !isAdmin()) return <Navigate to="/login" replace />;
  return children;
}

function Layout({ children }) {
  const loc = useLocation().pathname;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <header style={{ background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', height: 52, padding: '0 20px', gap: 20 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Simplyclik Admin</span>
        <nav style={{ display: 'flex', gap: 12, flex: 1 }}>
          {NAV.map(n => (
            <Link key={n.path} to={n.path}
               style={{ color: loc === n.path ? '#00d4ff' : '#ccc', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <span style={{ fontSize: 12, color: '#888' }}>{getUser()?.email}</span>
        <button onClick={() => { logout(); window.location.href = '/login'; }}
          style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
          Logout
        </button>
      </header>
      <main style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>{children}</main>
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
        <Route path="/assets" element={<RequireAuth><Layout><AssetsPage /></Layout></RequireAuth>} />
        <Route path="/leads" element={<RequireAuth><Layout><LeadsPage /></Layout></RequireAuth>} />
        <Route path="/activity" element={<RequireAuth><Layout><ActivityPage /></Layout></RequireAuth>} />
        <Route path="/help" element={<RequireAuth><Layout><HelpPage /></Layout></RequireAuth>} />
        <Route path="/devdocs" element={<RequireAuth><Layout><DevDocsPage /></Layout></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
