const SECTIONS = [
  { id: 'architecture', title: 'Architecture Overview' },
  { id: 'new-page', title: 'Adding a New Page' },
  { id: 'api-client', title: 'Frontend API Client' },
  { id: 'backend-api', title: 'Backend API Endpoints' },
  { id: 'auth', title: 'Auth & Sessions' },
  { id: 'proxy', title: 'Supabase Proxy' },
  { id: 'state-machine', title: 'Request State Machine' },
  { id: 'scheduler', title: 'Scheduled Tasks' },
  { id: 'notifications', title: 'Notification System' },
  { id: 'infrastructure', title: 'Infrastructure' },
  { id: 'storage', title: 'Storage (Remember Me)' },
  { id: 'mobile-pwa', title: 'Mobile PWA' },
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

        <Section id="architecture" title="Architecture Overview">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
            <li><strong>Frontend:</strong> React 18 + Vite, three SPAs (admin, portal, mobile)</li>
            <li><strong>Backend:</strong> FastAPI + Uvicorn, single codebase with MODE=admin|portal|mobile</li>
            <li><strong>Database:</strong> Supabase PostgreSQL via pg8000 (direct) + REST API proxy</li>
            <li><strong>Reverse proxy:</strong> nGinx (pwa.simplyclik.com) → internal ports (30001, 30002, 30004)</li>
            <li><strong>HTTPS:</strong> Let's Encrypt via Certbot, auto-renewing</li>
            <li><strong>Serving paths:</strong> Admin at /, Portal at /portal/, Mobile at /mobile/</li>
          </ul>
        </Section>

        <Section id="new-page" title="Adding a New Page">
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Create <code>src/pages/YourPage.jsx</code> — default export a React component.</li>
            <li>Import in <code>src/App.jsx</code>, add <code>&lt;Route&gt;</code> + <code>NAV</code> entry.</li>
            <li>Wrap with <code>&lt;RequireAuth&gt;&lt;Layout&gt;...&lt;/Layout&gt;&lt;/RequireAuth&gt;</code> for protected pages.</li>
            <li>Add user-facing help in <code>HelpPage.jsx</code> and dev notes in <code>DevDocsPage.jsx</code>.</li>
          </ol>
        </Section>

        <Section id="api-client" title="Frontend API Client (src/api/client.js)">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>All API calls go through the Supabase proxy (<code>/api/supabase/{'{table}'}</code>) or dedicated endpoints (<code>/api/customers</code>, etc.). Functions:</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Function</th><th style={{ padding: '6px 10px' }}>Method</th><th style={{ padding: '6px 10px' }}>Usage</th>
            </tr></thead>
            <tbody>
              <tr><td><code>q(table, opts)</code></td><td>GET</td><td>List with select, filters, order, limit</td></tr>
              <tr><td><code>create(table, data)</code></td><td>POST</td><td>Insert with <code>Prefer: return=representation</code></td></tr>
              <tr><td><code>update(table, id, data)</code></td><td>PATCH</td><td>Update by id</td></tr>
              <tr><td><code>del(table, id)</code></td><td>DELETE</td><td>Delete by id</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: 13, marginTop: 8 }}>Storage: uses <code>_remember</code> flag to pick localStorage or sessionStorage. All login data stored via <code>getItem/setItem</code> helper that checks the flag.</p>
        </Section>

        <Section id="backend-api" title="Backend API Endpoints">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Full list of endpoints in <code>server/fastapi_app.py</code>:</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Endpoint</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Description</th>
            </tr></thead>
            <tbody>
              <tr><td><code>POST /api/login</code></td><td>bcrypt auth, returns token + user + session</td></tr>
              <tr><td><code>POST /api/logout</code></td><td>Deletes session from DB</td></tr>
              <tr><td><code>GET /api/health</code></td><td>Health check</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/customers</code></td><td>Customer CRUD + summary</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/contractors</code></td><td>Contractor CRUD</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/locations</code></td><td>Location CRUD</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/requests</code></td><td>Request CRUD + transitions</td></tr>
              <tr><td><code>GET/POST /api/requests/{id}/notes</code></td><td>Notes CRUD</td></tr>
              <tr><td><code>GET/POST /api/requests/{id}/invoice</code></td><td>Invoice per request</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/assets</code></td><td>Asset CRUD</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/leads</code></td><td>Lead CRUD</td></tr>
              <tr><td><code>GET /api/activity/summary</code></td><td>Request counts by customer</td></tr>
              <tr><td><code>GET /api/notifications</code></td><td>In-app notifications</td></tr>
              <tr><td><code>POST /api/upload/presign</code></td><td>Supabase Storage presigned URL</td></tr>
              <tr><td><code>GET /api/push/vapid-key</code></td><td>VAPID public key for web push</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="auth" title="Auth & Sessions">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Login generates a 64-char hex token. Sessions are stored in the <code>sessions</code> database table (not in-memory — survives restarts). TTL is 30 days. The <code>require_session</code> dependency validates the Bearer token on every protected request. Logout deletes the session row.</p>
        </Section>

        <Section id="proxy" title="Supabase Proxy">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>The <code>ALLOWED_TABLES</code> set restricts which tables can be proxied (12 tables). Rate limiting at 100 req/min/IP. The <code>Prefer</code> header from the frontend is forwarded to Supabase (needed for <code>return=representation</code>). The proxy also fires Pushover notifications on successful POST to the <code>requests</code> table when <code>contractorProfileId</code> is set.</p>
        </Section>

        <Section id="state-machine" title="Request State Machine">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>The <code>VALID_TRANSITIONS</code> dict enforces status transitions:</p>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 11 }}>
