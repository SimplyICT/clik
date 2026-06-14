const API = '/api/supabase';

function storage() {
  return localStorage.getItem('_remember') === 'true' ? localStorage : sessionStorage;
}

function authHeaders() {
  const t = storage().getItem('token');
  return t ? { 'Authorization': `Bearer ${t}` } : {};
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
  const cid = storage().getItem('customer_id') || '';
  return cid ? [{ field: 'customerId', value: cid }] : [];
}
