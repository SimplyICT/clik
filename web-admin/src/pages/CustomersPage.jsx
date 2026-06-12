import { useState, useEffect, useCallback, useRef } from 'react';
import { q, create, update, del } from '../api/client';

// ── 4-step wizard state ──────────────────────────────────────────────────────
const EMPTY = { companyName: '', contactName: '', contactEmail: '', contactPhoneNumber: '',
  address: { addressLine1: '', addressLine2: '', city: '', state: '', postcode: '' },
  serviceContactName: '', serviceContactEmail: '', serviceContactPhone: '',
  paymentEmail: '', billing: 'Trial' };

const STEPS = ['Details', 'Locations', 'Manage', 'Billing'];
const AUS_STATES = ['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'];
const PHONE_REGEX = /^\d{4} \d{3} \d{3}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTCODE_REGEX = /^\d{4}$/;

function fmtPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 10);
  return d.length > 4 ? `${d.slice(0,4)} ${d.slice(4,7)}${d.length>7?' '+d.slice(7):''}` : d;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...EMPTY, address: { ...EMPTY.address } });
  const [editId, setEditId] = useState(null);
  const [errors, setErrors] = useState({});
  const [customersMap, setCustomersMap] = useState({});
  const [locations, setLocations] = useState([]);
  const [locationsToDelete, setLocationsToDelete] = useState([]);
  const [locForm, setLocForm] = useState({ companyName: '', reference: '' });
  const fileRef = useRef(null);

  const load = useCallback(() => {
    q('customers', { select: '*', order: 'name.asc' }).then(d => {
      const arr = d || [];
      setCustomers(arr);
      const map = {};
      arr.forEach(c => { map[c.id] = c; });
      setCustomersMap(map);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter(c =>
    !search || (c.name || '').toLowerCase().includes(search.toLowerCase()));

  // ── validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (step === 0) {
      if (!form.companyName.trim()) e.companyName = 'Required';
      if (!form.contactName.trim()) e.contactName = 'Required';
      if (!EMAIL_REGEX.test(form.contactEmail)) e.contactEmail = 'Valid email required';
      if (!PHONE_REGEX.test(form.contactPhoneNumber)) e.contactPhoneNumber = 'Format: 0412 345 678';
      if (!form.address.addressLine1.trim()) e['address.addressLine1'] = 'Required';
      if (!form.address.city.trim()) e['address.city'] = 'Required';
      if (!form.address.state) e['address.state'] = 'Required';
      if (!POSTCODE_REGEX.test(form.address.postcode)) e['address.postcode'] = '4 digits required';
    }
    if (step === 2) {
      if (!form.serviceContactName.trim()) e.serviceContactName = 'Required';
      if (!EMAIL_REGEX.test(form.serviceContactEmail)) e.serviceContactEmail = 'Valid email required';
      if (!form.paymentEmail.trim()) e.paymentEmail = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep(s => Math.min(s + 1, 3)); };
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const handleSave = async () => {
    if (step < 3) { next(); return; }
    if (!validate()) return;
    try {
      const payload = {
        name: form.companyName,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhoneNumber: form.contactPhoneNumber,
        addressJson: form.address,
        serviceContactName: form.serviceContactName,
        serviceContactEmail: form.serviceContactEmail,
        paymentEmail: form.paymentEmail,
        billing: form.billing,
      };
      let customerId = editId;
      if (editId) {
        await update('customers', editId, payload);
      } else {
        const created = await create('customers', payload);
        customerId = created.id;
      }
      for (const id of locationsToDelete) {
        await del('customerLocations', id);
      }
      for (const loc of locations) {
        if (loc._tempId) {
          await create('customerLocations', { companyName: loc.companyName, reference: loc.reference || null, customerId });
        } else {
          await update('customerLocations', loc.id, { companyName: loc.companyName, reference: loc.reference || null });
        }
      }
      closeWizard();
      load();
    } catch (err) { alert('Save failed: ' + err.message); }
  };

  const openAdd = () => {
    setForm({ ...EMPTY, address: { ...EMPTY.address } });
    setEditId(null);
    setStep(0);
    setErrors({});
    setShowWizard(true);
  };

  const openEdit = async (c) => {
    setForm({
      companyName: c.name || '',
      contactName: c.contactName || '',
      contactEmail: c.contactEmail || '',
      contactPhoneNumber: c.contactPhoneNumber || '',
      address: c.addressJson || { ...EMPTY.address },
      serviceContactName: c.serviceContactName || '',
      serviceContactEmail: c.serviceContactEmail || '',
      serviceContactPhone: c.serviceContactPhone || '',
      paymentEmail: c.paymentEmail || '',
      billing: c.billing || 'Trial',
    });
    setEditId(c.id);
    setStep(0);
    setErrors({});
    setShowWizard(true);
    const locs = await q('customerLocations', { select: 'id,companyName,reference', filters: [{ field: 'customerId', value: c.id }], limit: 200 });
    setLocations(locs || []);
    setLocationsToDelete([]);
  };

  const closeWizard = () => { setShowWizard(false); setStep(0); setErrors({}); setLocations([]); setLocationsToDelete([]); setLocForm({ companyName: '', reference: '' }); };

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const setAddr = (field, value) => setForm(f => ({ ...f, address: { ...f.address, [field]: value } }));

  // ── render ─────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20 }}>Customers ({customers.length})</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13, width: 220 }} />
          <button onClick={openAdd} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            + Add Customer
          </button>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Name</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Contact</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Email</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Billing</th>
            <th style={{ width: 50 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '10px 14px', fontWeight: 600 }}>{c.name}</td>
              <td style={{ padding: '10px 14px' }}>{c.contactName || '-'}</td>
              <td style={{ padding: '10px 14px', color: '#666' }}>{c.contactEmail || c.paymentEmail || '-'}</td>
              <td style={{ padding: '10px 14px', color: '#666', fontSize: 12 }}>{c.billing || '-'}</td>
              <td style={{ padding: '10px 14px' }}>
                <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✏️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── 4-step wizard modal ─────────────────────────────────────────────── */}
      {showWizard && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, width: 520, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: 20, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16 }}>{editId ? 'Edit' : 'Add'} Customer</h3>
              <button onClick={closeWizard} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            {/* Step indicators */}
            <div style={{ display: 'flex', padding: '12px 20px', gap: 0, borderBottom: '1px solid #f0f0f0' }}>
              {STEPS.map((s, i) => (
                <div key={s} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 600,
                  color: i === step ? '#00d4ff' : i < step ? '#22c55e' : '#ccc', borderBottom: i === step ? '2px solid #00d4ff' : '2px solid transparent' }}>
                  {i < step ? '✓ ' : ''}{s}
                </div>
              ))}
            </div>

            <div style={{ padding: 20 }}>
              {/* Step 0: Details */}
              {step === 0 && (
                <div>
                  <Field label="Company Name" value={form.companyName} onChange={v => set('companyName', v)} error={errors.companyName} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Contact Name" value={form.contactName} onChange={v => set('contactName', v)} error={errors.contactName} />
                    <Field label="Contact Email" value={form.contactEmail} onChange={v => set('contactEmail', v)} error={errors.contactEmail} />
                  </div>
                  <Field label="Contact Phone" value={form.contactPhoneNumber} onChange={v => set('contactPhoneNumber', fmtPhone(v))} error={errors.contactPhoneNumber} placeholder="0412 345 678" />
                  <div style={{ borderTop: '1px solid #eee', margin: '16px 0 12px', paddingTop: 12 }}>
                    <small style={{ color: '#888' }}>Address</small>
                  </div>
                  <Field label="Address Line 1" value={form.address.addressLine1} onChange={v => setAddr('addressLine1', v)} error={errors['address.addressLine1']} />
                  <Field label="Address Line 2" value={form.address.addressLine2} onChange={v => setAddr('addressLine2', v)} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
                    <Field label="City" value={form.address.city} onChange={v => setAddr('city', v)} error={errors['address.city']} />
                    <select value={form.address.state} onChange={e => setAddr('state', e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 4, border: errors['address.state'] ? '1px solid #ef4444' : '1px solid #ddd', fontSize: 13, marginTop: 22 }}>
                      <option value="">State</option>
                      {AUS_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Field label="Postcode" value={form.address.postcode} onChange={v => setAddr('postcode', v.replace(/\D/g, '').slice(0,4))} error={errors['address.postcode']} />
                  </div>
                </div>
              )}

              {/* Step 1: Locations */}
              {step === 1 && (
                <div>
                  <p style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>Add service locations for this customer.</p>

                  {/* CSV Upload */}
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const lines = evt.target.result.split('\n').filter(l => l.trim());
                          if (lines.length < 2) return;
                          const h = lines[0].split(',').map(c => c.trim().toLowerCase());
                          const ni = h.indexOf('companyname');
                          const ri = h.indexOf('reference');
                          const ai = h.indexOf('address');
                          const parsed = [];
                          for (let i = 1; i < lines.length; i++) {
                            const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                            if (!cols[ni]) continue;
                            parsed.push({
                              _tempId: (Math.random() + 1).toString(36).slice(2),
                              companyName: cols[ni] || '',
                              reference: ri >= 0 ? cols[ri] || '' : '',
                              address: ai >= 0 ? cols[ai] || '' : '',
                            });
                          }
                          setLocations(l => [...l, ...parsed]);
                        };
                        reader.readAsText(file);
                        e.target.value = '';
                      }} />
                    <button onClick={() => fileRef.current?.click()}
                      style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12, background: '#fff' }}>
                      Upload CSV
                    </button>
                    <span style={{ fontSize: 11, color: '#888' }}>Columns: companyName, reference, address</span>
                  </div>

                  {/* Add location form */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input placeholder="Location name" value={locForm.companyName}
                      onChange={e => setLocForm(f => ({ ...f, companyName: e.target.value }))}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }} />
                    <input placeholder="Reference (optional)" value={locForm.reference}
                      onChange={e => setLocForm(f => ({ ...f, reference: e.target.value }))}
                      style={{ width: 160, padding: '7px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }} />
                    <button onClick={() => {
                      if (!locForm.companyName.trim()) return;
                      setLocations(l => [...l, { _tempId: (Math.random() + 1).toString(36).slice(2), ...locForm }]);
                      setLocForm({ companyName: '', reference: '' });
                    }}
                      style={{ padding: '6px 14px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      Add
                    </button>
                  </div>

                  {/* Location list */}
                  {locations.length === 0 && (
                    <div style={{ color: '#888', fontSize: 13, padding: 20, textAlign: 'center', border: '1px dashed #ddd', borderRadius: 4 }}>
                      No locations yet. Add manually or upload a CSV.
                    </div>
                  )}
                  {locations.map((loc, i) => (
                    <div key={loc._tempId || loc.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', marginBottom: 4, borderRadius: 4, border: '1px solid #f0f0f0', fontSize: 13 }}>
                      <span style={{ flex: 1, fontWeight: 500 }}>{loc.companyName}</span>
                      {loc.reference && <span style={{ color: '#888', fontSize: 11, marginRight: 12 }}>{loc.reference}</span>}
                      <button onClick={() => {
                        if (loc.id) setLocationsToDelete(d => [...d, loc.id]);
                        setLocations(l => l.filter((_, j) => j !== i));
                      }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: '0 4px' }}>×</button>
                    </div>
                  ))}

                  {locations.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                      {locations.length} location{locations.length > 1 ? 's' : ''} added
                      {locationsToDelete.length > 0 && <> ({locationsToDelete.length} to be removed)</>}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Manage (Service Contact + OTP) */}
              {step === 2 && (
                <div>
                  <Field label="Service Contact Name" value={form.serviceContactName} onChange={v => set('serviceContactName', v)} error={errors.serviceContactName} />
                  <Field label="Service Contact Email" value={form.serviceContactEmail} onChange={v => set('serviceContactEmail', v)} error={errors.serviceContactEmail} />
                  <Field label="Service Contact Phone" value={form.serviceContactPhone} onChange={v => set('serviceContactPhone', fmtPhone(v))} />
                  <Field label="Payment Email" value={form.paymentEmail} onChange={v => set('paymentEmail', v)} error={errors.paymentEmail} />
                </div>
              )}

              {/* Step 3: Billing */}
              {step === 3 && (
                <div>
                  <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>Billing Plan</p>
                  {['Trial','Monthly','Annually'].map(plan => (
                    <label key={plan} style={{ display: 'block', padding: '10px 14px', marginBottom: 6, borderRadius: 4, border: form.billing === plan ? '2px solid #00d4ff' : '1px solid #ddd', cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" name="billing" value={plan} checked={form.billing === plan} onChange={e => set('billing', e.target.value)}
                        style={{ marginRight: 8 }} />
                      {plan}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={prev} disabled={step === 0}
                style={{ padding: '8px 20px', borderRadius: 4, border: '1px solid #ddd', cursor: step === 0 ? 'default' : 'pointer', fontSize: 13, opacity: step === 0 ? 0.5 : 1 }}>
                Back
              </button>
              <button onClick={handleSave}
                style={{ padding: '8px 24px', borderRadius: 4, border: 'none', background: '#00d4ff', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {step < 3 ? 'Next' : (editId ? 'Save Changes' : 'Create Customer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form field component ──────────────────────────────────────────────────────
function Field({ label, value, onChange, error, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: error ? '1px solid #ef4444' : '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
      {error && <span style={{ color: '#ef4444', fontSize: 11 }}>{error}</span>}
    </div>
  );
}
