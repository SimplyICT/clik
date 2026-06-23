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
  { id: 'asset-parts', title: 'Parts Inventory' },
  { id: 'custom-fields', title: 'Custom Fields' },
  { id: 'asset-jobs', title: 'Creating Jobs from Assets' },
  { id: 'asset-transfer', title: 'Transferring Assets' },
  { id: 'asset-dashboard', title: 'Asset Dashboard KPIs' },
  { id: 'work-orders', title: 'Work Orders' },
  { id: 'maintenance', title: 'Maintenance Schedules' },
  { id: 'import-export', title: 'Import / Export' },
  { id: 'qr-batch', title: 'QR Batch Labels' },
  { id: 'permissions', title: 'Permissions' },
  { id: 'users', title: 'User Management' },
  { id: 'auto-provisioning', title: 'Invite & Auto-Provisioning' },
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
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Each request tracks a maintenance job through an 11-status lifecycle. <strong>Filter</strong> by status dropdown. <strong>Click a row</strong> to expand the detail panel. <strong>Edit</strong> to change fields. Status transitions are validated server-side. The detail panel now shows the assigned site and contractor names.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Creating a Request:</strong> The <strong>"+ New Request"</strong> form includes a <strong>Site/Location</strong> dropdown that loads when you select a customer. You can also optionally pick a specific contractor. If you select a site without picking a contractor, the system auto-assigns a matching contractor based on the service type at that location.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Auto-assignment:</strong> When a request is created for a location that has linked contractors, the system looks up contractors whose service types match the job's service type at that location, assigns the first match, and sets the status to <strong>Awaiting Acceptance</strong>. A Pushover push notification is also sent.</p>
        </Section>

        <Section id="assets" title="Assets">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>The <strong>Asset Management</strong> hub replaces the old asset list with a full lifecycle management system. Four tabs: <strong>All Assets</strong>, <strong>Parts Inventory</strong>, <strong>Custom Fields</strong>, and <strong>Dashboard</strong>.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>All Assets tab:</strong> Table with search, filters by category/status/customer/contractor. Click an asset to see full details including photos, parts list, service history, and QR code. Status colours: Active (green), Under Maintenance (amber), Out of Service (red), Retired (grey).</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Adding/Editing:</strong> <strong>"+ Add Asset"</strong> opens a form with fields: asset name, code, category, sub-category, status, criticality, manufacturer, model, serial number, customer/location assignment, dates (install, purchase, warranty, service), photos, and notes. Asset codes must be unique. A QR code is auto-generated on creation.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>QR Codes:</strong> Each asset gets a scannable QR code. View it in the asset detail panel (click the QR icon) — the image can be right-clicked to save/print. Scanning the QR code with the Mobile PWA opens the asset detail screen.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Lifecycle Actions:</strong> From the detail panel you can <strong>Create Job</strong> (opens a modal to select job type and description — creates a service request linked to the asset), <strong>Edit</strong>, <strong>Retire</strong> (marks as retired), or <strong>Transfer</strong> (manager-only: move asset to a different customer).</p>
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
            <li><strong>Contractors:</strong> See jobs assigned to them via <code>contractorProfileId</code>. Accept jobs, submit quotes with amounts, description, and photos, upload invoices with purchase orders, add timeline notes, mark complete. Job list is paginated (10 per page) with prev/next controls.</li>
            <li><strong>Managers:</strong> Browse their assigned service locations, create maintenance requests with location/type/priority, optionally assign a contractor. Track all requests for their customer.</li>
            <li><strong>Assets by Site:</strong> Contractors only see assets at the sites they are assigned to work at. Assets are tied to customer locations and filtered automatically based on the contractor's assigned sites.</li>
          </ul>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Install as App (iOS):</strong> Open Safari → <code>https://pwa.simplyclik.com/mobile/</code> → Share → Add to Home Screen. This gives full-screen mode with no browser chrome and enables push notifications.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Install as App (Android):</strong> Open Chrome → <code>https://pwa.simplyclik.com/mobile/</code> → menu → Add to Home Screen. The PWA Install banner on the dashboard also triggers this.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Remember Me:</strong> Check the box on login to stay logged in across browser closes (token stored in localStorage). Uncheck to use session-only storage (cleared on close). Session TTL is 30 days.</p>
        </Section>

        <Section id="asset-parts" title="Parts Inventory">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Manage replacement parts and consumables in the <strong>Parts Inventory</strong> tab. Each part has a name, SKU (unique), quantity, minimum threshold, and unit (each, box, liter, etc.). Parts can be generic or assigned to a specific asset.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Low-stock warning:</strong> Parts where quantity is below the minimum threshold are highlighted in red. Restock by editing the part and increasing the quantity.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Usage tracking:</strong> When contractors perform work, they record parts used via the mobile app. Usage is deducted from inventory and logged to the job record.</p>
        </Section>

        <Section id="custom-fields" title="Custom Fields">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Manager-only tab for defining category-specific custom fields. For example, HVAC assets can have "BTU Rating" and "Refrigerant Type" fields, while Electrical assets can have "Voltage" and "Amperage".</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Each custom field has: field name (internal), label (displayed), type (text, number, select, boolean), optional choices (for select type), required flag, and sort order. Once defined, these fields appear automatically when adding/editing assets of that category.</p>
        </Section>

        <Section id="asset-jobs" title="Creating Jobs from Assets">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>From any asset detail view, click <strong>Create Job</strong> to open a modal. Select a job type (install, move, retire, inspect, repair, or transfer), add an optional description, and submit. This creates a new service request in the existing <strong>Service Requests</strong> system, linked to the asset via <code>asset_id</code>. The request then follows the normal lifecycle (assignment, status transitions, notifications, invoicing).</p>
        </Section>

        <Section id="asset-transfer" title="Transferring Assets">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Managers can transfer assets between customers. Click <strong>Transfer</strong> in the asset detail panel, select the target customer and optionally a location. The asset's lifecycle status changes to "transferred" and it becomes visible to the new customer in the Customer Portal.</p>
        </Section>

        <Section id="asset-dashboard" title="Asset Dashboard KPIs">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>The main Dashboard now shows asset management KPIs below the existing count tiles. <strong>Asset Overview</strong> cards: Total Assets, Active Assets, Active Work Orders, Overdue Maintenance, Warranty Expiring Soon, and Total Costs. Two <strong>inline bar charts</strong> show Assets by Status and Assets by Category. No external chart library needed — rendered as SVG.</p>
        </Section>

        <Section id="work-orders" title="Work Orders">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>The <strong>Work Orders</strong> tab in Asset Management shows all work orders in two views simultaneously: a <strong>Kanban board</strong> at the top (columns: Pending, In Progress, Completed, Cancelled) and a <strong>table list</strong> below with all work orders.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Filters:</strong> By status, type (preventive, reactive, inspection, repair, installation), and priority (low, medium, high, urgent).</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Actions:</strong> Click <strong>Start</strong> to begin a work order, <strong>Complete</strong> to finish it, or <strong>Cancel</strong> to cancel. Status updates are instant.</p>
        </Section>

        <Section id="maintenance" title="Maintenance Schedules">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>The <strong>Maintenance</strong> tab shows all preventive maintenance schedules grouped by timeframe: <strong>Overdue</strong> (red), <strong>Due Within 30 Days</strong> (amber), <strong>Due Within 60 Days</strong> (blue), and <strong>Future</strong> (grey).</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Overdue alert:</strong> A red banner at the top shows the count of overdue schedules. Overdue dates are highlighted in red in the table.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Actions:</strong> Click <strong>Complete</strong> to mark a schedule as done (updates last_completed and recalculates next_due). <strong>"+ New Schedule"</strong> creates a new maintenance schedule linked to an asset with selectable frequency (daily, weekly, monthly, etc.) and optional auto-create work order.</p>
        </Section>

        <Section id="import-export" title="Import / Export">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>The <strong>Import/Export</strong> tab provides two side-by-side panels:</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Export:</strong> Click to download CSV files for Assets, Work Orders, or Costs. Files download automatically.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Import:</strong> Download the CSV template first, fill it with your data, then paste the CSV content into the text area and click <strong>Import CSV</strong>. Success/error feedback is shown inline.</p>
        </Section>

        <Section id="qr-batch" title="QR Batch Labels">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>The <strong>QR Batch</strong> tab lets you generate printable QR code labels for multiple assets at once. Search or browse assets, check the boxes for the ones you need, then click <strong>Generate PDF</strong>. The PDF contains QR codes in a 3×4 grid layout with asset names and codes printed below each QR code.</p>
        </Section>

        <Section id="notifications" title="Notifications">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Three notification channels fire automatically on job assignment and status changes:</p>
          <ul style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 20 }}>
            <li><strong>In-app:</strong> Notification history within the web apps</li>
            <li><strong>Web Push:</strong> Browser notifications on supported devices (Android Chrome, iOS PWA)</li>
            <li><strong>Pushover:</strong> Reliable iOS/Android push via Pushover app (configured server-side, requires Pushover app on phone)</li>
          </ul>
        </Section>

        <Section id="permissions" title="Permissions">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>The permissions system lets you control which non-admin users can view and edit each area of the admin portal. Admin users have full access to everything by default.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Available resources:</strong> Dashboard, Assets, Work Orders, Requests, Customers, Contractors, Locations, Activity, Users.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>To manage permissions: navigate to <strong>Users</strong> page → select a user → use the <strong>View</strong>/<strong>Edit</strong> toggles in the matrix grid for each resource. The <strong>"Seed Manager Defaults"</strong> button fills in sensible defaults for manager roles. Changes take effect on next login or page refresh.</p>
        </Section>

        <Section id="users" title="User Management">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Manage user accounts from the <strong>Users</strong> page in the nav bar.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Create a user:</strong> Enter Email, Password, and select Role (admin/manager/user/contractor). Edit an existing user's role from the dropdown on their row.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Delete vs Archive:</strong> Delete removes the user permanently. Archive performs a soft delete — the user is disabled but their record is kept.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Profile editing:</strong> Click a user to edit their contact name, phone, email, and address. The address field includes autocomplete lookup — type an address and select from suggestions.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}><strong>Permissions:</strong> Set per-user permissions from the matrix grid (see Permissions section). Search users by email.</p>
        </Section>

        <Section id="auto-provisioning" title="Invite &amp; Auto-Provisioning">
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>After creating a user, click <strong>Send Invite</strong> to email them a magic link. The link allows automatic login without entering a password.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>When a contractor clicks the link, they are auto-accepted and redirected to the mobile app, already logged in. On iOS, open the link in Safari for full PWA install support.</p>
          <p style={{ fontSize: 13, lineHeight: 1.7 }}>Invite links expire in 7 days. Click <strong>Send Invite</strong> again to resend if the link has expired.</p>
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
