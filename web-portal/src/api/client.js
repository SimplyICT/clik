const API = '/api/supabase';
const CID = () => localStorage.getItem('customer_id') || '';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function req(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...authHeaders(), ...opts.headers };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}

export function q(table, { select = '*', filters = [], order, limit } = {}) {
  let url = `${API}/${table}?select=${encodeURIComponent(select)}`;
  for (const f of filters) url += `&${f.field}=${f.op || 'eq'}.${encodeURIComponent(f.value)}`;
  if (order) url += `&order=${encodeURIComponent(order)}`;
  if (limit) url += `&limit=${limit}`;
  return req(url);
}

export async function create(table, data) {
  const r = await req(`${API}/${table}`, {
    method: 'POST', headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  return Array.isArray(r) ? r[0] : r;
}

export async function update(table, id, data) {
  await req(`${API}/${table}?id=eq.${id}`, {
    method: 'PATCH', body: JSON.stringify(data),
  });
  return true;
}

export async function del(table, id) {
  const headers = { 'Content-Type': 'application/json', ...authHeaders() };
  await fetch(`${API}/${table}?id=eq.${id}`, { method: 'DELETE', headers });
}

export function customerFilter() {
  const cid = CID();
  return cid ? [{ field: 'customerId', value: cid }] : [];
}
