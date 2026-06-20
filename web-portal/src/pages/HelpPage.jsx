const SECTIONS = [
  { id: 'getting-started', title: 'Getting Started' },
  { id: 'dashboard', title: 'Dashboard' },
  { id: 'sites', title: 'Service Sites' },
  { id: 'my-assets', title: 'My Assets' },
  { id: 'requests', title: 'Service Requests' },
  { id: 'activity', title: 'Activity' },
  { id: 'manage', title: 'Manage Users' },
  { id: 'notifications', title: 'Notifications' },
];

export default function HelpPage() {
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', padding: '16px 0', position: 'sticky', top: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', padding: '0 16px 10px', borderBottom: '1px solid #f0f0f0', marginBottom: 8 }}>Help Topics</div>
        {SECTIONS.map(s => (
          <a key={s.id} href={`#${s.id}`}
            style={{ display: 'block', padding: '6px 16px', color: '#444', textDecoration: 'none', fontSize: 13, borderLeft: '3px solid transparent' }}
            onClick={e => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); }}>
            {s.title}
          </a>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>Customer Portal Help Guide</h2>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>How-to guide for managing your service sites, requests, and users.</p>

        <Section id="getting-started" title="Getting Started">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>The Customer Portal lets you view your service sites, track maintenance requests, review monthly activity, and manage account users.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>URL:</strong> <code>https://pwa.simplyclik.com/portal/</code></p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Login:</strong> Use the email and password from your account manager. Check <strong>Remember me</strong> to stay logged in. Each user only sees their own customer's data.</p>
        </Section>

        <Section id="dashboard" title="Dashboard">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Two clickable tiles: <strong>Service Locations</strong> (total count) and <strong>Requests</strong> (open / total). Click either to jump to the full view.</p>
        </Section>

        <Section id="sites" title="Service Sites">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Lists all service sites on your account. Click a site to expand and see its details (contact name, email, phone) and all service requests for that site.</p>
        </Section>

        <Section id="my-assets" title="My Assets">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>View all equipment and assets registered at your sites. The list shows asset name, code, category, and location. Filter by category or location using the dropdowns at the top.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Click any asset to open a detail view showing: manufacturer, model, serial number, install/purchase/warranty dates, service history (past jobs), photos, custom fields, and notes. From the asset detail you can add notes or <strong>Request Service</strong> — this creates a new maintenance request linked to that specific asset.</p>
        </Section>

        <Section id="requests" title="Service Requests">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Three tabs: <strong>Pending</strong>, <strong>Open</strong>, <strong>Closed</strong>. Click any card to open the detail panel showing full fields, quote amounts, invoice info, and a timeline of notes.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Actions:</strong> Depending on status you may see <strong>Approve Quote</strong>, <strong>Decline</strong>, <strong>Accept</strong>, or respond to an <strong>RFI</strong> (request for information).</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Timeline &amp; Notes:</strong> Every note and status change appears in the timeline. A red "New note" badge appears when there are unread updates.</p>
        </Section>

        <Section id="activity" title="Activity">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Monthly summary of requests per site. Select a month to view open/closed/total counts for each site.</p>
        </Section>

        <Section id="manage" title="Manage Users">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>View users on your account. Roles: <strong>Manager</strong> (full access), <strong>Operator</strong> (view + create), <strong>User</strong> (view only). Add/edit/remove requires the backend API (coming in a future update).</p>
        </Section>

        <Section id="notifications" title="Notifications">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>You'll receive in-app notifications when request statuses change. Check your notification history regularly. For reliable push notifications on your phone, install the <strong>Pushover</strong> app and contact your system administrator to configure it. If using the mobile PWA at <code>https://pwa.simplyclik.com/mobile/</code>, you can enable browser push notifications via the dashboard.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <div id={id} style={{ marginBottom: 20, background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e0e0e0' }}>
      <h3 style={{ fontSize: 16, marginBottom: 10, color: '#1a1a2e' }}>{title}</h3>
      {children}
    </div>
  );
}
