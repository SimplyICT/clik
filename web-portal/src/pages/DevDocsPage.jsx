const SECTIONS = [
  { id: 'new-page', title: 'Adding a New Page' },
  { id: 'api-client', title: 'API Client' },
  { id: 'backend', title: 'Backend Architecture' },
  { id: 'request-workflow', title: 'Request Workflow' },
  { id: 'notifications', title: 'Notifications' },
  { id: 'conventions', title: 'Conventions' },
  { id: 'customer-scope', title: 'Customer-Scoped Data' },
  { id: 'server', title: 'Server (FastAPI)' },
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

        <Section id="new-page" title="Adding a New Page">
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Create <code>src/pages/YourPage.jsx</code> — default export a React component.</li>
            <li>Import in <code>src/App.jsx</code>, add <code>&lt;Route&gt;</code> and <code>NAV</code> entry.</li>
            <li>Wrap with <code>&lt;RequireAuth&gt;&lt;Layout&gt;...&lt;/Layout&gt;&lt;/RequireAuth&gt;</code>.</li>
            <li>Add user-facing help in <code>HelpPage.jsx</code> and dev notes in <code>DevDocsPage.jsx</code>.</li>
          </ol>
        </Section>

        <Section id="api-client" title="API Client (src/api/client.js)">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Shared client module matching admin pattern. Functions: <code>q()</code>, <code>create()</code>, <code>update()</code>, <code>del()</code>, <code>customerFilter()</code>. All calls include <code>Authorization: Bearer</code> header automatically. Example:</p>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 12 }}>{`import { q, create, update, customerFilter } from '../api/client';

const cf = customerFilter();
const requests = await q('requests', { select: '*', filters: cf });
await create('request_notes', { request_id, description: 'note text' });
await update('requests', id, { status: 'accepted' });`}</pre>
        </Section>

        <Section id="backend" title="Backend Architecture">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Both admin (port 3001) and portal (port 3002) run the same <code>fastapi_app.py</code> with <code>MODE=admin|portal</code>. In portal mode, all API endpoints are scoped to the logged-in customer's <code>customer_id</code> from the session. The server uses FastAPI + Uvicorn + pg8000 (sync DB) + httpx (async HTTP).</p>
        </Section>

        <Section id="request-workflow" title="Request Workflow">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>The detail panel shows full request info, quote/invoice sections, action buttons, and a timeline. Customer-side actions:
          <strong>pending_quote_approval</strong> → Approve or Decline.
          <strong>awaiting_acceptance</strong> → Accept.
          <strong>rfi</strong> → Submit response.
          All transitions validated server-side by the <code>VALID_TRANSITIONS</code> state machine in <code>fastapi_app.py</code>.</p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>Notes are stored in <code>request_notes</code> (snake_case). Invoices in <code>request_invoices</code>. The <code>newNotesCustomer</code> flag on requests is cleared when the detail panel is opened.</p>
        </Section>

        <Section id="notifications" title="Notifications">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>In-app notifications stored in <code>notifications</code> table. API: <code>GET /api/notifications</code>, <code>POST /api/notifications/{id}/read</code>. Notifications fire automatically on request status transitions. Email and push (FCM) channels also available but require SMTP/FCM credential config.</p>
        </Section>

        <Section id="conventions" title="Conventions">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
            <li><strong>Inline styles only</strong> — no CSS modules or UI libraries.</li>
            <li><strong>No comments in production code</strong>.</li>
            <li><strong>Loading state:</strong> "Loading..." div until data arrives.</li>
            <li><strong>Auth check:</strong> <code>sessionStorage.getItem('user')</code> + Bearer token.</li>
          </ul>
        </Section>

        <Section id="customer-scope" title="Customer-Scoped Data">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Key</th><th style={{ textAlign: 'left', padding: '6px 10px' }}>Description</th>
            </tr></thead>
            <tbody>
              <tr><td><code>token</code></td><td>Bearer token for Authorization header</td></tr>
              <tr><td><code>user</code></td><td>JSON: { id, email }</td></tr>
              <tr><td><code>customer_id</code></td><td>UUID for <code>customerId=eq.</code> filters</td></tr>
              <tr><td><code>author_profile_id</code></td><td>Profile UUID for creating notes</td></tr>
              <tr><td><code>customer_ref</code></td><td>Legacy Firebase reference</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="server" title="Server (FastAPI)">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
            <li>FastAPI + Uvicorn on port 3002 (<code>MODE=portal</code>).</li>
            <li><code>POST /api/login</code> — bcrypt auth, returns <code>customer_id</code> + <code>author_profile_id</code>.</li>
            <li>All <code>/api/*</code> endpoints shared with admin, scoped by session.</li>
            <li><code>/api/supabase/{'{table}'}</code> proxy available as fallback (allowlisted + rate-limited).</li>
            <li>Static files from <code>web-portal/build/</code>. SPA fallback for client-side routing.</li>
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
