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
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>The SimplyClik Admin Portal lets you manage all aspects of your maintenance operations: customers, their service locations, contractors, service requests, assets, and leads.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Login:</strong> <code>http://208.87.135.84:3001</code>. Use your admin email and password. Only admin accounts can access this portal.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Navigation:</strong> The top bar links to each section. <strong>?</strong> for help, <strong>{'</>'}</strong> for developer reference.</p>
        </Section>

        <Section id="dashboard" title="Dashboard">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Shows summary counts: <strong>Customers</strong>, <strong>Contractors</strong>, <strong>Locations</strong>, <strong>Requests</strong>, and <strong>Leads</strong>. Click any tile to jump to its full list.</p>
        </Section>

        <Section id="customers" title="Customers">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Lists all customers. Search by name. Click <strong>"+ Add Customer"</strong> to open the 4-step wizard: Details, Locations, Manage, Billing. Click the pencil icon to edit.</p>
        </Section>

        <Section id="customer-locations" title="Customer Locations">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Locations are service sites managed in the Customer wizard, step 2. Add manually or via CSV upload (columns: <code>companyName</code>, <code>reference</code>, <code>address</code>). Remove with the <strong>x</strong> button.</p>
        </Section>

        <Section id="contractors" title="Contractors">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Lists all contractors. <strong>"+ Add Contractor"</strong> opens a 3-step wizard: Details, Locations (assign to customer sites + service types), Manage. Edit with the pencil icon.</p>
        </Section>

        <Section id="requests" title="Service Requests">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Each request tracks a maintenance job through an 11-status lifecycle: Pending Approval → RFI / Awaiting Quote → Pending Quote Approval → Awaiting Acceptance → Accepted → In Progress → Contractor Completed → Completed.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Filter</strong> by status dropdown. <strong>Click a row</strong> to expand the detail panel. <strong>Edit</strong> to change fields, <strong>"+ New Request"</strong> to create. Status transitions are validated — only valid moves are allowed.</p>
        </Section>

        <Section id="assets" title="Assets">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Equipment tracked per location (HVAC, electrical, fire systems, etc.). Each has a code, category, status, and service dates. <strong>"+ Add Asset"</strong> or pencil icon to edit. Status colours: Active (green), Under Maintenance (amber), Out of Service (red), Retired (grey).</p>
        </Section>

        <Section id="leads" title="Leads">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Prospective customers. Two-panel layout: list on left, detail on right with notes history. <strong>Convert to Customer/Contractor</strong> pre-fills the creation wizard. <strong>x</strong> to delete.</p>
        </Section>

        <Section id="activity" title="Activity Reports">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Monthly summary of requests grouped by customer. Drill down with the magnifying glass icon to see breakdown by location.</p>
        </Section>

        <Section id="notifications" title="Notifications">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>When request status changes, notifications are sent automatically via email (SMTP) and in-app. The <strong>Notifications</strong> section shows your notification history. Mark notifications as read to clear them.</p>
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
