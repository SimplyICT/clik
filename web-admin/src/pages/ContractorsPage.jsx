import { useState, useEffect, useCallback } from 'react';
import { q, create, update } from '../api/client';

const STEPS = ['Details', 'Locations', 'Manage'];
const AUS_STATES = ['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'];
const PHONE_REGEX = /^\d{4} \d{3} \d{3}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ABN_REGEX = /^\d{2} \d{3} \d{3} \d{3}$/;

const EMPTY = { companyName: '', contactName: '', contactEmail: '', contactPhoneNumber: '',
  abn: '', address: { addressLine1: '', addressLine2: '', city: '', state: '', postcode: '' },
  serviceContactName: '', serviceContactEmail: '' };

const SERVICE_TYPES = ['Air Conditioning','Cleaning','Electrical','General','Plumbing','Refrigeration'];

function fmtPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 10);
  return d.length > 4 ? `${d.slice(0,4)} ${d.slice(4,7)}${d.length>7?' '+d.slice(7):''}` : d;
}
function fmtABN(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)} ${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)} ${d.slice(2,5)} ${d.slice(5)}`;
  return `${d.slice(0,2)} ${d.slice(2,5)} ${d.slice(5,8)} ${d.slice(8)}`;
}

export default function ContractorsPage() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerLocations, setCustomerLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...EMPTY, address: { ...EMPTY.address } });
  const [editId, setEditId] = useState(null);
  const [errors, setErrors] = useState({});
  const [selectedCustomer, setSelectedCustomer] = useState('');

  const load = useCallback(async () => {
    const [cont, cust, locs] = await Promise.all([
      q('contractors', { select: '*', order: 'companyName.asc' }),
      q('customers', { select: '*', order: 'name.asc' }),
      q('customerLocations', { select: 'id,companyName,customerId,reference', limit: 200 }),
    ]);
    setItems(cont || []);
    setCustomers(cust || []);
    setCustomerLocations(locs || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(c =>
    !search || (c.companyName || '').toLowerCase().includes(search.toLowerCase()));

  const locsForCustomer = selectedCustomer
    ? customerLocations.filter(l => l.customerId === selectedCustomer)
    : [];

  // ── validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (step === 0) {
      if (!form.companyName.trim()) e.companyName = 'Required';
      if (!form.contactName.trim()) e.contactName = 'Required';
      if (!EMAIL_REGEX.test(form.contactEmail)) e.contactEmail = 'Valid email required';
      if (!PHONE_REGEX.test(form.contactPhoneNumber)) e.contactPhoneNumber = 'Format: 0412 345 678';
      if (!ABN_REGEX.test(form.abn)) e.abn = 'Format: 12 345 678 901';
      if (!form.address.addressLine1.trim()) e['address.addressLine1'] = 'Required';
      if (!form.address.city.trim()) e['address.city'] = 'Required';
      if (!form.address.state) e['address.state'] = 'Required';
      if (!/^\d{4}$/.test(form.address.postcode)) e['address.postcode'] = '4 digits';
    }
    if (step === 2) {
      if (!form.serviceContactName.trim()) e.serviceContactName = 'Required';
      if (!EMAIL_REGEX.test(form.serviceContactEmail)) e.serviceContactEmail = 'Valid email';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep(s => Math.min(s + 1, 2)); };
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const handleSave = async () => {
    if (step < 2) { next(); return; }
    if (!validate()) return;
    try {
      const payload = {
        company_name: form.companyName, contact_name: form.contactName,
        contact_email: form.contactEmail, contact_phone_number: form.contactPhoneNumber,
        abn: form.abn, address_json: form.address,
        service_contact_name: form.serviceContactName,
        service_contact_email: form.serviceContactEmail,
        profile_type: 'contractor',
      };
      if (editId) {
        await update('profiles', editId, payload);
      } else {
        await create('profiles', payload);
      }
      closeWizard();
      load();
    } catch (err) { alert('Save failed: ' + err.message); }
  };

  const openAdd = () => {
    setForm({ ...EMPTY, address: { ...EMPTY.address } });
    setEditId(null); setStep(0); setErrors({}); setSelectedCustomer('');
    setShowWizard(true);
  };

  const openEdit = (c) => {
    setForm({
      companyName: c.companyName || '', contactName: c.contactName || '',
      contactEmail: c.contactEmail || '', contactPhoneNumber: c.contactPhoneNumber || '',
      abn: c.abn || '',
      address: c.addressJson || { ...EMPTY.address },
      serviceContactName: c.serviceContactName || '',
      serviceContactEmail: c.serviceContactEmail || '',
    });
    setEditId(c.id); setStep(0); setErrors({});
    setShowWizard(true);
  };

  const closeWizard = () => { setShowWizard(false); setStep(0); setErrors({}); setSelectedCustomer(''); };
  const setF = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const setA = (f, v) => setForm(p => ({ ...p, address: { ...p.address, [f]: v } }));

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20 }}>Contractors ({items.length})</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Search by company..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, width: 220 }} />
          <button onClick={openAdd} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>+ Add Contractor</button>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Company</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Contact</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Email</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Phone</th>
            <th style={{ width: 50 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '10px 14px', fontWeight: 600 }}>{c.companyName}</td>
              <td style={{ padding: '10px 14px' }}>{c.contactName || '-'}</td>
              <td style={{ padding: '10px 14px', color: '#666' }}>{c.contactEmail || '-'}</td>
              <td style={{ padding: '10px 14px', color: '#666' }}>{c.contactPhoneNumber || '-'}</td>
              <td style={{ padding: '10px 14px' }}><button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✏️</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── 3-step wizard ────────────────────────────────────────────────────── */}
      {showWizard && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, width: 520, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: 20, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16 }}>{editId ? 'Edit' : 'Add'} Contractor</h3>
              <button onClick={closeWizard} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: 'flex', padding: '12px 20px', borderBottom: '1px solid #f0f0f0' }}>
              {STEPS.map((s, i) => (
                <div key={s} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 600,
                  color: i === step ? '#00d4ff' : i < step ? '#22c55e' : '#ccc', borderBottom: i === step ? '2px solid #00d4ff' : '2px solid transparent' }}>
                  {i < step ? '✓ ' : ''}{s}
                </div>
              ))}
            </div>
            <div style={{ padding: 20 }}>
              {step === 0 && (
                <div>
                  <Field label="Company Name" value={form.companyName} onChange={v => setF('companyName', v)} error={errors.companyName} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Contact Name" value={form.contactName} onChange={v => setF('contactName', v)} error={errors.contactName} />
                    <Field label="Contact Email" value={form.contactEmail} onChange={v => setF('contactEmail', v)} error={errors.contactEmail} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Phone" value={form.contactPhoneNumber} onChange={v => setF('contactPhoneNumber', fmtPhone(v))} error={errors.contactPhoneNumber} placeholder="0412 345 678" />
                    <Field label="ABN" value={form.abn} onChange={v => setF('abn', fmtABN(v))} error={errors.abn} placeholder="12 345 678 901" />
                  </div>
                  <div style={{ borderTop: '1px solid #eee', margin: '14px 0 10px', paddingTop: 10 }}><small style={{ color: '#888' }}>Address</small></div>
                  <Field label="Address Line 1" value={form.address.addressLine1} onChange={v => setA('addressLine1', v)} error={errors['address.addressLine1']} />
                  <Field label="Address Line 2" value={form.address.addressLine2} onChange={v => setA('addressLine2', v)} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
                    <Field label="City" value={form.address.city} onChange={v => setA('city', v)} error={errors['address.city']} />
                    <select value={form.address.state} onChange={e => setA('state', e.target.value)} style={{ padding: '8px 10px', borderRadius: 4, border: errors['address.state'] ? '1px solid #ef4444' : '1px solid #ddd', fontSize: 13, marginTop: 22 }}>
                      <option value="">State</option>
                      {AUS_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Field label="Postcode" value={form.address.postcode} onChange={v => setA('postcode', v.replace(/\D/g, '').slice(0,4))} error={errors['address.postcode']} />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>Assign this contractor to customer locations and select their service types.</p>
                  <div style={{ marginBottom: 12 }}>
                    <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}>
                      <option value="">Select a customer...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  {locsForCustomer.length === 0 && selectedCustomer && (
                    <div style={{ color: '#888', fontSize: 13, padding: 12 }}>No locations found for this customer.</div>
                  )}
                  {locsForCustomer.map(loc => (
                    <div key={loc.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', marginBottom: 4, borderRadius: 4, border: '1px solid #f0f0f0', fontSize: 13 }}>
                      <span style={{ flex: 1 }}>{loc.companyName}{loc.reference ? ` (${loc.reference})` : ''}</span>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {SERVICE_TYPES.map(st => (
                          <label key={st} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 2, marginRight: 4 }}>
                            <input type="checkbox" /> {st}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div>
                  <Field label="Service Contact Name" value={form.serviceContactName} onChange={v => setF('serviceContactName', v)} error={errors.serviceContactName} />
                  <Field label="Service Contact Email" value={form.serviceContactEmail} onChange={v => setF('serviceContactEmail', v)} error={errors.serviceContactEmail} />
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={prev} disabled={step === 0} style={{ padding: '8px 20px', borderRadius: 4, border: '1px solid #ddd', cursor: step === 0 ? 'default' : 'pointer', fontSize: 13, opacity: step === 0 ? 0.5 : 1 }}>Back</button>
              <button onClick={handleSave} style={{ padding: '8px 24px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {step < 2 ? 'Next' : (editId ? 'Save Changes' : 'Create Contractor')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, error, placeholder }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: error ? '1px solid #ef4444' : '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
      {error && <span style={{ color: '#ef4444', fontSize: 11 }}>{error}</span>}
    </div>
  );
}
