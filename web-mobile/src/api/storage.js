const REMEMBER_KEY = '_remember';

function store() {
  return localStorage.getItem(REMEMBER_KEY) === 'true' ? localStorage : sessionStorage;
}

export function setRemember(remember) {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, 'true');
    Object.keys(sessionStorage).forEach(k => {
      if (k !== REMEMBER_KEY) localStorage.setItem(k, sessionStorage.getItem(k));
    });
  } else {
    localStorage.setItem(REMEMBER_KEY, 'false');
    Object.keys(localStorage).forEach(k => {
      if (k !== REMEMBER_KEY) sessionStorage.setItem(k, localStorage.getItem(k));
    });
    localStorage.removeItem(REMEMBER_KEY);
  }
}

export function getRemember() {
  return localStorage.getItem(REMEMBER_KEY) !== 'false';
}

export function getItem(key) {
  const val = store().getItem(key);
  if (val !== null) return val;
  const alt = localStorage.getItem(REMEMBER_KEY) === 'true' ? sessionStorage : localStorage;
  return alt.getItem(key);
}

export function setItem(key, value) {
  store().setItem(key, value);
}

export function removeItem(key) {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

export function clearAll() {
  localStorage.clear();
  sessionStorage.clear();
}

export function getItemAny(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key) || '';
}

export function getAll(key) {
  const l = localStorage.getItem(key);
  const s = sessionStorage.getItem(key);
  return l || s || null;
}
