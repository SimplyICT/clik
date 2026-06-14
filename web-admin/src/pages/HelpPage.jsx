const SECTIONS = [
  { id: 'getting-started', title: 'Getting Started' },
  { id: 'dashboard', title: 'Dashboard' },
  { id: 'customers', title: 'Customers' },
  { id: 'customer-locations', title: 'Customer Locations' },
  { id: 'contractors', title: 'Contractors' },
  { id: 'requests', title: 'Service Requests' },
  { id: 'assets', title: 'Assets' },
  { id: 'leads', title: 'Leads' },
  { id: 'activity', title: 'Activity Reports' },
  { id: 'mobile-pwa', title: 'Mobile App (PWA)' },
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
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>Admin Portal Help Guide</h2>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>How-to guide for managing customers, contractors, requests, assets, and leads.</p>

        <Section id="getting-started" title="Getting Started">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>The Admin Portal manages your entire maintenance operation: customers, locations, contractors, requests, assets, and leads.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>URL:</strong> <code>https://pwa.simplyclik.com/</code> or <code>http://208.87.135.84:3001</code></p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Login:</strong> <code>admin@simplyclik.local</code> / <code>Temp123!</code>. Only admin accounts can access this portal. Check <strong>Remember me</strong> to stay logged in.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Mobile:</strong> Contractors and managers use the mobile PWA at <code>https://pwa.simplyclik.com/mobile/</code></p>
        </Section>

        <Section id="dashboard" title="Dashboard">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Shows summary counts: <strong>Customers</strong>, <strong>Contractors</strong>, <strong>Locations</strong>, <strong>Requests</strong>, and <strong>Leads</strong>. Click any tile to jump to its full list.</p>
        </Section>

        <Section id="customers" title="Customers">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Lists all customers. Search by name. <strong>"+ Add Customer"</strong> opens a 4-step wizard: Details, Locations (add manually or CSV upload), Manage, Billing. Click the pencil icon to edit.</p>
        </Section>

        <Section id="customer-locations" title="Customer Locations">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Locations are service sites managed in the Customer wizard, step 2. Add manually or via CSV upload (columns: <code>companyName</code>, <code>reference</code>, <code>address</code>). Remove with the <strong>x</strong> button.</p>
        </Section>

        <Section id="contractors" title="Contractors">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Lists all contractors. <strong>"+ Add Contractor"</strong> opens a 3-step wizard. Edit with the pencil icon.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Step 1 — Details:</strong> Company name, contact person, ABN, address.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Step 2 — Locations:</strong> Select a customer to see their locations. Check the boxes for locations this contractor services. For each location, toggle the service type chips (Air Conditioning, Cleaning, Electrical, etc.) to indicate which trades they handle at that site. When editing, previously assigned locations and services are pre-loaded.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Step 3 — Manage:</strong> Service contact details.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Contractor-location links are stored in <code>customer_location_contractors</code> and used for auto-assignment when new requests are created.</p>
        </Section>

        <Section id="requests" title="Service Requests">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Each request tracks a maintenance job through an 11-status lifecycle. <strong>Filter</strong> by status dropdown. <strong>Click a row</strong> to expand the detail panel. <strong>Edit</strong> to change fields. Status transitions are validated server-side.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Auto-assignment:</strong> When a request is created for a location that has linked contractors, the system automatically assigns the first available contractor and sets the status to Awaiting Acceptance.</p>
        </Section>

        <Section id="assets" title="Assets">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Equipment tracked per location (HVAC, electrical, fire systems, etc.). <strong>"+ Add Asset"</strong> or pencil icon to edit. Status colours: Active (green), Under Maintenance (amber), Out of Service (red), Retired (grey).</p>
        </Section>

        <Section id="leads" title="Leads">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Prospective customers. Two-panel layout: list on left, detail on right with notes history. <strong>Convert to Customer/Contractor</strong> pre-fills the creation wizard.</p>
        </Section>

        <Section id="activity" title="Activity Reports">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Monthly summary of requests grouped by customer. Drill down with the magnifying glass icon to see breakdown by location.</p>
        </Section>

        <Section id="mobile-pwa" title="Mobile App (PWA)">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>The mobile PWA at <code>https://pwa.simplyclik.com/mobile/</code> serves both contractors and managers with role-based views:</p>
          <ul style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 20 }}>
            <li><strong>Contractors:</strong> See jobs assigned to them via <code>contractorProfileId</code>. Accept jobs, submit quotes with amounts and photos, upload invoices with purchase orders, add timeline notes, mark complete.</li>
            <li><strong>Managers:</strong> Browse their assigned service locations, create maintenance requests with location/type/priority, optionally assign a contractor. Track all requests for their customer.</li>
          </ul>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Install as App (iOS):</strong> Open Safari → <code>https://pwa.simplyclik.com/mobile/</code> → Share → Add to Home Screen. This gives full-screen mode with no browser chrome and enables push notifications.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Install as App (Android):</strong> Open Chrome → <code>https://pwa.simplyclik.com/mobile/</code> → menu → Add to Home Screen. The PWA Install banner on the dashboard also triggers this.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Remember Me:</strong> Check the box on login to stay logged in across browser closes (token stored in localStorage). Uncheck to use session-only storage (cleared on close). Session TTL is 30 days.</p>
        </Section>

        <Section id="notifications" title="Notifications">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Three notification channels fire automatically on job assignment and status changes:</p>
          <ul style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 20 }}>
            <li><strong>In-app:</strong> Notification history within the web apps</li>
            <li><strong>Web Push:</strong> Browser notifications on supported devices (Android Chrome, iOS PWA)</li>
            <li><strong>Pushover:</strong> Reliable iOS/Android push via Pushover app (configured server-side, requires Pushover app on phone)</li>
          </ul>
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
