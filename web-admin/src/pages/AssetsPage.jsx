import { useState, useEffect, useCallback } from 'react';
import { q, create, update } from '../api/client';

const CATEGORIES = ['HVAC','Electrical','Plumbing','Fire','Security','Building','IT','Other'];
const STATUSES = ['Active','Under Maintenance','Out of Service','Retired'];
const CRITICALITY = ['Low','Medium','High'];

const EMPTY = { assetName: '', assetCode: '', category: '', subCategory: '', status: 'Active',
  criticality: 'Medium', manufacturer: '', model: '', serialNumber: '',
  customerId: '', customerName: '', customerLocationId: '', customerLocationName: '',
  installDate: '', purchaseDate: '', warrantyExpiryDate: '',
  lastServiceDate: '', nextServiceDate: '', notes: '' };

export default function AssetsPage() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerLocs, setCustomerLocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });

  const load = useCallback(async () => {
    const [a, c, l] = await Promise.all([
      q('assets', { select: '*', order: 'assetName.asc.nullslast', limit: 100 }),
      q('customers', { select: 'id,name', order: 'name.asc' }),
      q('customerLocations', { select: 'id,companyName,customerId', limit: 200 }),
    ]);
    setItems(a || []);
    setCustomers(c || []);
    setCustomerLocs(l || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(a =>
    !search || (a.assetName || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.assetCode || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.category || '').toLowerCase().includes(search.toLowerCase()));

  const locsForCustomer = form.customerId ? customerLocs.filter(l => l.customerId === form.customerId) : [];

  const openAdd = () => { setForm({ ...EMPTY }); setEditId(null); setShowModal(true); };

  const openEdit = (a) => {
    setForm({
      assetName: a.assetName || '', assetCode: a.assetCode || '',
      category: a.category || '', subCategory: a.subCategory || '',
      status: a.status || 'Active', criticality: a.criticality || 'Medium',
      manufacturer: a.manufacturer || '', model: a.model || '', serialNumber: a.serialNumber || '',
      customerId: a.customerId || '', customerName: a.customerName || '',
      customerLocationId: a.customerLocationId || '', customerLocationName: a.customerLocationName || '',
      installDate: a.installDate ? a.installDate.slice(0,10) : '',
      purchaseDate: a.purchaseDate ? a.purchaseDate.slice(0,10) : '',
      warrantyExpiryDate: a.warrantyExpiryDate ? a.warrantyExpiryDate.slice(0,10) : '',
      lastServiceDate: a.lastServiceDate ? a.lastServiceDate.slice(0,10) : '',
      nextServiceDate: a.nextServiceDate ? a.nextServiceDate.slice(0,10) : '',
      notes: a.notes || '',
    });
    setEditId(a.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.assetName.trim() || !form.assetCode.trim()) {
      alert('Asset name and code are required'); return;
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
        installDate: sanitize(form.installDate), purchaseDate: sanitize(form.purchaseDate),
        warrantyExpiryDate: sanitize(form.warrantyExpiryDate),
        lastServiceDate: sanitize(form.lastServiceDate), nextServiceDate: sanitize(form.nextServiceDate),
        notes: form.notes,
      };
      if (editId) {
        await update('assets', editId, { ...payload });
      } else {
        await create('assets', payload);
      }
      setShowModal(false);
      load();
    } catch (err) { alert('Save failed: ' + err.message); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20 }}>Assets ({items.length})</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, width: 220 }} />
          <button onClick={openAdd} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+ Add Asset</button>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
        <thead><tr style={{ borderBottom: '2px solid #e0e0e0' }}>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Asset Code</th>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Name</th>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Category</th>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Status</th>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Customer</th>
          <th style={{ width: 50 }}></th>
        </tr></thead>
        <tbody>
          {filtered.map(a => (
            <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '10px 14px', fontWeight: 600 }}>{a.assetCode || '-'}</td>
              <td style={{ padding: '10px 14px' }}>{a.assetName || '-'}</td>
              <td style={{ padding: '10px 14px', color: '#666' }}>{a.category || '-'}</td>
              <td style={{ padding: '10px 14px' }}>
                <span style={{ background: a.status === 'Active' ? '#22c55e' : a.status === 'Under Maintenance' ? '#f59e0b' : a.status === 'Out of Service' ? '#ef4444' : '#94a3b8', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                  {a.status}
                </span>
              </td>
              <td style={{ padding: '10px 14px', color: '#666' }}>{a.customerName || '-'}</td>
              <td style={{ padding: '10px 14px' }}><button onClick={() => openEdit(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✏️</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 560, maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: 16 }}>{editId ? 'Edit' : 'Add'} Asset</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Fi label="Asset Code" v={form.assetCode} s={v => setForm({...form, assetCode: v})} />
              <Fi label="Asset Name" v={form.assetName} s={v => setForm({...form, assetName: v})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={{ fontSize: 11, color: '#888' }}>Category</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="">Select...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Fi label="Sub Category" v={form.subCategory} s={v => setForm({...form, subCategory: v})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label style={{ fontSize: 11, color: '#888' }}>Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: 11, color: '#888' }}>Criticality</label>
                <select value={form.criticality} onChange={e => setForm({...form, criticality: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  {CRITICALITY.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Fi label="Serial#" v={form.serialNumber} s={v => setForm({...form, serialNumber: v})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Fi label="Manufacturer" v={form.manufacturer} s={v => setForm({...form, manufacturer: v})} />
              <Fi label="Model" v={form.model} s={v => setForm({...form, model: v})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={{ fontSize: 11, color: '#888' }}>Customer</label>
                <select value={form.customerId} onChange={e => {
                  const c = customers.find(x => x.id === e.target.value);
                  setForm({...form, customerId: e.target.value, customerName: c?.name || '', customerLocationId: '', customerLocationName: '' });
                }} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="">Select...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: 11, color: '#888' }}>Location</label>
                <select value={form.customerLocationId} onChange={e => {
                  const l = customerLocs.find(x => x.id === e.target.value);
                  setForm({...form, customerLocationId: e.target.value, customerLocationName: l?.companyName || '' });
                }} style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="">Select...</option>
                  {locsForCustomer.map(l => <option key={l.id} value={l.id}>{l.companyName}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Fi label="Install Date" v={form.installDate} s={v => setForm({...form, installDate: v})} type="date" />
              <Fi label="Purchase Date" v={form.purchaseDate} s={v => setForm({...form, purchaseDate: v})} type="date" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Fi label="Warranty Expiry" v={form.warrantyExpiryDate} s={v => setForm({...form, warrantyExpiryDate: v})} type="date" />
              <Fi label="Last Service" v={form.lastServiceDate} s={v => setForm({...form, lastServiceDate: v})} type="date" />
            </div>
            <Fi label="Next Service" v={form.nextServiceDate} s={v => setForm({...form, nextServiceDate: v})} type="date" />
            <div style={{ marginBottom: 10 }}><label style={{ fontSize: 11, color: '#888' }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSave} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>{editId ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Fi({ label, v, s, type = 'text' }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</label>
      <input type={type} value={v} onChange={e => s(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
    </div>
  );
}
