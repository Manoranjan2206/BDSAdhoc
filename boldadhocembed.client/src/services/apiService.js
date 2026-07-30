/**
 * API Service for Bold Reports
 * Handles all API calls to the backend with proper error handling
 * Automatically includes Authorization header with user's token
 */

import { authService } from './authService';

// Resolve API base: prefer VITE_API_BASE_URL when set. During local frontend dev
// (Vite) the client often runs on ports like 5173/5274 while the backend runs
// on a different port (configured in the server SpaProxyServerUrl). If the
// env var is not set, detect common dev ports and point requests to the
// backend host so calls don't hit the Vite dev server and return 404/405.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

function buildApiUrl(path) {
  const base = (API_BASE_URL || '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!base || base === '/') {
    return `/api${normalizedPath}`;
  }

  if (base.endsWith('/api')) {
    return `${base}${normalizedPath}`;
  }

  if (/^https?:\/\//i.test(base)) {
    return `${base}/api${normalizedPath}`;
  }

  return `${base}${normalizedPath}`;
}

// Simple in-memory cache to avoid duplicate API calls within a short window
const CACHE_TTL_MS = 60000; // 60 seconds
const cacheStore = new Map(); // key -> { data, ts }

// Normalize ApiResponse wrappers coming from server { success, message, data }
function unwrapResponse(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }
  return payload;
}

function getCacheKey(endpoint, options) {
  const method = (options?.method || 'GET').toUpperCase();
  return `${method}:${endpoint}`;
}

/**
 * Add authentication header to request options
 * @param {object} options - Current options
 * @returns {object} Options with Authorization header added
 */
function addAuthHeader(options = {}) {
  const token = authService.getToken();
  
  if (!token) {
    console.warn('[API] No authentication token found');
    return options;
  }

  return {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  };
}

async function apiCached(endpoint, options = {}, ttl = CACHE_TTL_MS) {
  const key = getCacheKey(endpoint, options);
  const cached = cacheStore.get(key);
  const now = Date.now();
  if (cached && now - cached.ts < ttl) {
    return cached.data;
  }
  const data = await apiRequest(endpoint, options);
  const unwrapped = unwrapResponse(data);
  cacheStore.set(key, { data: unwrapped, ts: now });
  return unwrapped;
}

/**
 * Make an API request with automatic authentication
 * @param {string} endpoint - API endpoint (e.g., '/reports/tree')
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<any>} Response data
 */
async function apiRequest(endpoint, options = {}) {
  const url = buildApiUrl(endpoint);
  
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  // Add authentication header with user's token
  const authOptions = addAuthHeader(defaultOptions);

  try {
    // Debugging: log base and final URL so missing /api issues are visible in DevTools
    console.log(`[API] base=${API_BASE_URL} method=${authOptions.method} url=${url}`);
    
    const response = await fetch(url, authOptions);
    
    // Handle 401 Unauthorized - token may have expired
    if (response.status === 401) {
      console.error('[API] Unauthorized - Token may have expired');
      // Clear authentication
      await authService.logout();
      throw new Error('Unauthorized - Please login again');
    }

    // Handle response
    if (!response.ok) {
      // If we hit a 404 on the dev server (no proxy), retry against common backend origins
      if (response.status === 404 && url.startsWith('/api')) {
        const candidates = [
          'https://localhost:64940',
          'https://localhost:64941',
          'https://localhost:7029',
          'https://localhost:44300',
          'http://localhost:62807'
        ];

        for (const origin of candidates) {
          try {
            const tryUrl = `${origin}${url}`.replace(/([^:])\/\/+/, '$1/');
            console.log(`[API] retrying ${tryUrl}`);
            const retryResp = await fetch(tryUrl, authOptions);
            if (retryResp.ok) {
              const contentType = retryResp.headers.get('content-type');
              if (!contentType || !contentType.includes('application/json')) return null;
              const data = await retryResp.json();
              console.log(`[API] Retry success from ${tryUrl}`);
              return data;
            }
            // otherwise keep trying
            const txt = await retryResp.text();
            console.warn(`[API] Retry ${tryUrl} failed with ${retryResp.status}: ${txt}`);
          } catch (ex) {
            console.warn('[API] Retry exception for', origin, ex.message);
          }
        }
      }

      const errorText = await response.text();
      console.error(`[API Error] ${response.status}: ${errorText}`);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    // Check if response has content
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('[API] Response is not JSON');
      return null;
    }

    const data = await response.json();
    console.log(`[API] Success:`, data);
    return data;
  } catch (error) {
    console.error(`[API] Request failed:`, error.message);
    throw error;
  }
}

/**
 * Reports API Endpoints
 * All requests use the authenticated user's token
 * RLS is handled server-side in Bold Reports
 */
