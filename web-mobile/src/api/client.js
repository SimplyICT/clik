const API = '/api/supabase';
function auth() { const t = sessionStorage.getItem('token'); return t ? { 'Authorization': `Bearer ${t}` } : {}; }
async function req(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...auth(), ...opts.headers };
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
  const r = await req(`${API}/${table}`, { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(data) });
  return Array.isArray(r) ? r[0] : r;
}
export async function update(table, id, data) {
  await req(`${API}/${table}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return true;
}
export async function login(email, password) {
  const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const d = await res.json();
  if (!res.ok) throw new Error(d.detail || d.error || 'Login failed');
  sessionStorage.setItem('token', d.token);
  sessionStorage.setItem('user', JSON.stringify(d.user));
  if (d.customer_id) sessionStorage.setItem('customer_id', d.customer_id);
  if (d.customer_ref) sessionStorage.setItem('customer_ref', d.customer_ref);
  if (d.author_profile_id) sessionStorage.setItem('author_profile_id', d.author_profile_id);
  return d;
}
export function logout() { sessionStorage.clear(); window.location.href = '/login'; }
export function getUser() { try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; } }
