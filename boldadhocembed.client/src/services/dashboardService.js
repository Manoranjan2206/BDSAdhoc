/**
 * Bold BI Dashboard Service
 * Handles all API calls to the backend for dashboard operations
 * Automatically includes Authorization header with user's token
 */

import { authService } from './authService';

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

/**
 * Normalize ApiResponse wrappers coming from server { success, message, data }
 */
function unwrapResponse(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }
  return payload;
}

/**
 * Add authentication header to request options
 * @param {object} options - Current options
 * @returns {object} Options with Authorization header added
 */
function addAuthHeader(options = {}) {
  const token = authService.getToken();
  
  if (!token) {
    console.warn('[Dashboard API] No authentication token found');
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

/**
 * Make an API request for dashboard operations
 * @param {string} endpoint - API endpoint (e.g., '/dashboards/list')
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<any>} Response data
 */
async function dashboardApiRequest(endpoint, options = {}) {
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
    console.log(`[Dashboard API] ${authOptions.method} ${url}`);
    
    const response = await fetch(url, authOptions);
    
    // Handle 401 Unauthorized - token may have expired
    if (response.status === 401) {
      console.error('[Dashboard API] Unauthorized - Token may have expired');
      await authService.logout();
      throw new Error('Unauthorized - Please login again');
    }

    // Handle response
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Dashboard API Error] ${response.status}: ${errorText}`);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    // Check if response has content
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('[Dashboard API] Response is not JSON');
      return null;
    }

    const data = await response.json();
    console.log(`[Dashboard API] Success:`, data);
    return data;
  } catch (error) {
    console.error(`[Dashboard API] Request failed:`, error.message);
    throw error;
  }
}

/**
 * Dashboard API Endpoints
 * All requests use the authenticated user's token
 */
export const dashboardsAPI = {
  /**
   * Get Bold BI token for dashboard operations
   * @param {string} userEmail - User email for token generation
   * @returns {Promise<object>} Token and expiration info
   */
  getToken: async (userEmail) => {
    const response = await dashboardApiRequest('/dashboards/token', {
      method: 'POST',
      body: JSON.stringify({ userEmail }),
    });
    return unwrapResponse(response);
  },

  /**
   * Get list of dashboards the user has access to
   * @returns {Promise<Array>} Array of dashboards
   */
  getList: async () => {
    const response = await dashboardApiRequest('/dashboards/list');
    return unwrapResponse(response);
  },

  /**
   * Get specific dashboard details
   * @param {string} dashboardId - Dashboard ID
   * @returns {Promise<object>} Dashboard details
   */
  getDashboard: async (dashboardId) => {
    const response = await dashboardApiRequest(`/dashboards/${dashboardId}`);
    return unwrapResponse(response);
  },

  /**
   * Get embed configuration for a specific dashboard
   * This includes server URL, site identifier, and token
   * @param {string} dashboardId - Dashboard ID
   * @returns {Promise<object>} Embed configuration
   */
  getEmbedConfig: async (dashboardId) => {
    const response = await dashboardApiRequest(`/dashboards/${dashboardId}/config`);
    // Response is already the config object, not wrapped
    return response;
  },

  /**
   * Get authorization token for dashboard embedding
   * This is called by the Bold BI embedded SDK during dashboard loading
   * @param {string} embedQueryString - Embed query string from SDK
   * @param {string} userEmail - User email for authorization
   * @returns {Promise<string>} Authorization token
   */
  authorize: async (embedQueryString, userEmail) => {
    try {
      const url = buildApiUrl('/dashboards/authorize');
      const token = authService.getToken();

      if (!token) {
        throw new Error('Not authenticated');
      }

      console.log('[Dashboard API] POST authorize');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          embedQueryString,
          userEmail,
        }),
      });

      if (response.status === 401) {
        await authService.logout();
        throw new Error('Unauthorized - Please login again');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Authorization failed: ${response.status} ${errorText}`);
      }

      // Authorization returns plain text token
      const authToken = await response.text();
      console.log('[Dashboard API] Authorization successful');
      return authToken;
    } catch (error) {
      console.error('[Dashboard API] Authorization failed:', error.message);
      throw error;
    }
  },
};

/**
 * Default export for convenience
 */
export default dashboardsAPI;
