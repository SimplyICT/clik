import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { getUser, logout, canView } from './api/client';
import { setItem, getItem } from './api/storage';
import LoginPage from './pages/LoginPage';
import PwaInstall from './pages/PwaInstall';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const JobDetailPage = lazy(() => import('./pages/JobDetailPage'));
const ManagerSitesPage = lazy(() => import('./pages/ManagerSitesPage'));
const ManagerRequestsPage = lazy(() => import('./pages/ManagerRequestsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AssetsPage = lazy(() => import('./pages/AssetsPage'));
const AssetDetailPage = lazy(() => import('./pages/AssetDetailPage'));
const AssetFormPage = lazy(() => import('./pages/AssetFormPage'));
const QRScannerPage = lazy(() => import('./pages/QRScannerPage'));
const CreateJobPage = lazy(() => import('./pages/CreateJobPage'));
const RecordPartsPage = lazy(() => import('./pages/RecordPartsPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const WorkOrdersPage = lazy(() => import('./pages/WorkOrdersPage'));
const WorkOrderDetailPage = lazy(() => import('./pages/WorkOrderDetailPage'));

const CACHE = 'simplyclik-mobile-auth';

function authFromCache() {
  return caches.open(CACHE).then(c =>
    c.match('/mobile/.auth').then(r => r ? r.json() : null)
  ).catch(() => null);
}

function saveAuthToCache(d) {
  try {
    caches.open(CACHE).then(c =>
      c.put('/mobile/.auth', new Response(JSON.stringify(d)))
    );
  } catch {}
}

function AuthGate({ children }) {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState('Checking session...');
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 5000);
    const params = new URLSearchParams(loc.search);
    const t = params.get('token');
    if (t) {
      clearTimeout(timer);
      setItem('token', t);
      setItem('_remember', 'true');
      const inviteUser = sessionStorage.getItem('invite_user');
      if (inviteUser) {
        try { setItem('user', inviteUser); } catch {}
        sessionStorage.removeItem('invite_user');
      }
      sessionStorage.removeItem('invite_token');
      sessionStorage.setItem('show_onboarding', 'true');
      nav(loc.pathname.replace(/[?&]token=[^&]*/, ''), { replace: true });
      setReady(true);
    } else if (getUser()) {
      clearTimeout(timer);
      setReady(true);
    } else {
      setMsg('Restoring session...');
      // Try Cache API first (most persistent on iOS)
      authFromCache().then(cached => {
        if (cached && cached.token) {
          setItem('token', cached.token);
          if (cached.user) setItem('user', JSON.stringify(cached.user));
          if (cached.permissions) setItem('permissions', JSON.stringify(cached.permissions));
          if (cached.author_profile_id) setItem('author_profile_id', cached.author_profile_id);
          if (cached.customer_id) setItem('customer_id', cached.customer_id);
          if (cached.customer_name) setItem('customer_name', cached.customer_name);
          if (cached.role) setItem('role', cached.role);
          if (getUser()) {
            clearTimeout(timer);
            setReady(true);
            return;
          }
        }
        // Fallback: cookie bridge
        return fetch('/api/auth/cookie', { credentials: 'include', signal: AbortSignal.timeout(4000) })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d && d.token) {
              setItem('token', d.token);
              setItem('user', JSON.stringify(d.user));
              saveAuthToCache(d);
              if (d.permissions) setItem('permissions', JSON.stringify(d.permissions));
              if (d.author_profile_id) setItem('author_profile_id', d.author_profile_id);
              if (d.customer_id) setItem('customer_id', d.customer_id);
              if (d.customer_name) setItem('customer_name', d.customer_name);
              if (d.role) setItem('role', d.role);
            }
          });
      }).catch(() => {}).finally(() => { clearTimeout(timer); setReady(true); });
    }
    return () => clearTimeout(timer);
  }, []);
  if (!ready) return <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#1a1a2e', minHeight: '100vh' }}>{msg}</div>;
  return children;
}

function RequireAuth({ children }) {
  const loc = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (getUser()) { setChecked(true); return; }
    const timer = setTimeout(() => setChecked(true), 3000);
    authFromCache().then(cached => {
      if (cached && cached.token) {
        setItem('token', cached.token);
        if (cached.user) setItem('user', JSON.stringify(cached.user));
        if (cached.permissions) setItem('permissions', JSON.stringify(cached.permissions));
        if (cached.author_profile_id) setItem('author_profile_id', cached.author_profile_id);
        if (cached.customer_id) setItem('customer_id', cached.customer_id);
        if (cached.customer_name) setItem('customer_name', cached.customer_name);
        if (cached.role) setItem('role', cached.role);
        if (getUser()) { clearTimeout(timer); setChecked(true); return; }
      }
      return fetch('/api/auth/cookie', { credentials: 'include', signal: AbortSignal.timeout(3000) })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && d.token) {
            setItem('token', d.token);
            setItem('user', JSON.stringify(d.user));
            saveAuthToCache(d);
            if (d.permissions) setItem('permissions', JSON.stringify(d.permissions));
            if (d.author_profile_id) setItem('author_profile_id', d.author_profile_id);
            if (d.customer_id) setItem('customer_id', d.customer_id);
            if (d.customer_name) setItem('customer_name', d.customer_name);
            if (d.role) setItem('role', d.role);
          }
        });
    }).catch(() => {}).finally(() => { clearTimeout(timer); setChecked(true); });
    return () => clearTimeout(timer);
  }, []);

  if (!checked) return <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#1a1a2e', minHeight: '100vh' }}>Restoring session...</div>;
  if (!getUser()) return <Navigate to="/login" replace />;
  const showOnboarding = sessionStorage.getItem('show_onboarding');
  if (showOnboarding && loc.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

function Nav() {
  const loc = useLocation().pathname;
  const role = getItem('role');
  const isContractor = role === 'contractor';
  const allTabs = isContractor
    ? [{ p: '/', l: 'Jobs' }, { p: '/work-orders', l: 'Work' }, { p: '/assets', l: 'Assets' }, { p: '/profile', l: 'Profile' }]
    : [{ p: '/', l: 'Sites' }, { p: '/requests', l: 'Requests' }, { p: '/assets', l: 'Assets' }, { p: '/profile', l: 'Profile' }];
  const tabs = allTabs.filter(t => {
    if (t.p === '/') return true;
    if (t.p === '/profile') return true;
    if (t.p === '/assets') return canView('assets');
    if (t.p === '/requests') return canView('requests');
    if (t.p === '/work-orders') return canView('work_orders');
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
      <AuthGate>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#f5f5f5', minHeight: '100vh' }}>Loading...</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
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
        <Route path="/work-orders" element={<RequireAuth><Layout title="Work Orders"><WorkOrdersPage /></Layout></RequireAuth>} />
        <Route path="/work-orders/:id" element={<RequireAuth><Layout title="Work Order"><WorkOrderDetailPage /></Layout></RequireAuth>} />
        <Route path="/qr-scanner" element={<RequireAuth><Layout title="Scan QR"><QRScannerPage /></Layout></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </AuthGate>
    </BrowserRouter>
  );
}