export const reportsAPI = {
  /**
   * Get Bold Reports viewer settings (token, serviceUrl, serverUrl)
   * Uses authenticated user's token for proper RLS
   * @returns {Promise<object>} Viewer settings with token and URLs
   */
  getViewerSettings: async () => unwrapResponse(await apiRequest('/reports/viewer-settings')),

  /**
   * Get report tree grouped by categories
   * Only reports the user has access to are returned (RLS enforced)
   * @returns {Promise<Array>} Array of report categories with reports
   */
  getReportTree: async () => unwrapResponse(await apiRequest('/reports/tree')),

  /**
   * Get specific report details
   * Respects user permissions (RLS)
   * @param {string} reportId - Report ID
   * @returns {Promise<object>} Report details
   */
  getReport: async (reportId) => unwrapResponse(await apiRequest(`/reports/${reportId}`)),

  /**
   * Export report to specified format
   * User's permissions are enforced server-side
   * @param {string} reportId - Report ID
   * @param {string} exportType - Export format (PDF, EXCEL, CSV)
   * @returns {Promise<Blob>} File blob
   */
  exportReport: async (reportId, exportType = 'PDF') => {
    const url = buildApiUrl('/reports/export');
    
    try {
      console.log(`[API] POST ${url} - Export ${exportType}`);
      
      const token = authService.getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          reportId: reportId,
          exportType: exportType,
        }),
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        await authService.logout();
        throw new Error('Unauthorized - Please login again');
      }

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('[API] Export failed:', error.message);
      throw error;
    }
  },
  /**
   * Delete report by name and optional category
   * @param {string} name
   * @param {string} category
   */
  deleteReport: async (name, category) => {
    const payload = { name, category };
    const res = await apiRequest('/reports/Delete', { method: 'POST', body: JSON.stringify(payload) });
    return unwrapResponse(res);
  },
};

/**
 * Users API Endpoints
 * Uses authenticated user's token
 * User can only see/edit users they have access to (RLS)
 */
export const usersAPI = {
  // Unwrap ApiResponse { success, message, data } when present
  _unwrap: (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res),

  /**
   * Get all users the authenticated user can access
   */
  getUsers: async () => {
    const res = await apiRequest('/users/GetUsers');
    return usersAPI._unwrap(res);
  },

  /**
   * Get specific user details
   */
  getUser: async (email) => {
    const res = await apiRequest(`/users/GetUser/${encodeURIComponent(email)}`);
    return usersAPI._unwrap(res);
  },

  /**
   * Create new user (requires permission)
   */
  createUser: async (userData) => {
    const res = await apiRequest('/users/CreateUser', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    return usersAPI._unwrap(res);
  },

  /**
   * Update user (requires permission)
   */
  updateUser: async (email, userData) => {
    const res = await apiRequest(`/users/UpdateUser/${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
    return usersAPI._unwrap(res);
  },

  /**
   * Delete user (requires permission)
   */
  deleteUser: async (email) => {
    const res = await apiRequest(`/users/DeleteUser/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
    return usersAPI._unwrap(res);
  },
};

/**
 * Schedules API Endpoints
 * Uses authenticated user's token
 * User can only see/manage schedules they have access to (RLS)
 */
export const schedulesAPI = {
  /**
   * Get all schedules the authenticated user can access
   */
  getSchedules: async () => unwrapResponse(await apiRequest('/schedules/GetSchedules')),
  
  /**
   * Get specific schedule details
   */
  getSchedule: async (scheduleId) => unwrapResponse(await apiRequest(`/schedules/GetSchedule/${scheduleId}`)),
  
  /**
   * Run schedule immediately (uses query GET: /schedules/run?scheduleId=...)
   */
  runNow: async (scheduleId) => {
    // Prefer POST to the RunNow route when possible
    try {
      const postRes = await apiRequest(`/schedules/RunNow/${encodeURIComponent(scheduleId)}`, { method: 'POST' });
      return unwrapResponse(postRes);
    } catch (err) {
      console.warn('[API] RunNow POST failed, falling back to GET run query', err.message);
      return unwrapResponse(await apiRequest(`/schedules/run?scheduleId=${encodeURIComponent(scheduleId)}`));
    }
  },
  
  /**
   * Create new schedule (requires permission)
   */
  create: async (payload) => {
    const res = await apiRequest('/schedules/Create', { 
      method: 'POST', 
      body: JSON.stringify(payload) 
    });
    return unwrapResponse(res);
  },
  /**
   * Update an existing schedule by id
   */
  update: async (scheduleId, payload) => {
    const res = await apiRequest(`/schedules/${encodeURIComponent(scheduleId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return unwrapResponse(res);
  },
  /**
   * Delete schedule by id
   */
  delete: async (scheduleId) => {
    const res = await apiRequest(`/schedules/${encodeURIComponent(scheduleId)}`, { method: 'DELETE' });
    return unwrapResponse(res);
  },
};

/**
 * API Configuration
 */
export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * Helper function to download file from Blob
 * @param {Blob} blob - File blob
 * @param {string} filename - Download filename
 */
export function downloadFile(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Default export for convenience
 */
export default {
  reports: reportsAPI,
  users: usersAPI,
  schedules: schedulesAPI,
  config: apiConfig,
  downloadFile,
};
