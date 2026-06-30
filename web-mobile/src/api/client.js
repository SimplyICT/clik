const API = '/api/supabase';
import { getItem, setItem, removeItem, clearAll } from './storage';

function auth() { const t = getItem('token'); return t ? { 'Authorization': `Bearer ${t}` } : {}; }
async function req(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...auth(), ...opts.headers };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { ...opts, headers, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(text.slice(0, 200));
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timeout);
  }
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
export async function del(table, id) {
  const headers = { 'Content-Type': 'application/json', ...auth() };
  await fetch(`${API}/${table}?id=eq.${id}`, { method: 'DELETE', headers });
}
export async function login(email, password, remember) {
  const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const d = await res.json();
  if (!res.ok) throw new Error(d.detail || d.error || 'Login failed');
  const { setRemember, setItem: st } = await import('./storage');
  setRemember(remember);
  st('token', d.token);
  if (d.permissions) st('permissions', JSON.stringify(d.permissions));
  st('user', JSON.stringify(d.user));
  if (d.customer_id) st('customer_id', d.customer_id);
  if (d.author_profile_id) st('author_profile_id', d.author_profile_id);
  if (d.customer_name) st('customer_name', d.customer_name);
  if (d.role) {
    st('role', d.role === 'contractor' ? 'contractor' : 'manager');
  }
  if (d.author_profile_id) {
    st('author_profile_id', d.author_profile_id);
  }
  // Save auth to Cache API (most persistent on iOS PWA)
  try {
    caches.open('simplyclik-mobile-auth').then(c =>
      c.put('/mobile/.auth', new Response(JSON.stringify({
        token: d.token, user: d.user, permissions: d.permissions,
        author_profile_id: d.author_profile_id, customer_id: d.customer_id,
        customer_name: d.customer_name, role: d.role,
      })))
    );
  } catch {}
  return d;
}
export function logout() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  clearAll();
  Promise.all([
    caches.open('simplyclik-mobile-auth').then(c => c.delete('/mobile/.auth')).catch(() => {}),
    token ? fetch('/api/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }).catch(() => {}) : Promise.resolve(),
  ]).finally(() => { window.location.href = '/mobile/login'; });
}
export function getUser() {
  try { return JSON.parse(getItem('user')); } catch {}
  try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch {}
  return null;
}
export function getPermissions() {
  try { return JSON.parse(getItem('permissions') || '{}'); } catch { return {}; }
}
export function canView(resource) {
  const perms = getPermissions();
  return perms?.[resource]?.can_view === true;
}
export function canEdit(resource) {
  const perms = getPermissions();
  return perms?.[resource]?.can_edit === true;
}
