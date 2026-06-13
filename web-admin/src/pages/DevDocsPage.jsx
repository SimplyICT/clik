const SECTIONS = [
  { id: 'new-page', title: 'Adding a New Page' },
  { id: 'api-client', title: 'Frontend API Client' },
  { id: 'backend-api', title: 'Backend API Endpoints' },
  { id: 'auth', title: 'Auth & Sessions' },
  { id: 'proxy', title: 'Supabase Proxy' },
  { id: 'state-machine', title: 'Request State Machine' },
  { id: 'scheduler', title: 'Scheduled Tasks' },
  { id: 'notifications', title: 'Notification System' },
  { id: 'infrastructure', title: 'Infrastructure' },
  { id: 'conventions', title: 'Conventions' },
  { id: 'tables', title: 'Database Tables' },
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
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Admin Portal — Developer Reference</h2>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>Architecture, conventions, and API reference. Update this page as the codebase evolves.</p>

        <Section id="new-page" title="Adding a New Page">
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Create <code>src/pages/YourPage.jsx</code> — default export a React component.</li>
            <li>Import in <code>src/App.jsx</code>, add <code>&lt;Route&gt;</code> + <code>NAV</code> entry.</li>
            <li>Wrap with <code>&lt;RequireAuth&gt;&lt;Layout&gt;...&lt;/Layout&gt;&lt;/RequireAuth&gt;</code> for protected pages.</li>
            <li>Add user-facing help in <code>HelpPage.jsx</code> and dev notes in <code>DevDocsPage.jsx</code>.</li>
          </ol>
        </Section>

        <Section id="api-client" title="Frontend API Client (src/api/client.js)">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Function</th><th style={{ textAlign: 'left', padding: '6px 10px' }}>HTTP</th><th style={{ textAlign: 'left', padding: '6px 10px' }}>Usage</th>
            </tr></thead>
            <tbody>
              <tr><td><code>q(table, opts)</code></td><td>GET</td><td>List with select, filters, order, limit</td></tr>
              <tr><td><code>create(table, data)</code></td><td>POST</td><td>Insert, returns created record</td></tr>
              <tr><td><code>update(table, id, data)</code></td><td>PATCH</td><td>Update by id</td></tr>
              <tr><td><code>del(table, id)</code></td><td>DELETE</td><td>Delete by id</td></tr>
              <tr><td><code>login / logout</code></td><td>POST</td><td>Auth via /api/login, stores token in localStorage</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: 13, marginTop: 8 }}>All calls include <code>Authorization: Bearer &lt;token&gt;</code> automatically. The proxy route is <code>/api/supabase/{'{table}'}</code>.</p>
        </Section>

        <Section id="backend-api" title="Backend API Endpoints">
          <p style={{ fontSize: 13 }}>All endpoints live in <code>server/fastapi_app.py</code>. FastAPI + Uvicorn on port 3001 (admin) and 3002 (portal).</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Endpoint</th><th style={{ textAlign: 'left', padding: '6px 10px' }}>Description</th>
            </tr></thead>
            <tbody>
              <tr><td><code>POST /api/login</code></td><td>bcrypt auth, returns token + session</td></tr>
              <tr><td><code>POST /api/logout</code></td><td>Clears server-side session</td></tr>
              <tr><td><code>GET /api/health</code></td><td>Health check, returns mode + version</td></tr>
              <tr><td><code>GET /api/health/db</code></td><td>Database connectivity check</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/customers</code></td><td>Customer CRUD + summary endpoint</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/contractors</code></td><td>Contractor CRUD</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/locations</code></td><td>Location CRUD (customerLocations view)</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/requests</code></td><td>Request CRUD + state machine transitions</td></tr>
              <tr><td><code>POST /api/requests/{id}/transition</code></td><td>Status transition with validation</td></tr>
              <tr><td><code>GET/POST /api/requests/{id}/notes</code></td><td>Notes on requests</td></tr>
              <tr><td><code>GET/POST /api/requests/{id}/invoice</code></td><td>Invoice per request (upsert)</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/assets</code></td><td>Asset CRUD</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/leads</code></td><td>Lead CRUD</td></tr>
              <tr><td><code>GET /api/activity/summary</code></td><td>Aggregated request counts by customer</td></tr>
              <tr><td><code>GET /api/activity/location/{id}</code></td><td>Request counts by location for a customer</td></tr>
              <tr><td><code>GET /api/users</code></td><td>List all users with roles</td></tr>
              <tr><td><code>GET /api/customers/{id}/users</code></td><td>Users scoped to a customer</td></tr>
              <tr><td><code>POST /api/otp/generate</code></td><td>Generate 6-digit OTP (15min expiry)</td></tr>
              <tr><td><code>POST /api/otp/verify</code></td><td>Verify OTP code</td></tr>
              <tr><td><code>POST /api/upload/presign</code></td><td>Get presigned upload URL for Supabase Storage</td></tr>
              <tr><td><code>GET /api/notifications</code></td><td>List in-app notifications</td></tr>
              <tr><td><code>POST /api/notifications/{id}/read</code></td><td>Mark notification as read</td></tr>
              <tr><td><code>POST /api/invoices/process-auto-approvals</code></td><td>Auto-approve invoices past 48h window</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="auth" title="Auth & Sessions">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Login generates a <code>secrets.token_hex(32)</code> token stored in an in-memory dict (<code>SESSIONS</code>) with 24h TTL. Every <code>/api/supabase/{'{table}'}</code> and <code>/api/*</code> request validates the token via the <code>require_session</code> dependency. Logout removes the token from the store. Portal login also returns <code>customer_id</code>, <code>author_profile_id</code> for data scoping.</p>
        </Section>

        <Section id="proxy" title="Supabase Proxy">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}><code>ALLOWED_TABLES</code> restricts which tables can be proxied (12 tables in the set). <code>RATELIMIT_MAX</code> (default 100 req/min/IP) protects against abuse. The anon key is server-side only. Direct Supabase REST calls from the frontend have been eliminated.</p>
        </Section>

        <Section id="state-machine" title="Request State Machine">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>The <code>VALID_TRANSITIONS</code> dict defines all legal status transitions:</p>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 11 }}>
pending_approval → rfi / awaiting_quote / cancelled
rfi → pending_approval / cancelled
awaiting_quote → pending_quote_approval / cancelled
pending_quote_approval → awaiting_acceptance / declined / rfi
awaiting_acceptance → accepted / declined
accepted → in_progress / cancelled
in_progress → contractor_completed / cancelled
contractor_completed → completed / cancelled</pre>
        </Section>

        <Section id="scheduler" title="Scheduled Tasks">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>APScheduler runs inside the admin FastAPI server. Two jobs:
          <strong>st01</strong> (every 12h) auto-completes requests with invoices older than 48h.
          <strong>st02</strong> (every 4h) auto-reassigns requests stuck in <code>awaiting_acceptance</code> past their priority timeout.
          Job code in <code>server/scheduler.py</code>.</p>
        </Section>

        <Section id="notifications" title="Notification System">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Module in <code>server/notifications.py</code>. Three channels:
          <strong>Email</strong> via SMTP (configure <code>SMTP_HOST</code> etc. in env vars).
          <strong>Push</strong> via Firebase Admin SDK (set <code>FCM_CREDENTIALS</code> path).
          <strong>In-app</strong> stored in <code>notifications</code> DB table, accessed via <code>/api/notifications</code>.
          Trigger: <code>notify_request_update()</code> fires async on every request transition.</p>
        </Section>

        <Section id="infrastructure" title="Infrastructure">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
            <li><strong>Health:</strong> <code>/api/health</code> and <code>/api/health/db</code></li>
            <li><strong>Logging:</strong> Structured JSON via <code>server/logging.json</code></li>
            <li><strong>nGinx:</strong> <code>server/nginx.conf</code> — reverse proxy, SSL, rate limiting</li>
            <li><strong>Environments:</strong> <code>server/env.dev</code> template; systemd has prod vars</li>
            <li><strong>Tests:</strong> <code>server/tests/test_api.py</code> — 16 integration tests</li>
            <li><strong>CI/CD:</strong> <code>.github/workflows/ci.yml</code> — GitHub Actions</li>
          </ul>
        </Section>

        <Section id="conventions" title="Conventions">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
            <li><strong>Inline styles only</strong> — no CSS modules or styled-components.</li>
            <li><strong>No comments in production code</strong> — use descriptive names.</li>
            <li><strong>Loading pattern:</strong> <code>Loading...</code> div until data resolves.</li>
            <li><strong>Data fetching:</strong> <code>useCallback + useEffect</code> (<code>load()</code> pattern).</li>
            <li><strong>Modals:</strong> fixed overlay, white card, flex centering.</li>
            <li><strong>Components:</strong> <code>Field</code> (label+input+error), <code>Fi</code> (compact input).</li>
            <li><strong>Phone format:</strong> <code>fmtPhone()</code> → <code>0412 345 678</code>.</li>
            <li><strong>Auth:</strong> Bearer token in <code>Authorization</code> header, from <code>localStorage.getItem('token')</code>.</li>
          </ul>
        </Section>

        <Section id="tables" title="Database Tables">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px' }}>View / Table</th><th style={{ textAlign: 'left', padding: '6px 10px' }}>Key Columns</th>
            </tr></thead>
            <tbody>
              <tr><td><code>customers</code></td><td>id, name, contactName, contactEmail, addressJson, billing</td></tr>
              <tr><td><code>customerLocations</code></td><td>id, companyName, customerId, reference, addressJson</td></tr>
              <tr><td><code>contractors</code></td><td>id, companyName, contactName, abn, addressJson</td></tr>
              <tr><td><code>requests</code></td><td>id, title, status, serviceType, priority, customerId, quoteAmount</td></tr>
              <tr><td><code>request_notes</code></td><td>id, request_id, author_profile_id, display_name, description, visibility</td></tr>
              <tr><td><code>request_invoices</code></td><td>request_id, invoice_number, amount, submit_date, auto_approve_date</td></tr>
              <tr><td><code>assets</code></td><td>id, assetName, assetCode, category, status, customerId</td></tr>
              <tr><td><code>leads</code></td><td>id, first_name, last_name, email, company</td></tr>
              <tr><td><code>notifications</code></td><td>id, user_id, title, body, link, is_read, created_at</td></tr>
              <tr><td><code>device_tokens</code></td><td>user_id, push_token, platform, is_active</td></tr>
              <tr><td><code>one_time_passcodes</code></td><td>code, profile_id, expires_at, consumed_at</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="build-deploy" title="Build &amp; Deploy">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Command</th><th style={{ textAlign: 'left', padding: '6px 10px' }}>When</th>
            </tr></thead>
            <tbody>
              <tr><td><code>npm run build</code></td><td>After any src/ change in web-admin or web-portal</td></tr>
              <tr><td><code>systemctl --user restart simplyclik</code></td><td>After server code change or frontend build</td></tr>
              <tr><td><code>systemctl --user restart simplyclik-portal</code></td><td>Portal server restart</td></tr>
              <tr><td><code>systemctl --user restart simplyclik-tracker</code></td><td>Tracker restart (after data.json changes)</td></tr>
              <tr><td><code>python -m pytest server/tests/ -v</code></td><td>Run backend integration tests</td></tr>
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
