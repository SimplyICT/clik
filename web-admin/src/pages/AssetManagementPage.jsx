import { useState, useEffect, useCallback } from 'react';
import { getUser, isAdmin, q, canView, canEdit } from '../api/client';

const AP = '/api/asset-management';

function storage() {
  return localStorage.getItem('_remember') === 'true' ? localStorage : sessionStorage;
}
function authHeaders() {
  const t = storage().getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function assetApi(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...authHeaders(), ...opts.headers };
  const res = await fetch(`${AP}${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 200));
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const CATEGORIES = ['HVAC', 'Electrical', 'Plumbing', 'Fire', 'Security', 'Building', 'IT', 'Other'];
const STATUSES = ['Active', 'Under Maintenance', 'Out of Service', 'Retired'];
const FIELD_TYPES = ['text', 'number', 'date', 'select', 'boolean'];

const EMPTY_ASSET = {
  assetName: '', assetCode: '', category: '', subCategory: '', status: 'Active',
  criticality: 'Medium', manufacturer: '', model: '', serialNumber: '',
  customerId: '', customerName: '', customerLocationId: '', customerLocationName: '',
  contractorId: '', contractorName: '',
  installDate: '', purchaseDate: '', warrantyExpiryDate: '',
  lastServiceDate: '', nextServiceDate: '', notes: '',
  purchaseCost: '', replacementValue: '', depreciationMethod: 'none', usefulLifeYears: '',
  locationName: '', hoursRun: '', meterReading: '',
};

function statusBadge(s) {
  const colors = { Active: '#22c55e', 'Under Maintenance': '#f59e0b', 'Out of Service': '#ef4444', Retired: '#94a3b8' };
  return (
    <span style={{ background: colors[s] || '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s}
    </span>
  );
}

function Fi({ label, v, s, type = 'text', error, placeholder }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</label>
      <input type={type} value={v} onChange={e => s(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: error ? '1px solid #ef4444' : '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
      {error && <span style={{ color: '#ef4444', fontSize: 11 }}>{error}</span>}
    </div>
  );
}

export default function AssetManagementPage() {
  const user = getUser();
  const admin = isAdmin();
  const isManager = admin || canView('assets');
  const [tab, setTab] = useState(0);

  const tabs = [
    { label: 'All Assets', component: <AllAssetsTab key="a" admin={admin} isManager={isManager} /> },
    { label: 'Parts Inventory', component: <PartsTab key="p" /> },
  ];
  if (canEdit('assets')) tabs.push({ label: 'Custom Fields', component: <CustomFieldsTab key="c" admin={admin} /> });
  if (admin) tabs.push({ label: 'Audit Log', component: <AuditLogTab key="l" /> });
  if (canView('work_orders')) tabs.push({ label: 'Work Orders', component: <WorkOrdersTab key="w" admin={admin} /> });
  if (canEdit('assets')) tabs.push({ label: 'Maintenance', component: <MaintenanceTab key="m" admin={admin} /> });
  if (canEdit('assets')) tabs.push({ label: 'Import/Export', component: <ImportExportTab key="ie" admin={admin} /> });
  if (canEdit('assets')) tabs.push({ label: 'QR Batch', component: <QRBatchTab key="qr" /> });
  if (canView('assets')) tabs.push({ label: 'Cost History', component: <CostHistoryTab key="ch" /> });

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Asset Management</h2>
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid #e0e0e0' }}>
        {tabs.map((t, i) => (
          <button key={t.label} onClick={() => setTab(i)}
            style={{
              padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: i === tab ? '#00d4ff' : '#888', borderBottom: i === tab ? '2px solid #00d4ff' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs[tab]?.component}
    </div>
  );
}

/* ─────────────── Tab 1: All Assets ─────────────── */
function AllAssetsTab({ isManager }) {
  const [assets, setAssets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [customerLocs, setCustomerLocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [custFilter, setCustFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // add | edit | view
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_ASSET });
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobAsset, setJobAsset] = useState(null);
  const [jobForm, setJobForm] = useState({ title: '', description: '', priority: 'medium', contractorId: '', serviceType: 'General Maintenance' });
  const [showQr, setShowQr] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (catFilter) params.set('category', catFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (custFilter) params.set('customer_id', custFilter);
      if (search) params.set('search', search);
      const [a, c, conts, locs] = await Promise.all([
        assetApi(`/assets?${params}`),
        q('customers', { select: 'id,name', order: 'name.asc' }),
        q('contractors', { select: 'id,companyName', order: 'companyName.asc' }).catch(() => []),
        q('customerLocations', { select: 'id,companyName,customerId', limit: 500 }).catch(() => []),
      ]);
      setAssets(a || []);
      setCustomers(c || []);
      setContractors(conts || []);
      setCustomerLocs(locs || []);
    } catch (err) { setLoadError(err.message); }
    setLoading(false);
  }, [search, catFilter, statusFilter, custFilter]);

  useEffect(() => { load(); }, [load]);

  const locsForCustomer = form.customerId ? customerLocs.filter(l => l.customerId === form.customerId) : [];

  const openAdd = () => {
    setForm({ ...EMPTY_ASSET });
    setEditId(null);
    setModalMode('add');
    setShowModal(true);
  };

  const openEdit = (a) => {
    setForm({
      assetName: a.assetName || '', assetCode: a.assetCode || '',
      category: a.category || '', subCategory: a.subCategory || '',
      status: a.status || 'Active', criticality: a.criticality || 'Medium',
      manufacturer: a.manufacturer || '', model: a.model || '', serialNumber: a.serialNumber || '',
      customerId: a.customerId || '', customerName: a.customerName || '',
      customerLocationId: a.customerLocationId || '', customerLocationName: a.customerLocationName || '',
      contractorId: a.contractorId || '', contractorName: a.contractorName || '',
      installDate: a.installDate ? a.installDate.slice(0, 10) : '',
      purchaseDate: a.purchaseDate ? a.purchaseDate.slice(0, 10) : '',
      warrantyExpiryDate: a.warrantyExpiryDate ? a.warrantyExpiryDate.slice(0, 10) : '',
      lastServiceDate: a.lastServiceDate ? a.lastServiceDate.slice(0, 10) : '',
      nextServiceDate: a.nextServiceDate ? a.nextServiceDate.slice(0, 10) : '',
      notes: a.notes || '',
      purchaseCost: a.purchaseCost ?? '', replacementValue: a.replacementValue ?? '',
      depreciationMethod: a.depreciationMethod || 'none', usefulLifeYears: a.usefulLifeYears ?? '',
      locationName: a.locationName || '', hoursRun: a.hoursRun ?? '', meterReading: a.meterReading ?? '',
    });
    setEditId(a.id);
    setModalMode('edit');
    setShowModal(true);
  };

  const openView = (a) => {
    setForm(a);
    setModalMode('view');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.assetName.trim() || !form.assetCode.trim()) {
      alert('Asset name and code are required');
      return;
    }
    try {
      const sanitize = (d) => d || null;
      const payload = {
        assetName: form.assetName, assetCode: form.assetCode,
        category: form.category, subCategory: form.subCategory,
        status: form.status, criticality: form.criticality,
        manufacturer: form.manufacturer, model: form.model, serialNumber: form.serialNumber,
        customerId: form.customerId || null, customerName: form.customerName,
        customerLocationId: form.customerLocationId || null, customerLocationName: form.customerLocationName,
        contractorId: form.contractorId || null, contractorName: form.contractorName,
        installDate: sanitize(form.installDate), purchaseDate: sanitize(form.purchaseDate),
        warrantyExpiryDate: sanitize(form.warrantyExpiryDate),
        lastServiceDate: sanitize(form.lastServiceDate), nextServiceDate: sanitize(form.nextServiceDate),
        notes: form.notes,
        purchaseCost: form.purchaseCost || null, replacementValue: form.replacementValue || null,
        depreciationMethod: form.depreciationMethod || 'none', usefulLifeYears: form.usefulLifeYears || null,
        locationName: form.locationName || null, hoursRun: form.hoursRun || null, meterReading: form.meterReading || null,
      };
      if (editId) {
        await assetApi(`/assets/${editId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await assetApi('/assets', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowModal(false);
      load();
    } catch (err) { alert('Save failed: ' + err.message); }
  };

  const handleRetire = async (a) => {
    if (!confirm(`Retire asset "${a.assetName}"?`)) return;
    try {
      await assetApi(`/assets/${a.id}/retire`, { method: 'POST' });
      load();
    } catch (err) { alert('Retire failed: ' + err.message); }
  };

  const openCreateJob = (a) => {
    setJobAsset(a);
    setJobForm({ title: `Job for ${a.assetName}`, description: '', priority: 'medium', contractorId: '', serviceType: 'General Maintenance' });
    setShowJobModal(true);
  };

  const handleCreateJob = async () => {
    if (!jobForm.title.trim()) { alert('Job title is required'); return; }
    try {
      await assetApi(`/assets/${jobAsset.id}/create-job`, { method: 'POST', body: JSON.stringify(jobForm) });
      setShowJobModal(false);
      alert('Job created successfully');
    } catch (err) { alert('Create job failed: ' + err.message); }
  };

  const showQrCode = async (a) => {
    setShowQr(a);
    setQrData(null);
    try {
      const t = storage().getItem('token');
      const res = await fetch(`${AP}/assets/${a.id}/qr`, { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error('Failed to load QR');
      const blob = await res.blob();
      setQrData(URL.createObjectURL(blob));
    } catch (err) { alert(err.message); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading assets...</div>;
  if (loadError) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Failed to load assets: {loadError}</div>;

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search by name, code, serial..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, flex: 1, minWidth: 200 }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={custFilter} onChange={e => setCustFilter(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
          <option value="">All Customers</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={openAdd} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
          + Add Asset
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Asset Code</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Name</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Category</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Customer</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Contractor</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>QR</th>
              <th style={{ width: 160 }}></th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#888' }}>No assets found</td></tr>
            )}
            {assets.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{a.assetCode || '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{a.assetName || '-'}</td>
                <td style={{ padding: '10px 14px', color: '#666', fontSize: 13 }}>{a.category || '-'}</td>
                <td style={{ padding: '10px 14px' }}>{statusBadge(a.status)}</td>
                <td style={{ padding: '10px 14px', color: '#666', fontSize: 13 }}>{a.customerName || '-'}</td>
                <td style={{ padding: '10px 14px', color: '#666', fontSize: 13 }}>{a.contractorName || '-'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <button onClick={() => showQrCode(a)} title="View QR Code"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 2 }}>
                    ◈
                  </button>
                </td>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openView(a)} style={btnSmall}>View</button>
                  <button onClick={() => openEdit(a)} style={btnSmall}>Edit</button>
                  {a.status !== 'Retired' && (
                    <>
                      <button onClick={() => openCreateJob(a)} style={btnSmall}>+Job</button>
                      <button onClick={() => handleRetire(a)} style={{ ...btnSmall, color: '#ef4444' }}>Retire</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit/View Modal */}
      {showModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, width: 600 }}>
            <div style={modalHeader}>
              <h3 style={{ fontSize: 16 }}>{modalMode === 'view' ? 'Asset Details' : editId ? 'Edit Asset' : 'Add Asset'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 20, maxHeight: '65vh', overflow: 'auto' }}>
              {modalMode === 'view' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                  <div><strong>Asset Code:</strong> {form.assetCode || '-'}</div>
                  <div><strong>Name:</strong> {form.assetName || '-'}</div>
                  <div><strong>Category:</strong> {form.category || '-'}</div>
                  <div><strong>Sub Category:</strong> {form.subCategory || '-'}</div>
                  <div><strong>Status:</strong> {statusBadge(form.status)}</div>
                  <div><strong>Criticality:</strong> {form.criticality || '-'}</div>
                  <div><strong>Serial #:</strong> {form.serialNumber || '-'}</div>
                  <div><strong>Manufacturer:</strong> {form.manufacturer || '-'}</div>
                  <div><strong>Model:</strong> {form.model || '-'}</div>
                  <div><strong>Customer:</strong> {form.customerName || '-'}</div>
                  <div><strong>Location:</strong> {form.customerLocationName || '-'}</div>
                  <div><strong>Contractor:</strong> {form.contractorName || '-'}</div>
                  <div><strong>Install Date:</strong> {form.installDate ? form.installDate.slice(0, 10) : '-'}</div>
                  <div><strong>Purchase Date:</strong> {form.purchaseDate ? form.purchaseDate.slice(0, 10) : '-'}</div>
                  <div><strong>Warranty:</strong> {form.warrantyExpiryDate ? form.warrantyExpiryDate.slice(0, 10) : '-'}</div>
                  <div><strong>Last Service:</strong> {form.lastServiceDate ? form.lastServiceDate.slice(0, 10) : '-'}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong>Next Service:</strong> {form.nextServiceDate ? form.nextServiceDate.slice(0, 10) : '-'}</div>
                  {form.notes && <div style={{ gridColumn: '1 / -1' }}><strong>Notes:</strong><br />{form.notes}</div>}
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>Financial & Metering</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div><strong>Purchase Cost:</strong> {form.purchaseCost ? `$${form.purchaseCost}` : '-'}</div>
                      <div><strong>Replacement Value:</strong> {form.replacementValue ? `$${form.replacementValue}` : '-'}</div>
                      <div><strong>Depreciation:</strong> {form.depreciationMethod || 'None'}</div>
                      <div><strong>Useful Life:</strong> {form.usefulLifeYears ? `${form.usefulLifeYears} yrs` : '-'}</div>
                      <div><strong>Location Name:</strong> {form.locationName || '-'}</div>
                      <div><strong>Hours Run:</strong> {form.hoursRun ?? '-'}</div>
                      <div><strong>Meter Reading:</strong> {form.meterReading ?? '-'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Fi label="Asset Code" v={form.assetCode} s={v => setForm({ ...form, assetCode: v })} />
                    <Fi label="Asset Name" v={form.assetName} s={v => setForm({ ...form, assetName: v })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: '#888' }}>Category</label>
                      <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                        <option value="">Select...</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <Fi label="Sub Category" v={form.subCategory} s={v => setForm({ ...form, subCategory: v })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: '#888' }}>Status</label>
                      <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: '#888' }}>Criticality</label>
                      <select value={form.criticality} onChange={e => setForm({ ...form, criticality: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                        {['Low', 'Medium', 'High'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <Fi label="Serial #" v={form.serialNumber} s={v => setForm({ ...form, serialNumber: v })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Fi label="Manufacturer" v={form.manufacturer} s={v => setForm({ ...form, manufacturer: v })} />
                    <Fi label="Model" v={form.model} s={v => setForm({ ...form, model: v })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: '#888' }}>Customer</label>
                      <select value={form.customerId} onChange={e => {
                        const c = customers.find(x => x.id === e.target.value);
                        setForm({ ...form, customerId: e.target.value, customerName: c?.name || '', customerLocationId: '', customerLocationName: '' });
                      }} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                        <option value="">Select...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: '#888' }}>Location</label>
                      <select value={form.customerLocationId} onChange={e => {
                        const l = customerLocs.find(x => x.id === e.target.value);
                        setForm({ ...form, customerLocationId: e.target.value, customerLocationName: l?.companyName || '' });
                      }} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                        <option value="">Select...</option>
                        {locsForCustomer.map(l => <option key={l.id} value={l.id}>{l.companyName}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: '#888' }}>Assigned Contractor</label>
                    <select value={form.contractorId} onChange={e => {
                      const ct = contractors.find(x => x.id === e.target.value);
                      setForm({ ...form, contractorId: e.target.value, contractorName: ct?.companyName || '' });
                    }} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                      <option value="">Select...</option>
                      {contractors.map(ct => <option key={ct.id} value={ct.id}>{ct.companyName}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Fi label="Install Date" v={form.installDate} s={v => setForm({ ...form, installDate: v })} type="date" />
                    <Fi label="Purchase Date" v={form.purchaseDate} s={v => setForm({ ...form, purchaseDate: v })} type="date" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Fi label="Warranty Expiry" v={form.warrantyExpiryDate} s={v => setForm({ ...form, warrantyExpiryDate: v })} type="date" />
                    <Fi label="Last Service" v={form.lastServiceDate} s={v => setForm({ ...form, lastServiceDate: v })} type="date" />
                  </div>
                  <Fi label="Next Service" v={form.nextServiceDate} s={v => setForm({ ...form, nextServiceDate: v })} type="date" />
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: '#888' }}>Notes</label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '14px 0' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase' }}>Financial & Metering</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Fi label="Purchase Cost ($)" v={form.purchaseCost} s={v => setForm({ ...form, purchaseCost: v })} type="number" />
                    <Fi label="Replacement Value ($)" v={form.replacementValue} s={v => setForm({ ...form, replacementValue: v })} type="number" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: '#888' }}>Depreciation Method</label>
                      <select value={form.depreciationMethod} onChange={e => setForm({ ...form, depreciationMethod: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                        <option value="none">None</option>
                        <option value="straight_line">Straight Line</option>
                        <option value="declining">Declining Balance</option>
                      </select>
                    </div>
                    <Fi label="Useful Life (years)" v={form.usefulLifeYears} s={v => setForm({ ...form, usefulLifeYears: v })} type="number" />
                  </div>
                  <Fi label="Location Name" v={form.locationName} s={v => setForm({ ...form, locationName: v })} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Fi label="Hours Run" v={form.hoursRun} s={v => setForm({ ...form, hoursRun: v })} type="number" step="0.01" />
                    <Fi label="Meter Reading" v={form.meterReading} s={v => setForm({ ...form, meterReading: v })} type="number" step="0.01" />
                  </div>
                </div>
              )}
            </div>
            {modalMode !== 'view' && (
              <div style={modalFooter}>
                <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
                <button onClick={handleSave} style={btnPrimary}>{editId ? 'Save Changes' : 'Create Asset'}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Job Modal */}
      {showJobModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, width: 420 }}>
            <div style={modalHeader}>
              <h3 style={{ fontSize: 16 }}>Create Job for {jobAsset?.assetName}</h3>
              <button onClick={() => setShowJobModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <Fi label="Title" v={jobForm.title} s={v => setJobForm({ ...jobForm, title: v })} />
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#888' }}>Description</label>
                <textarea value={jobForm.description} onChange={e => setJobForm({ ...jobForm, description: e.target.value })} rows={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#888' }}>Priority</label>
                  <select value={jobForm.priority} onChange={e => setJobForm({ ...jobForm, priority: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                    {['urgent', 'high', 'medium', 'low'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#888' }}>Service Type</label>
                  <select value={jobForm.serviceType} onChange={e => setJobForm({ ...jobForm, serviceType: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                    {['Air Conditioning', 'Cleaning', 'Electrical', 'General Maintenance', 'Painting', 'Plumbing', 'Refrigeration'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#888' }}>Contractor</label>
                <select value={jobForm.contractorId} onChange={e => setJobForm({ ...jobForm, contractorId: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="">Select...</option>
                  {contractors.map(ct => <option key={ct.id} value={ct.id}>{ct.companyName}</option>)}
                </select>
              </div>
            </div>
            <div style={modalFooter}>
              <button onClick={() => setShowJobModal(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleCreateJob} style={btnPrimary}>Create Job</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQr && (
        <div style={modalOverlay} onClick={() => { setShowQr(null); if (qrData) URL.revokeObjectURL(qrData); }}>
          <div style={{ ...modalBox, width: 300, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={{ fontSize: 16 }}>QR Code - {showQr.assetName}</h3>
              <button onClick={() => { setShowQr(null); if (qrData) URL.revokeObjectURL(qrData); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {qrData ? (
                <img src={qrData} alt={`QR for ${showQr.assetName}`} style={{ width: 200, height: 200 }} />
              ) : (
                <div style={{ padding: 40, color: '#888' }}>Loading...</div>
              )}
              <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>{showQr.assetCode}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Tab 2: Parts Inventory ─────────────── */
function PartsTab() {
  const [parts, setParts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', sku: '', quantity: '', minThreshold: '', unit: 'ea', status: 'Active' });
  const [showUsage, setShowUsage] = useState(false);
  const [usageForm, setUsageForm] = useState({ partId: '', requestId: '', quantity: '' });
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, r] = await Promise.all([
        assetApi('/parts'),
        q('requests', { select: 'id,title', order: 'requestStartDate.desc.nullslast', limit: 200 }).catch(() => []),
      ]);
      setParts(p || []);
      setRequests(r || []);
    } catch (err) { setLoadError(err.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ name: '', sku: '', quantity: '', minThreshold: '', unit: 'ea', status: 'Active' });
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (p) => {
    setForm({
      name: p.name || '', sku: p.sku || '', quantity: String(p.quantity ?? ''),
      minThreshold: String(p.minThreshold ?? ''), unit: p.unit || 'ea', status: p.status || 'Active',
    });
    setEditId(p.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.sku.trim()) { alert('Name and SKU are required'); return; }
    try {
      const payload = {
        name: form.name, sku: form.sku,
        quantity: parseInt(form.quantity) || 0,
        minThreshold: parseInt(form.minThreshold) || 0,
        unit: form.unit, status: form.status,
      };
      if (editId) {
        await assetApi(`/parts/${editId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await assetApi('/parts', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowModal(false);
      load();
    } catch (err) { alert('Save failed: ' + err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this part? This action cannot be undone.')) return;
    try {
      await assetApi(`/parts/${id}`, { method: 'DELETE' });
      load();
    } catch (err) { alert('Delete failed: ' + err.message); }
  };

  const openRecordUsage = (part) => {
    setUsageForm({ partId: part.id || '', requestId: '', quantity: '' });
    setShowUsage(true);
  };

  const handleRecordUsage = async () => {
    if (!usageForm.quantity || parseInt(usageForm.quantity) <= 0) { alert('Valid quantity required'); return; }
    try {
      await assetApi('/parts/record-usage', {
        method: 'POST',
        body: JSON.stringify({
          partId: usageForm.partId,
          requestId: usageForm.requestId || null,
          quantity: parseInt(usageForm.quantity),
        }),
      });
      setShowUsage(false);
      load();
    } catch (err) { alert('Record usage failed: ' + err.message); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading parts...</div>;
  if (loadError) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Failed to load parts: {loadError}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: '#888' }}>{parts.length} parts</span>
        <button onClick={openAdd} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          + Add Part
        </button>
      </div>
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Name</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>SKU</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Quantity</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Min Threshold</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Unit</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Status</th>
              <th style={{ width: 180 }}></th>
            </tr>
          </thead>
          <tbody>
            {parts.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#888' }}>No parts found</td></tr>
            )}
            {parts.map(p => {
              const lowStock = p.minThreshold > 0 && p.quantity < p.minThreshold;
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0', background: lowStock ? '#fef2f2' : 'transparent' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{p.name || '-'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#666' }}>{p.sku || '-'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: lowStock ? 700 : 400, color: lowStock ? '#ef4444' : 'inherit' }}>
                    {p.quantity ?? '-'} {lowStock && <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 4 }}>⚠</span>}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: '#666' }}>{p.minThreshold ?? '-'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#666' }}>{p.unit || '-'}</td>
                  <td style={{ padding: '10px 14px' }}>{statusBadge(p.status)}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openRecordUsage(p)} style={btnSmall}>Use</button>
                    <button onClick={() => openEdit(p)} style={btnSmall}>Edit</button>
                    {canEdit('assets') && (
                      <button onClick={() => handleDelete(p.id)} style={{ ...btnSmall, color: '#ef4444' }}>Delete</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Part Modal */}
      {showModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, width: 420 }}>
            <div style={modalHeader}>
              <h3 style={{ fontSize: 16 }}>{editId ? 'Edit Part' : 'Add Part'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Fi label="Part Name" v={form.name} s={v => setForm({ ...form, name: v })} />
                <Fi label="SKU" v={form.sku} s={v => setForm({ ...form, sku: v })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <Fi label="Quantity" v={form.quantity} s={v => setForm({ ...form, quantity: v })} type="number" />
                <Fi label="Min Threshold" v={form.minThreshold} s={v => setForm({ ...form, minThreshold: v })} type="number" />
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#888' }}>Unit</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                    {['ea', 'kg', 'L', 'm', 'box', 'pack', 'roll'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#888' }}>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="Active">Active</option>
                  <option value="Discontinued">Discontinued</option>
                </select>
              </div>
            </div>
            <div style={modalFooter}>
              <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleSave} style={btnPrimary}>{editId ? 'Save' : 'Add Part'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Record Usage Modal */}
      {showUsage && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, width: 380 }}>
            <div style={modalHeader}>
              <h3 style={{ fontSize: 16 }}>Record Part Usage</h3>
              <button onClick={() => setShowUsage(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#888' }}>Part</label>
                <select value={usageForm.partId} onChange={e => setUsageForm({ ...usageForm, partId: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="">Select part...</option>
                  {parts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#888' }}>Job / Request</label>
                <select value={usageForm.requestId} onChange={e => setUsageForm({ ...usageForm, requestId: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="">Select (optional)...</option>
                  {requests.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
              <Fi label="Quantity Used" v={usageForm.quantity} s={v => setUsageForm({ ...usageForm, quantity: v })} type="number" />
            </div>
            <div style={modalFooter}>
              <button onClick={() => setShowUsage(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleRecordUsage} style={btnPrimary}>Record Usage</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Tab 3: Custom Fields ─────────────── */
function CustomFieldsTab({ admin }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: '', fieldName: '', fieldLabel: '', fieldType: 'text', options: '' });
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const d = await assetApi('/custom-fields');
      setFields(d || []);
    } catch (err) { setLoadError(err.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = [...new Set(fields.map(f => f.category).filter(Boolean))];

  const handleAdd = async () => {
    if (!form.category.trim() || !form.fieldName.trim() || !form.fieldLabel.trim()) {
      alert('Category, field name, and field label are required');
      return;
    }
    try {
      const payload = {
        category: form.category,
        fieldName: form.fieldName,
        fieldLabel: form.fieldLabel,
        fieldType: form.fieldType,
        options: form.fieldType === 'select' ? form.options : null,
      };
      await assetApi('/custom-fields', { method: 'POST', body: JSON.stringify(payload) });
      setShowAdd(false);
      setForm({ category: '', fieldName: '', fieldLabel: '', fieldType: 'text', options: '' });
      load();
    } catch (err) { alert('Add failed: ' + err.message); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading custom fields...</div>;
  if (loadError) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Failed to load custom fields: {loadError}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: '#888' }}>{fields.length} fields defined</span>
        <button onClick={() => setShowAdd(true)} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          + Add Field
        </button>
      </div>

      {categories.length === 0 && fields.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 8 }}>No custom fields defined yet.</div>
      )}

      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, color: '#1a1a2e', marginBottom: 8, padding: '0 4px' }}>{cat}</h4>
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Field Name</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Label</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Options</th>
                </tr>
              </thead>
              <tbody>
                {fields.filter(f => f.category === cat).map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600 }}>{f.fieldName}</td>
                    <td style={{ padding: '8px 14px', fontSize: 13 }}>{f.fieldLabel}</td>
                    <td style={{ padding: '8px 14px', fontSize: 13, color: '#666' }}>{f.fieldType}</td>
                    <td style={{ padding: '8px 14px', fontSize: 13, color: '#666' }}>{f.options || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Uncategorized fields */}
      {fields.filter(f => !f.category).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, color: '#1a1a2e', marginBottom: 8, padding: '0 4px' }}>Uncategorized</h4>
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Field Name</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Label</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Options</th>
                </tr>
              </thead>
              <tbody>
                {fields.filter(f => !f.category).map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600 }}>{f.fieldName}</td>
                    <td style={{ padding: '8px 14px', fontSize: 13 }}>{f.fieldLabel}</td>
                    <td style={{ padding: '8px 14px', fontSize: 13, color: '#666' }}>{f.fieldType}</td>
                    <td style={{ padding: '8px 14px', fontSize: 13, color: '#666' }}>{f.options || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Field Modal */}
      {showAdd && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, width: 420 }}>
            <div style={modalHeader}>
              <h3 style={{ fontSize: 16 }}>Add Custom Field</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Fi label="Category" v={form.category} s={v => setForm({ ...form, category: v })} placeholder="e.g. HVAC" />
                <Fi label="Field Name" v={form.fieldName} s={v => setForm({ ...form, fieldName: v })} placeholder="e.g. btu_rating" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Fi label="Field Label" v={form.fieldLabel} s={v => setForm({ ...form, fieldLabel: v })} placeholder="e.g. BTU Rating" />
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#888' }}>Field Type</label>
                  <select value={form.fieldType} onChange={e => setForm({ ...form, fieldType: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {form.fieldType === 'select' && (
                <Fi label="Options (comma-separated)" v={form.options} s={v => setForm({ ...form, options: v })} placeholder="opt1, opt2, opt3" />
              )}
            </div>
            <div style={modalFooter}>
              <button onClick={() => setShowAdd(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleAdd} style={btnPrimary}>Add Field</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Tab 4: Audit Log ─────────────── */
function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await assetApi('/audit');
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) { setLoadError(err.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading audit log...</div>;
  if (loadError) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Failed to load audit log: {loadError}</div>;

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 14, color: '#888' }}>Real asset audit trail from API</div>
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Event</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Asset</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Actor</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Date</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#888' }}>No audit events found</td></tr>
            )}
            {logs.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    background: e.event_type === 'created' ? '#22c55e' : e.event_type === 'retired' || e.event_type === 'deleted' ? '#ef4444' : '#f59e0b',
                    color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  }}>
                    {e.event_type ? e.event_type.replace(/_/g, ' ') : '-'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{e.asset_id ? e.asset_id.slice(0, 8) + '...' : '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{e.actor_name || e.actor_id || '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: '#666' }}>{e.created_at ? new Date(e.created_at).toLocaleString() : '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: '#666' }}>{typeof e.details === 'object' ? JSON.stringify(e.details) : e.details || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────── Tab: Work Orders ─────────────── */
function WorkOrdersTab({ admin }) {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const qs = params.toString();
      const data = await assetApi(`/work-orders${qs ? '?' + qs : ''}`);
      setAll(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load work orders');
    }
    setLoading(false);
  }, [statusFilter, typeFilter, priorityFilter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (wo, newStatus) => {
    setUpdateLoading(true);
    try {
      await assetApi(`/work-orders/${wo.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      setSelected(null);
      load();
    } catch (err) {
      alert('Update failed: ' + err.message);
    }
    setUpdateLoading(false);
  };

  const kanbanColumns = [
    { key: 'pending', label: 'Pending', color: '#94a3b8' },
    { key: 'in_progress', label: 'In Progress', color: '#3b82f6' },
    { key: 'completed', label: 'Completed', color: '#22c55e' },
    { key: 'cancelled', label: 'Cancelled', color: '#ef4444' },
  ];

  const priorityColors = { low: '#94a3b8', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };

  const filtered = all.filter(wo => {
    if (statusFilter && wo.status !== statusFilter) return false;
    if (typeFilter && wo.type !== typeFilter) return false;
    if (priorityFilter && wo.priority !== priorityFilter) return false;
    return true;
  });

  if (loading) return <div className="pulse" style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading work orders...</div>;
  if (error) return <div style={{ padding: 20, background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>{error}</div>;

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#888' }}>{all.length} work orders</span>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
          <option value="">All Types</option>
          <option value="preventive">Preventive</option>
          <option value="reactive">Reactive</option>
          <option value="inspection">Inspection</option>
          <option value="repair">Repair</option>
          <option value="installation">Installation</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {/* Kanban Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24, minHeight: 120 }}>
        {kanbanColumns.map(col => {
          const items = all.filter(wo => wo.status === col.key);
          return (
            <div key={col.key} style={{ background: '#f9f9f9', borderRadius: 8, border: '1px solid #e0e0e0', padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: col.color, marginBottom: 8, textTransform: 'uppercase' }}>
                {col.label} ({items.length})
              </div>
              {items.length === 0 ? (
                <div style={{ color: '#ccc', fontSize: 12, textAlign: 'center', padding: 16 }}>Empty</div>
              ) : (
                items.slice(0, 6).map(wo => (
                  <div key={wo.id} onClick={() => setSelected(wo)}
                    style={{
                      padding: '8px 10px', background: selected?.id === wo.id ? '#f0f7ff' : '#fff',
                      borderRadius: 4, marginBottom: 4, border: '1px solid #e8e8e8', cursor: 'pointer', fontSize: 12,
                    }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{wo.title || 'Untitled'}</div>
                    <div style={{ color: '#888', fontSize: 11, marginTop: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
                      {wo.priority && (
                        <span style={{ background: priorityColors[wo.priority] || '#94a3b8', color: '#fff', padding: '1px 6px', borderRadius: 999, fontSize: 10 }}>
                          {wo.priority}
                        </span>
                      )}
                      {wo.type && <span>{wo.type}</span>}
                    </div>
                  </div>
                ))
              )}
              {items.length > 6 && (
                <div style={{ color: '#888', fontSize: 11, textAlign: 'center', padding: 4 }}>+{items.length - 6} more</div>
              )}
            </div>
          );
        })}
      </div>

      {/* List View */}
      <h4 style={{ fontSize: 14, marginBottom: 8, color: '#444' }}>All Work Orders</h4>
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Priority</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Scheduled</th>
              <th style={thStyle}>Completed</th>
              <th style={thStyle}>Cost</th>
              <th style={{ width: 160, ...thStyle }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#888' }}>No work orders found</td></tr>
            )}
            {filtered.map(wo => (
              <tr key={wo.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={tdStyle}><strong>{wo.title || 'Untitled'}</strong></td>
                <td style={tdStyle}>{wo.type || '-'}</td>
                <td style={tdStyle}>
                  <span style={{ background: priorityColors[wo.priority] || '#94a3b8', color: '#fff', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                    {wo.priority || 'low'}
                  </span>
                </td>
                <td style={tdStyle}>{statusBadge(wo.status)}</td>
                <td style={tdStyle}>{wo.scheduled_date ? new Date(wo.scheduled_date).toLocaleDateString() : '-'}</td>
                <td style={tdStyle}>{wo.completed_date ? new Date(wo.completed_date).toLocaleDateString() : '-'}</td>
                <td style={tdStyle}>{wo.total_cost ? `$${Number(wo.total_cost).toFixed(2)}` : '-'}</td>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                  {wo.status === 'pending' && (
                    <button onClick={() => updateStatus(wo, 'in_progress')} disabled={updateLoading}
                      style={{ ...btnSmall, background: '#3b82f6', color: '#fff', border: 'none' }}>Start</button>
                  )}
                  {wo.status === 'in_progress' && (
                    <button onClick={() => updateStatus(wo, 'completed')} disabled={updateLoading}
                      style={{ ...btnSmall, background: '#22c55e', color: '#fff', border: 'none' }}>Complete</button>
                  )}
                  {(wo.status === 'pending' || wo.status === 'in_progress') && (
                    <button onClick={() => updateStatus(wo, 'cancelled')} disabled={updateLoading}
                      style={{ ...btnSmall, color: '#ef4444' }}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' };
const tdStyle = { padding: '10px 14px', fontSize: 13 };

/* ─────────────── Tab: Maintenance ─────────────── */
function MaintenanceTab({ admin }) {
  const [schedules, setSchedules] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [form, setForm] = useState({
    asset_id: '', title: '', description: '', frequency_type: 'monthly',
    frequency_value: '1', auto_create_work_order: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedData, assetData] = await Promise.all([
        assetApi('/maintenance'),
        assetApi('/assets'),
      ]);
      setSchedules(Array.isArray(schedData) ? schedData : []);
      setAssets(Array.isArray(assetData) ? assetData : []);
    } catch (err) {
      setError(err.message || 'Failed to load maintenance data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const groups = { overdue: [], thisMonth: [], nextMonth: [], future: [] };
  schedules.forEach(s => {
    const due = s.next_due ? new Date(s.next_due) : null;
    if (!due) { groups.future.push(s); return; }
    if (due < now) { groups.overdue.push(s); return; }
    if (due <= in30Days) { groups.thisMonth.push(s); return; }
    if (due <= in60Days) { groups.nextMonth.push(s); return; }
    groups.future.push(s);
  });

  const freqLabels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually', hours_run: 'Hours Run' };

  const handleComplete = async (sched) => {
    setActionLoading(sched.id);
    try {
      await assetApi(`/maintenance/${sched.id}/complete`, { method: 'POST' });
      load();
    } catch (err) {
      alert('Failed to complete: ' + err.message);
    }
    setActionLoading(null);
  };

  const handleCreate = async () => {
    if (!form.asset_id || !form.title.trim()) {
      alert('Asset and title are required');
      return;
    }
    setCreating(true);
    try {
      await assetApi('/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          frequency_type: form.frequency_type,
          frequency_value: parseInt(form.frequency_value) || 1,
          auto_create_work_order: form.auto_create_work_order,
        }),
      });
      setShowCreate(false);
      setForm({ asset_id: '', title: '', description: '', frequency_type: 'monthly', frequency_value: '1', auto_create_work_order: false });
      load();
    } catch (err) {
      alert('Create failed: ' + err.message);
    }
    setCreating(false);
  };

  const assetName = (id) => assets.find(a => a.id === id)?.asset_name || id?.slice(0, 8) || 'Unknown';

  if (loading) return <div className="pulse" style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading maintenance schedules...</div>;
  if (error) return <div style={{ padding: 20, background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>{error}</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: '#888' }}>{schedules.length} schedules · {groups.overdue.length} overdue</span>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ New Schedule</button>
      </div>

      {/* Overdue Alert */}
      {groups.overdue.length > 0 && (
        <div style={{ padding: 12, background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 16 }}>⚠</span>
          <span style={{ color: '#991b1b', fontSize: 13 }}><strong>{groups.overdue.length}</strong> maintenance schedule{groups.overdue.length > 1 ? 's' : ''} overdue</span>
        </div>
      )}

      {/* Schedule Groups */}
      {[
        { key: 'overdue', label: 'Overdue', items: groups.overdue, color: '#ef4444' },
        { key: 'thisMonth', label: 'Due Within 30 Days', items: groups.thisMonth, color: '#f59e0b' },
        { key: 'nextMonth', label: 'Due Within 60 Days', items: groups.nextMonth, color: '#3b82f6' },
        { key: 'future', label: 'Future', items: groups.future, color: '#94a3b8' },
      ].map(group => group.items.length > 0 && (
        <div key={group.key} style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, color: group.color, marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>
            {group.label} ({group.items.length})
          </h4>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e0e0e0', background: '#f9f9f9' }}>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Asset</th>
                  <th style={thStyle}>Frequency</th>
                  <th style={thStyle}>Next Due</th>
                  <th style={thStyle}>Last Completed</th>
                  <th style={thStyle}>Auto WO</th>
                  <th style={{ width: 140, ...thStyle }}></th>
                </tr>
              </thead>
              <tbody>
                {group.items.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={tdStyle}><strong>{s.title}</strong></td>
                    <td style={tdStyle}>{assetName(s.asset_id)}</td>
                    <td style={tdStyle}>{freqLabels[s.frequency_type] || s.frequency_type} {s.frequency_value ? `(every ${s.frequency_value})` : ''}</td>
                    <td style={{ ...tdStyle, color: s.next_due && new Date(s.next_due) < now ? '#ef4444' : 'inherit', fontWeight: s.next_due && new Date(s.next_due) < now ? 700 : 400 }}>
                      {s.next_due ? new Date(s.next_due).toLocaleDateString() : '-'}
                    </td>
                    <td style={tdStyle}>{s.last_completed ? new Date(s.last_completed).toLocaleDateString() : '-'}</td>
                    <td style={tdStyle}>{s.auto_create_work_order ? '✓' : '-'}</td>
                    <td style={{ padding: '4px 10px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => handleComplete(s)} disabled={actionLoading === s.id}
                        style={{ ...btnSmall, background: '#22c55e', color: '#fff', border: 'none' }}>
                        {actionLoading === s.id ? '...' : 'Complete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {schedules.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
          No maintenance schedules yet. Create one to get started.
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, width: 460 }}>
            <div style={modalHeader}>
              <h3 style={{ fontSize: 16 }}>New Maintenance Schedule</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#888' }}>Asset</label>
                <select value={form.asset_id} onChange={e => setForm({ ...form, asset_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="">Select asset...</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.asset_name} ({a.asset_code})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Fi label="Title" v={form.title} s={v => setForm({ ...form, title: v })} />
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#888' }}>Frequency</label>
                  <select value={form.frequency_type} onChange={e => setForm({ ...form, frequency_type: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                    {Object.entries(freqLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Fi label="Every (N)" v={form.frequency_value} s={v => setForm({ ...form, frequency_value: v })} type="number" />
                <div style={{ marginBottom: 10, display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.auto_create_work_order}
                      onChange={e => setForm({ ...form, auto_create_work_order: e.target.checked })} />
                    Auto-create work order
                  </label>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#888' }}>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
            </div>
            <div style={modalFooter}>
              <button onClick={() => setShowCreate(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleCreate} disabled={creating} style={btnPrimary}>{creating ? 'Creating...' : 'Create Schedule'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Tab: Import/Export ─────────────── */
function ImportExportTab({ admin }) {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [csvText, setCsvText] = useState('');

  const exportTypes = [
    { label: 'Assets', type: 'assets', filename: 'assets-export.csv', color: '#3b82f6' },
    { label: 'Work Orders', type: 'work_orders', filename: 'work-orders-export.csv', color: '#8b5cf6' },
    { label: 'Costs', type: 'costs', filename: 'costs-export.csv', color: '#7c3aed' },
  ];

  const handleExport = async (type, filename) => {
    try {
      const res = await fetch(`${AP}/reports/export?type=${type}`, { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch(`${AP}/reports/import/template`, { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'import-template.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Template download failed: ' + err.message);
    }
  };

  const handleImport = async () => {
    if (!csvText.trim()) { alert('Paste CSV data first'); return; }
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await fetch(`${AP}/reports/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ csv_content: csvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.detail || 'Import failed');
      setUploadResult({ success: true, message: data?.message || `Imported ${data?.imported || 0} rows` });
      setCsvText('');
    } catch (err) {
      setUploadResult({ success: false, message: err.message });
    }
    setUploading(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Export */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', padding: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Export Data</h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Download asset data as CSV files.</p>
        {exportTypes.map(et => (
          <button key={et.type} onClick={() => handleExport(et.type, et.filename)}
            style={{ display: 'block', width: '100%', padding: '12px 16px', marginBottom: 8, borderRadius: 6, border: `1px solid ${et.color}`, background: `${et.color}10`, cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 600, color: et.color }}>
            Export {et.label} CSV ↗
          </button>
        ))}
      </div>

      {/* Import */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', padding: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Import Data</h3>
        <div style={{ marginBottom: 12 }}>
          <button onClick={handleDownloadTemplate}
            style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #00d4ff', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#00d4ff' }}>
            Download CSV Template ↓
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Paste CSV data below to import assets.</p>
        <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={8}
          placeholder="assetName,assetCode,category,status,..."
          style={{ width: '100%', padding: '10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical', marginBottom: 12 }} />
        <button onClick={handleImport} disabled={uploading || !csvText.trim()}
          style={{ padding: '10px 20px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: uploading || !csvText.trim() ? 0.5 : 1 }}>
          {uploading ? 'Importing...' : 'Import CSV'}
        </button>
        {uploadResult && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 4, background: uploadResult.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${uploadResult.success ? '#bbf7d0' : '#fecaca'}`, fontSize: 13, color: uploadResult.success ? '#16a34a' : '#dc2626' }}>
            {uploadResult.message}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Tab: Cost History ──────────── */
function CostHistoryTab() {
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [assetId, setAssetId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [costList, sum] = await Promise.all([
        assetId ? assetApi(`/assets/${assetId}/costs`) : Promise.resolve([]),
        assetApi('/costs/summary').catch(() => null),
      ]);
      setCosts(Array.isArray(costList) ? costList : []);
      setSummary(sum);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
          {summary.map(s => (
            <div key={s.cost_type} style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e0e0e0', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>${(s.total || 0).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'capitalize', marginTop: 2 }}>{s.cost_type} (x{s.count})</div>
            </div>
          ))}
        </div>
      )}
      <input placeholder="Filter by Asset ID (optional)" value={assetId} onChange={e => setAssetId(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }} />
      {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading...</div> : costs.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>{assetId ? 'No costs recorded for this asset' : 'Enter an Asset ID above to view costs'}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Amount</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Description</th>
            </tr></thead>
            <tbody>
              {costs.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{c.recorded_date ? c.recorded_date.slice(0, 10) : '-'}</td>
                  <td style={{ padding: '8px', textTransform: 'capitalize' }}>{c.cost_type}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>${(c.amount || 0).toFixed(2)}</td>
                  <td style={{ padding: '8px' }}>{c.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Tab: QR Batch ─────────────── */
function QRBatchTab() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await assetApi('/assets');
      setAssets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load assets for QR batch:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAll = () => {
    const all = {};
    filtered.forEach(a => { all[a.id] = true; });
    setSelected(all);
  };

  const clearAll = () => setSelected({});

  const filtered = assets.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (a.asset_name || '').toLowerCase().includes(q)
        || (a.asset_code || '').toLowerCase().includes(q)
        || (a.serial_number || '').toLowerCase().includes(q);
  });

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleGenerate = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) { alert('Select at least one asset'); return; }
    setGenerating(true);
    try {
      const res = await fetch(`${AP}/qr/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ asset_ids: ids }),
      });
      if (!res.ok) throw new Error('Failed to generate QR PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `qr-labels-${ids.length}-assets.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Generation failed: ' + err.message);
    }
    setGenerating(false);
  };

  if (loading) return <div className="pulse" style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading assets...</div>;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, flex: 1, minWidth: 200 }} />
        <button onClick={selectAll} style={btnSecondary}>Select All</button>
        <button onClick={clearAll} style={btnSecondary}>Clear</button>
        <button onClick={handleGenerate} disabled={generating || selectedCount === 0}
          style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: generating || selectedCount === 0 ? 0.5 : 1 }}>
          {generating ? 'Generating...' : `Generate PDF (${selectedCount})`}
        </button>
      </div>

      {/* Asset Table */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ width: 40, padding: '10px 14px' }}>
                <input type="checkbox" onChange={e => e.target.checked ? selectAll() : clearAll()}
                  checked={filtered.length > 0 && filtered.every(a => selected[a.id])} />
              </th>
              <th style={thStyle}>Asset Code</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Serial #</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#888' }}>No assets found</td></tr>
            )}
            {filtered.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0', background: selected[a.id] ? '#f0f7ff' : 'transparent', cursor: 'pointer' }}
                onClick={() => toggle(a.id)}>
                <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={!!selected[a.id]} onChange={() => toggle(a.id)} />
                </td>
                <td style={tdStyle}><strong>{a.asset_code || '-'}</strong></td>
                <td style={tdStyle}>{a.asset_name || '-'}</td>
                <td style={tdStyle}>{a.category || '-'}</td>
                <td style={tdStyle}>{statusBadge(a.status)}</td>
                <td style={tdStyle}>{a.customer_name || '-'}</td>
                <td style={tdStyle}>{a.serial_number || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Shared style objects ──────────────────────────── */
const modalOverlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', zIndex: 100,
};
const modalBox = {
  background: '#fff', borderRadius: 8, maxHeight: '90vh', overflow: 'auto',
};
const modalHeader = {
  padding: '16px 20px', borderBottom: '1px solid #e0e0e0',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const modalFooter = {
  padding: '12px 20px', borderTop: '1px solid #e0e0e0',
  display: 'flex', justifyContent: 'flex-end', gap: 8,
};
const btnPrimary = {
  padding: '8px 16px', borderRadius: 4, border: 'none',
  background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13,
};
const btnSecondary = {
  padding: '8px 16px', borderRadius: 4, border: '1px solid #ddd',
  cursor: 'pointer', fontSize: 13, background: '#fff',
};
const btnSmall = {
  padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd',
  cursor: 'pointer', fontSize: 11, background: '#fff', marginRight: 4,
};
