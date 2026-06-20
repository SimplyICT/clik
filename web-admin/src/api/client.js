const API = '/api/supabase';

function storage() {
  return localStorage.getItem('_remember') === 'true' ? localStorage : sessionStorage;
}

export function authHeaders() {
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

export function getById(table, id) {
  return q(table, { filters: [{ field: 'id', value: id }] });
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

export async function login(email, password, remember) {
  const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const d = await res.json();
  if (!res.ok) throw new Error(d.detail || d.error || 'Login failed');
  const s = remember ? localStorage : sessionStorage;
  if (remember) localStorage.setItem('_remember', 'true');
  s.setItem('token', d.token);
  s.setItem('user', JSON.stringify(d.user));
  s.setItem('is_admin', JSON.stringify(d.is_admin));
  s.setItem('permissions', JSON.stringify(d.permissions || {}));
  if (d.customer_id) s.setItem('customer_id', d.customer_id);
  if (d.author_profile_id) s.setItem('author_profile_id', d.author_profile_id);
  if (d.customer_name) s.setItem('customer_name', d.customer_name);
  return d;
}

export function logout() { localStorage.clear(); sessionStorage.clear(); }
export function getUser() {
  const u = localStorage.getItem('user') || sessionStorage.getItem('user');
  try { return JSON.parse(u); } catch { return null; }
}
export function isAdmin() {
  const a = localStorage.getItem('is_admin') || sessionStorage.getItem('is_admin');
  try { return JSON.parse(a) === true; } catch { return false; }
}

export function getPermissions() {
  try {
    return JSON.parse(
      localStorage.getItem('permissions') || sessionStorage.getItem('permissions') || '{}'
    );
  } catch { return {}; }
}

export function canView(resource) {
  if (isAdmin()) return true;
  const perms = getPermissions();
  return perms?.[resource]?.can_view === true;
}

export function canEdit(resource) {
  if (isAdmin()) return true;
  const perms = getPermissions();
  return perms?.[resource]?.can_edit === true;
}
