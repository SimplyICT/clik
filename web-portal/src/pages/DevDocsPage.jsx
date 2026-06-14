const SECTIONS = [
  { id: 'architecture', title: 'Architecture' },
  { id: 'api-client', title: 'API Client' },
  { id: 'request-workflow', title: 'Request Workflow' },
  { id: 'auth', title: 'Auth & Storage' },
  { id: 'server', title: 'Server (FastAPI)' },
  { id: 'notifications', title: 'Notifications' },
  { id: 'conventions', title: 'Conventions' },
  { id: 'build-deploy', title: 'Build & Deploy' },
];

export default function DevDocsPage() {
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', padding: '16px 0', position: 'sticky', top: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', padding: '0 16px 10px', borderBottom: '1px solid #f0f0f0', marginBottom: 8 }}>Dev Topics</div>
        {SECTIONS.map(s => (
          <a key={s.id} href={`#${s.id}`}
            style={{ display: 'block', padding: '6px 16px', color: '#444', textDecoration: 'none', fontSize: 13, borderLeft: '3px solid transparent' }}
            onClick={e => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); }}>
            {s.title}
          </a>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Customer Portal — Developer Reference</h2>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>Architecture, conventions, and patterns. Update this page as the codebase evolves.</p>

        <Section id="architecture" title="Architecture">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
            <li><strong>Frontend:</strong> React 18 + Vite, served at /portal/ via nGinx → port 30002</li>
            <li><strong>Backend:</strong> Same FastAPI app as admin (<code>MODE=portal</code>)</li>
            <li><strong>Database:</strong> Supabase PostgreSQL via pg8000 + REST proxy</li>
            <li><strong>Auth:</strong> Shared login endpoint, portal mode returns customer-scoped fields</li>
          </ul>
        </Section>

        <Section id="api-client" title="API Client (src/api/client.js)">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Shared client module with <code>q()</code>, <code>create()</code>, <code>update()</code>, <code>del()</code>, <code>customerFilter()</code>. All calls include Bearer token. Storage uses <code>_remember</code> flag to pick localStorage or sessionStorage.</p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Pages read data with <code>localStorage.getItem('key') || sessionStorage.getItem('key')</code> to handle both storage modes.</p>
        </Section>

        <Section id="request-workflow" title="Request Workflow">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Three-tab view (Pending/Open/Closed) with click-for-detail. Detail panel shows quote amounts, invoice info, timeline of notes, and status-specific action buttons. All transitions validated server-side by <code>VALID_TRANSITIONS</code> state machine.</p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Requests scoped to the logged-in customer via <code>customerFilter()</code> which reads <code>customer_id</code> from login response.</p>
        </Section>

        <Section id="auth" title="Auth & Storage">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Login via <code>POST /api/login</code> → nGinx → admin server. Returns <code>customer_id</code>, <code>author_profile_id</code>, <code>customer_name</code> for portal-scoped data access.</p>
          <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 20 }}>
            <li><strong>Remember Me:</strong> Checked → localStorage (persist). Unchecked → sessionStorage (close = clear).</li>
            <li><strong>Session TTL:</strong> 30 days, DB-backed (survives server restarts).</li>
            <li><strong>Logout:</strong> Clears both storages + deletes server-side session.</li>
          </ul>
        </Section>

        <Section id="server" title="Server (FastAPI)">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
            <li>FastAPI + Uvicorn on port 30002 (<code>MODE=portal</code>).</li>
            <li>Login returns customer-scoped fields (customer_id, author_profile_id).</li>
            <li>All <code>/api/*</code> endpoints shared with admin, scoped by session.</li>
            <li>Static files from <code>web-portal/build/</code>. SPA fallback for client routing.</li>
          </ul>
        </Section>

        <Section id="notifications" title="Notifications">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Three channels fire on status changes: <strong>In-app</strong> (notifications table), <strong>Email</strong> (SMTP, requires config), <strong>Pushover</strong> (third-party iOS/Android app). Web push via VAPID for browser notifications. Pushover configured via env vars <code>PUSHOVER_TOKEN</code> and <code>PUSHOVER_USER</code>.</p>
        </Section>

        <Section id="conventions" title="Conventions">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
            <li><strong>Inline styles only</strong> — no CSS modules or UI libraries.</li>
            <li><strong>No comments in production code</strong>.</li>
            <li><strong>Loading state:</strong> "Loading..." with 8-second timeout fallback.</li>
            <li><strong>Auth check:</strong> <code>getItem('user')</code> from storage.js helper + Bearer token.</li>
            <li><strong>Responsive:</strong> CSS media query at 640px breakpoint for mobile.</li>
          </ul>
        </Section>

        <Section id="build-deploy" title="Build &amp; Deploy">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Command</th><th style={{ textAlign: 'left', padding: '6px 10px' }}>When</th>
            </tr></thead>
            <tbody>
              <tr><td><code>npm run build</code></td><td>After any src/ change</td></tr>
              <tr><td><code>systemctl --user restart simplyclik-portal</code></td><td>After build or server code change</td></tr>
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <div id={id} style={{ marginBottom: 20, background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e0e0e0' }}>
      <h3 style={{ fontSize: 15, marginBottom: 12, color: '#1a1a2e' }}>{title}</h3>
      {children}
    </div>
  );
}
