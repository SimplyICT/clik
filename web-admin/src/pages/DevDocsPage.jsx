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
  { id: 'asset-management', title: 'Asset Management Module' },
  { id: 'asset-submodules', title: 'Asset Sub-modules' },
  { id: 'asset-tables', title: 'Asset Database Tables' },
  { id: 'build-deploy', title: 'Build & Deploy' },
  { id: 'permissions', title: 'Permissions System' },
  { id: 'users', title: 'User Management' },
  { id: 'auto-provisioning', title: 'Auto-Provisioning / Invite' },
  { id: 'rate-limiting', title: 'Login Rate Limiting' },
];

export default function DevDocsPage() {
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', padding: '16px 0' }}>
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
          <p style={{ fontSize: 13, marginTop: 8 }}><strong>Asset Management endpoints</strong> (prefix: <code>/api/asset-management</code>, router in <code>server/asset_service/routes.py</code>):</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Endpoint</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Description</th>
            </tr></thead>
            <tbody>
              <tr><td><code>GET /api/asset-management/assets</code></td><td>List assets (filters: category, status, customer_id, contractor_id, search)</td></tr>
              <tr><td><code>GET /api/asset-management/assets/{id}</code></td><td>Get asset detail</td></tr>
              <tr><td><code>POST /api/asset-management/assets</code></td><td>Create asset (auto-generates QR code)</td></tr>
              <tr><td><code>PATCH /api/asset-management/assets/{id}</code></td><td>Update asset</td></tr>
              <tr><td><code>POST /api/asset-management/assets/{id}/retire</code></td><td>Retire asset</td></tr>
              <tr><td><code>POST /api/asset-management/assets/{id}/transfer</code></td><td>Transfer asset (admin only)</td></tr>
              <tr><td><code>GET /api/asset-management/assets/{id}/qr</code></td><td>Get QR code image (PNG)</td></tr>
              <tr><td><code>GET /api/asset-management/assets/{id}/jobs</code></td><td>List jobs linked to asset</td></tr>
              <tr><td><code>POST /api/asset-management/assets/{id}/create-job</code></td><td>Create job on asset (type: install/move/retire/inspect/repair/transfer)</td></tr>
              <tr><td><code>GET/POST /api/asset-management/parts</code></td><td>List / create parts</td></tr>
              <tr><td><code>PATCH/DELETE /api/asset-management/parts/{id}</code></td><td>Update / delete part (delete: admin only)</td></tr>
              <tr><td><code>POST /api/asset-management/parts/record-usage</code></td><td>Record part usage against a job</td></tr>
              <tr><td><code>GET/POST /api/asset-management/custom-fields</code></td><td>List / create custom field definitions</td></tr>
              <tr><td><code>GET /api/asset-management/reports/dashboard</code></td><td>Dashboard KPIs</td></tr>
              <tr><td><code>GET /api/asset-management/reports/export?type=</code></td><td>CSV export (assets, work_orders, costs)</td></tr>
              <tr><td><code>POST /api/asset-management/reports/import</code></td><td>CSV import with validation</td></tr>
              <tr><td><code>GET /api/asset-management/reports/import/template</code></td><td>Download CSV template</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/asset-management/maintenance</code></td><td>Maintenance schedules CRUD</td></tr>
              <tr><td><code>POST /api/asset-management/maintenance/{id}/complete</code></td><td>Complete maintenance schedule</td></tr>
              <tr><td><code>GET/POST/PATCH/DELETE /api/asset-management/work-orders</code></td><td>Work orders CRUD</td></tr>
              <tr><td><code>POST /api/asset-management/qr/batch</code></td><td>Generate printable PDF with QR codes</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="auth" title="Auth & Sessions">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Login generates a 64-char hex token. Sessions are stored in the <code>sessions</code> database table (not in-memory — survives restarts). TTL is 30 days. The <code>require_session</code> dependency validates the Bearer token on every protected request. Logout deletes the session row.</p>
        </Section>

        <Section id="proxy" title="Supabase Proxy">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>The <code>ALLOWED_TABLES</code> set restricts which tables can be proxied (12 tables). Rate limiting at 100 req/min/IP. The <code>Prefer</code> header from the frontend is forwarded to Supabase (needed for <code>return=representation</code>).</p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}><strong>Auto-assignment flow:</strong> The <code>requests</code> table is a VIEW backed by <code>requests_base</code>. An <code>INSTEAD OF INSERT</code> trigger (<code>requests_insert</code>) handles new requests: if <code>customerLocationProfileId</code> is provided but no <code>contractorProfileId</code>, it queries <code>customer_location_contractors</code> matching both location AND service type, assigns the first match, and upgrades status to <code>awaiting_acceptance</code>. The proxy then reads the returned row and fires Pushover/Web Push notifications when <code>contractorProfileId</code> is present.</p>
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
            <li><strong>Tests:</strong> ~176+ integration tests across all asset modules</li>
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
              <tr><td><code>requests</code> (VIEW)</td><td>id, title, status, serviceType, priority — backed by <code>requests_base</code>, auto-assigns contractor</td></tr>
              <tr><td><code>request_notes</code></td><td>id, request_id, author_profile_id, display_name, description</td></tr>
              <tr><td><code>request_invoices</code></td><td>request_id, invoice_number, amount, submit_date, auto_approve_date</td></tr>
              <tr><td><code>profiles</code></td><td>id, user_id, profile_type, company_name, customer_id</td></tr>
              <tr><td><code>sessions</code></td><td>token, user_id, data, expires_at (DB-backed, 30-day TTL)</td></tr>
              <tr><td><code>device_tokens</code></td><td>user_id, push_token, platform, is_active</td></tr>
              <tr><td><code>notifications</code></td><td>id, user_id, title, body, is_read, created_at</td></tr>
              <tr><td><code>customer_location_contractors</code></td><td>customer_location_id, contractor_id, service_types (TEXT[])</td></tr>
              <tr><td><code>assets_v2</code></td><td>id, asset_name, asset_code, qr_code, category, status, ... extended columns</td></tr>
              <tr><td><code>asset_parts</code></td><td>id, asset_id (nullable FK), name, sku, quantity, min_threshold</td></tr>
              <tr><td><code>asset_part_usage</code></td><td>part_id, request_id, quantity, used_by</td></tr>
              <tr><td><code>asset_custom_field_defs</code></td><td>category, field_name, field_label, field_type, options</td></tr>
              <tr><td><code>asset_documents</code></td><td>asset_id, file_name, file_url, file_type, file_size</td></tr>
              <tr><td><code>asset_maintenance_schedules</code></td><td>asset_id, title, frequency_type, frequency_value, last_completed, next_due</td></tr>
              <tr><td><code>asset_work_orders</code></td><td>asset_id, schedule_id, type, title, priority, status, labor_hours, total_cost</td></tr>
              <tr><td><code>asset_audit_log</code></td><td>asset_id, event_type, actor_id, details (JSONB)</td></tr>
              <tr><td><code>asset_cost_history</code></td><td>asset_id, cost_type, amount, description, recorded_date</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="asset-management" title="Asset Management Module">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Standalone module at <code>server/asset_service/</code> with its own router, DB layer, Pydantic models, and QR generator. Reuses existing auth (<code>require_session</code>) and Supabase (pg8000) connection.</p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}><strong>Files:</strong></p>
          <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 20 }}>
            <li><code>routes.py</code> — FastAPI router under <code>/api/asset-management/</code></li>
            <li><code>db.py</code> — All database CRUD functions using pg8000 named params</li>
            <li><code>models.py</code> — Pydantic request/response schemas</li>
            <li><code>qr.py</code> — QR code generation (base64 and raw PNG bytes)</li>
            <li><code>schema.sql</code> — DDL reference (run manually in Supabase SQL editor)</li>
          </ul>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}><strong>Frontend pages:</strong></p>
          <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 20 }}>
            <li><strong>Admin Dashboard:</strong> Extended <code>DashboardPage.jsx</code> — 6 asset KPI cards + inline SVG bar charts</li>
            <li><strong>Admin Asset Management:</strong> <code>AssetManagementPage.jsx</code> — 8 tabs (Assets, Parts, Custom Fields, Audit Log, Work Orders, Maintenance, Import/Export, QR Batch)</li>
            <li><strong>Mobile PWA:</strong> AssetsPage, AssetDetailPage, AssetFormPage, QRScannerPage, CreateJobPage, RecordPartsPage</li>
            <li><strong>Customer Portal:</strong> MyAssetsPage, AssetDetailView, MyWorkOrdersPage</li>
          </ul>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}><strong>Tests:</strong> ~176+ tests across 9 test files</p>
        </Section>

        <Section id="asset-submodules" title="Asset Sub-modules">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>The asset service is extended with sub-modules under <code>server/asset_service/</code>:</p>
          <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 20 }}>
            <li><code>documents/</code> — File uploads (photos, manuals, certificates), Supabase Storage signed URLs</li>
            <li><code>audit/</code> — Event logging for asset lifecycle events</li>
            <li><code>costs/</code> — Financial tracking (purchase, improvement, maintenance)</li>
            <li><code>maintenance/</code> — Preventive maintenance schedules with auto next_due calculation</li>
            <li><code>work_orders/</code> — Work order management (create, assign, complete, cost tracking)</li>
            <li><code>reports/</code> — Dashboard KPIs, CSV export, warranty/maintenance reports</li>
            <li><code>imports/</code> — CSV import with validation</li>
            <li><code>cron/</code> — Background jobs (auto-create WOs from due schedules)</li>
          </ul>
        </Section>

        <Section id="asset-tables" title="Asset Database Tables">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Table</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Key Columns</th>
            </tr></thead>
            <tbody>
              <tr><td><code>assets_v2</code></td><td>Extended with purchase_cost, replacement_value, depreciation_method, useful_life_years, location_name, contractor_name, hours_run, meter_reading</td></tr>
              <tr><td><code>asset_documents</code></td><td>id, asset_id, file_name, file_url, file_type, file_size, mime_type, uploaded_by, created_at</td></tr>
              <tr><td><code>asset_maintenance_schedules</code></td><td>id, asset_id, title, description, frequency_type, frequency_value, last_completed, next_due, assigned_contractor_id, auto_create_work_order</td></tr>
              <tr><td><code>asset_work_orders</code></td><td>id, asset_id, schedule_id, type, title, priority, status, assigned_contractor_id, labor_hours, labor_cost, parts_cost, total_cost, notes</td></tr>
              <tr><td><code>asset_audit_log</code></td><td>id, asset_id, event_type, actor_id, actor_name, details (JSONB)</td></tr>
              <tr><td><code>asset_cost_history</code></td><td>id, asset_id, cost_type, amount, description, recorded_date</td></tr>
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

        <Section id="permissions" title="Permissions System">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Role-based access control with per-resource view/edit permissions. Module in <code>server/permissions/</code>.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Endpoint</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Description</th>
            </tr></thead>
            <tbody>
              <tr><td><code>GET /api/users/me/permissions</code></td><td>Get current user's permissions</td></tr>
              <tr><td><code>GET /api/users/permissions/{user_id}</code></td><td>Admin: get user's permissions</td></tr>
              <tr><td><code>PUT /api/users/permissions/{user_id}</code></td><td>Admin: set permissions</td></tr>
              <tr><td><code>POST /api/users/permissions/{user_id}/seed</code></td><td>Admin: seed manager defaults</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: 13, marginTop: 8 }}><strong>Backend dependency:</strong> <code>require_permission(resource, action)</code> — FastAPI dependency injected into routes. Resources: dashboard, assets, work_orders, requests, customers, contractors, locations, activity, users. Actions: view, edit.</p>
          <p style={{ fontSize: 13 }}><strong>Database table:</strong> <code>user_permissions</code> — columns: user_id, resource, can_view, can_edit.</p>
        </Section>

        <Section id="users" title="User Management">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>User CRUD with profile management, archiving, and permissions. Routes in <code>server/users.py</code>.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Endpoint</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Description</th>
            </tr></thead>
            <tbody>
              <tr><td><code>POST /api/users</code></td><td>Create user (email, password, role)</td></tr>
              <tr><td><code>PATCH /api/users/{user_id}</code></td><td>Update user role</td></tr>
              <tr><td><code>DELETE /api/users/{user_id}</code></td><td>Delete user permanently</td></tr>
              <tr><td><code>POST /api/users/{user_id}/archive</code></td><td>Archive user (soft delete)</td></tr>
              <tr><td><code>GET /api/users/{user_id}/profile</code></td><td>Get profile details</td></tr>
              <tr><td><code>PUT /api/users/{user_id}/profile</code></td><td>Update profile (name, phone, email, address)</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: 13, marginTop: 8 }}>Setting <code>role=contractor</code> automatically creates a corresponding entry in the <code>profiles</code> table with <code>profile_type=contractor</code>.</p>
        </Section>

        <Section id="auto-provisioning" title="Auto-Provisioning / Invite">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Invite system sends magic-link emails for passwordless login. Module in <code>server/invite.py</code>.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Endpoint</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Description</th>
            </tr></thead>
            <tbody>
              <tr><td><code>GET /api/invite/status/{user_id}</code></td><td>Check invite status</td></tr>
              <tr><td><code>POST /api/invite/{user_id}</code></td><td>Send invite email</td></tr>
              <tr><td><code>GET /api/invite/accept/{token}</code></td><td>Accept invite, creates session, sets cookie</td></tr>
              <tr><td><code>GET /api/auth/cookie</code></td><td>Validate session cookie (for iOS PWA auto-login)</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: 13, marginTop: 8 }}><strong>Database table:</strong> <code>invite_tokens</code> — columns: id, user_id, token, status (pending/accepted/expired), expires_at (7 days), created_at, accepted_at. Email sent via SMTP2GO (configured in <code>.env</code> as <code>SMTP_HOST</code> etc.).</p>
        </Section>

        <Section id="rate-limiting" title="Login Rate Limiting">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Rate limiting on the login endpoint to prevent brute-force attacks.</p>
          <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 20 }}>
            <li><strong>Threshold:</strong> 5 failed attempts per IP per 60 seconds</li>
            <li><strong>Config:</strong> <code>RATELIMIT_MAX</code> env var (defaults to 100 for API proxy)</li>
            <li><strong>Implementation:</strong> In-memory counter tracked by IP, reset on successful login or timeout</li>
          </ul>
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