pending_approval → rfi / awaiting_quote / cancelled
awaiting_quote → pending_quote_approval / cancelled
pending_quote_approval → awaiting_acceptance / declined / rfi
awaiting_acceptance → accepted / declined
accepted → in_progress / cancelled
in_progress → contractor_completed / cancelled
contractor_completed → completed / cancelled</pre>
        </Section>

        <Section id="scheduler" title="Scheduled Tasks">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>APScheduler in the admin server. <strong>st01</strong> (every 12h) auto-completes requests with invoices older than 48h. <strong>st02</strong> (every 4h) reassigns stuck requests. <strong>session_cleanup</strong> (every 1h) removes expired DB sessions.</p>
        </Section>

        <Section id="notifications" title="Notification System">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Module in <code>server/notifications.py</code>. Three channels:</p>
          <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 20 }}>
            <li><strong>Email (SMTP):</strong> Via <code>send_email()</code>. Configure <code>SMTP_HOST</code> etc. in env vars.</li>
            <li><strong>Web Push (VAPID):</strong> Via <code>send_web_push()</code> + <code>pywebpush</code>. VAPID keys auto-generated on startup.</li>
            <li><strong>Pushover:</strong> Via <code>send_pushover()</code>. POST to Pushover API. Configure <code>PUSHOVER_TOKEN</code> and <code>PUSHOVER_USER</code> in .env.</li>
          </ul>
        </Section>

        <Section id="infrastructure" title="Infrastructure">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
            <li><strong>nGinx:</strong> Reverse proxy with SSL termination. Config at <code>/etc/nginx/sites-enabled/pwa.simplyclik.com</code> and in <code>server/nginx.conf</code></li>
            <li><strong>SSL:</strong> Let's Encrypt via certbot. Auto-renews via systemd timer.</li>
            <li><strong>Health:</strong> <code>/api/health</code> and <code>/api/health/db</code></li>
            <li><strong>Logging:</strong> Structured JSON via <code>server/logging.json</code></li>
            <li><strong>Tests:</strong> <code>server/tests/test_api.py</code> — 16+ integration tests</li>
            <li><strong>CI/CD:</strong> <code>.github/workflows/ci.yml</code></li>
          </ul>
        </Section>

        <Section id="storage" title="Storage (Remember Me)">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>The <code>_remember</code> flag in localStorage controls token persistence:</p>
          <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 20 }}>
            <li><strong>Remember checked:</strong> Token in localStorage — survives browser close</li>
            <li><strong>Remember unchecked:</strong> Token in sessionStorage — cleared on tab close</li>
            <li><strong>On login:</strong> <code>setRemember()</code> migrates data between storages</li>
            <li><strong>On read:</strong> <code>getItem()</code> checks the flag, reads from correct storage</li>
            <li><strong>Fallback:</strong> Pages also check both storages directly with <code>||</code> fallback</li>
          </ul>
        </Section>

        <Section id="mobile-pwa" title="Mobile PWA">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Built with Vite + React, served at <code>/mobile/</code> via nGinx → port 30004. Features:</p>
          <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 20 }}>
            <li><strong>Role detection:</strong> On login, fetches <code>profile_type</code> from profiles table. Sets <code>role</code> to 'contractor' or 'manager'.</li>
            <li><strong>Contractor view:</strong> Jobs filtered by <code>contractorProfileId</code>. Status-specific actions (accept, quote, invoice, complete).</li>
            <li><strong>Manager view:</strong> Sites + Requests scoped to their <code>customer_id</code>. Can create requests with optional contractor assignment.</li>
            <li><strong>Auto-refresh:</strong> Jobs poll every 15 seconds. New-job banner with gradient design.</li>
            <li><strong>PWA manifest:</strong> <code>start_url: /mobile/</code>, <code>scope: /mobile/</code>, <code>display: standalone</code>.</li>
            <li><strong>Service worker:</strong> Registers at <code>/mobile/sw.js</code> with push notification handler.</li>
            <li><strong>PWA Install banner:</strong> Shows on Android (native prompt) and iOS (Safari instructions).</li>
          </ul>
        </Section>

        <Section id="tables" title="Database Tables">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>View/Table</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Key Columns</th>
            </tr></thead>
            <tbody>
              <tr><td><code>customers</code></td><td>id, name, contactName, contactEmail, addressJson, billing</td></tr>
              <tr><td><code>customerLocations</code></td><td>id, companyName, customerId, reference, addressJson</td></tr>
              <tr><td><code>contractors</code></td><td>id, companyName, contactName, abn, addressJson</td></tr>
              <tr><td><code>requests</code></td><td>id, title, status, serviceType, priority, customerId, quoteAmount</td></tr>
              <tr><td><code>request_notes</code></td><td>id, request_id, author_profile_id, display_name, description</td></tr>
              <tr><td><code>request_invoices</code></td><td>request_id, invoice_number, amount, submit_date, auto_approve_date</td></tr>
              <tr><td><code>profiles</code></td><td>id, user_id, profile_type, company_name, customer_id</td></tr>
              <tr><td><code>sessions</code></td><td>token, user_id, data, expires_at (DB-backed, 30-day TTL)</td></tr>
              <tr><td><code>device_tokens</code></td><td>user_id, push_token, platform, is_active</td></tr>
              <tr><td><code>notifications</code></td><td>id, user_id, title, body, is_read, created_at</td></tr>
              <tr><td><code>customer_location_contractors</code></td><td>customer_location_id, contractor_id (auto-assignment linking)</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="build-deploy" title="Build &amp; Deploy">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Command</th><th style={{ textAlign: 'left', padding: '6px 10px' }}>When</th>
            </tr></thead>
            <tbody>
              <tr><td><code>npm run build</code></td><td>After any src/ change in an app</td></tr>
              <tr><td><code>systemctl --user restart simplyclik</code></td><td>After server code or build</td></tr>
              <tr><td><code>systemctl --user restart simplyclik-portal</code></td><td>Portal server restart</td></tr>
              <tr><td><code>systemctl --user restart simplyclik-mobile</code></td><td>Mobile server restart</td></tr>
              <tr><td><code>sudo nginx -s reload</code></td><td>After nGinx config change</td></tr>
              <tr><td><code>python -m pytest server/tests/ -v</code></td><td>Run integration tests</td></tr>
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
