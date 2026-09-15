// Single source of truth for the API base URL + response envelope handling.
// Consolidates the duplicated buildApiUrl and unwrapResponse helpers that
// used to live in apiService.js, authService.js and usersAPI. New endpoint
// modules should import these helpers instead of rolling their own.

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export function buildApiUrl(path) {
  const base = API_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!base || base === '/') {
    // Same-origin fallback; rely on the Vite proxy in dev (see vite.config.js).
    return `/api${normalizedPath}`;
  }
  if (base.endsWith('/api')) return `${base}${normalizedPath}`;
  if (/^https?:\/\//i.test(base)) return `${base}/api${normalizedPath}`;
  return `${base}${normalizedPath}`;
}

export function unwrapResponse(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'data')) return payload.data;
  return payload;
}

const _isDev = import.meta.env.DEV;

export function logDev(...args) {
  if (_isDev) console.log(...args);
}

export function logDevWarn(...args) {
  if (_isDev) console.warn(...args);
}