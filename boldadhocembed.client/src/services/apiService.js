/**
 * API Service for Bold Reports
 * Handles all API calls to the backend with proper error handling
 * Automatically includes Authorization header with user's token
 */

import { authService } from './authService';
import {
  API_BASE_URL,
  buildApiUrl as _buildApiUrl,
  unwrapResponse,
  logDev,
  logDevWarn,
} from '../utils/http';

const buildApiUrl = _buildApiUrl;

/**
 * Add authentication header to request options. The legacy X-User-*\/\/X-Tenant-Name
 * helper attributes were dropped as part of the server-side auth hardening:
 * the API now resolves identity exclusively from the Bearer JWT, and silently
 * ignoring client headers means any caller reporting email/role/region via
 * those headers had ZERO effect on either auth or RLS scoping.
 *
 * Cross-cutting request memoization lives in components/context (DataProvider)
 * rather than a module-level TTL cache: the previous layer grew unbounded,
 * invalidated nothing, and produced stale lists after mutations like report
 * delete. DataProvider.{getReports,getDashboards,...} is now the only cache.
 * @param {object} options - Current options
 * @returns {object} Options with Authorization header added
 */
function addAuthHeader(options = {}) {
  const token = authService.getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return { ...options, headers };
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
    // Debug-only logging so production bundles stay quiet.
    logDev(`[API] method=${authOptions.method} url=${url}`);

    const response = await fetch(url, authOptions);

    // 401 - token may have expired; force logout.
    if (response.status === 401) {
      await authService.logout();
      throw new Error('Unauthorized - Please login again');
    }

    if (!response.ok) {
      const errorText = await response.text();
      logDevWarn(`[API Error] ${response.status}: ${errorText}`);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      logDevWarn('[API] Response is not JSON');
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[API] Request failed:', error.message);
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
   * Get Bold Reports embed token with CustomAttributes
   * Includes database name, organization, and tenant information for RLS
   * @returns {Promise<object>} Embed token with serviceUrl and serverUrl
   */
  getEmbedToken: async () => unwrapResponse(await apiRequest('/reports/embed-token')),

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
 * CRM PostgreSQL API Service
 * Queries multi-tenant CRM datasets (Deals, Contacts, Support Tickets, Tasks, Campaigns, Audit Logs)
 */
export const crmAPI = {
  getHomeSummary: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/crm/home-summary?${query}` : '/crm/home-summary';
    const res = await apiRequest(endpoint);
    return unwrapResponse(res);
  },
  getDeals: async (stage = null) => {
    const endpoint = stage ? `/crm/deals?stage=${encodeURIComponent(stage)}` : '/crm/deals';
    const res = await apiRequest(endpoint);
    return unwrapResponse(res);
  },
  getContacts: async () => {
    const res = await apiRequest('/crm/contacts');
    return unwrapResponse(res);
  },
  getTickets: async () => {
    const res = await apiRequest('/crm/tickets');
    return unwrapResponse(res);
  },
  getCampaigns: async () => {
    const res = await apiRequest('/crm/campaigns');
    return unwrapResponse(res);
  },
  getAuditLogs: async () => {
    const res = await apiRequest('/crm/audit-logs');
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
  crm: crmAPI,
  config: apiConfig,
  downloadFile,
};

