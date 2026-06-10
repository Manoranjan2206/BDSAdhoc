/**
 * Authentication Service for Bold Reports
 * Handles login, logout, and token management
 */

// Resolve API base similar to apiService so dev server requests go to backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && (window.location.port === '5173' || window.location.port === '5274')
  ? 'https://localhost:64940/api'
  : '/api');

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
const TOKEN_KEY = 'boldreports_token';
const USER_KEY = 'boldreports_user';

/**
 * Unwrap API response { success, message, data }
 */
function unwrapResponse(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }
  return payload;
}

/**
 * Authentication Service
 */
export const authService = {
  /**
   * Login with email and optional password
   * @param {string} email - User email
   * @param {string} password - Optional password
   * @returns {Promise<object>} Login response with token and user info
   */
  login: async (email, password = '') => {
    try {
      console.log('[Auth] Logging in user:', email);
      
      const response = await fetch(buildApiUrl('/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password || '',
        }),
      });

      // Read raw text first so we can handle empty or non-JSON responses
      const raw = await response.text();
      let data = null;
      if (raw && raw.length > 0) {
        try {
          data = JSON.parse(raw);
        } catch (err) {
          console.warn('[Auth] Response is not valid JSON:', raw.slice(0, 100));
        }
      }

      if (!response.ok || !(data && data.success)) {
        console.error('[Auth] Login failed:', data?.message || data?.error || raw || response.statusText);
        throw new Error(data?.message || data?.error || raw || 'Login failed');
      }

      const loginData = unwrapResponse(data);
      
      // Store token and user info in localStorage
      // Support both 'token' and 'sessionToken' field names
      let token = loginData.token || loginData.sessionToken;
      if (token) {
        // Normalize token: remove any leading "Bearer " or "bearer " prefixes
        token = token.replace(/^Bearer\s+/i, '').trim();
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(loginData));
        console.log('[Auth] Login successful, token stored');
        return loginData;
      } else {
        console.error('[Auth] No token found in login response');
        throw new Error('No authentication token received');
      }
    } catch (error) {
      console.error('[Auth] Login error:', error.message);
      throw error;
    }
  },

  /**
   * Logout user - clear stored credentials
   * @returns {Promise<void>}
   */
  logout: async () => {
    try {
      console.log('[Auth] Logging out user');
      
      // Notify backend
      const token = authService.getToken();
      if (token) {
        await fetch(buildApiUrl('/auth/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).catch(err => console.warn('[Auth] Logout notification failed:', err));
      }

      // Clear local storage
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      console.log('[Auth] Logout complete');
    } catch (error) {
      console.error('[Auth] Logout error:', error.message);
      // Continue with logout even if API call fails
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },

  /**
   * Get stored authentication token
   * @returns {string|null} Token or null if not set
   */
  getToken: () => {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Get stored user information
   * @returns {object|null} User object or null if not logged in
   */
  getUser: () => {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('[Auth] Error parsing user data:', error);
      return null;
    }
  },

  /**
   * Check if user is authenticated
   * @returns {boolean} True if token exists
   */
  isAuthenticated: () => {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Validate token with backend
   * @returns {Promise<boolean>} True if token is valid
   */
  validateToken: async () => {
    try {
      const token = authService.getToken();
      if (!token) return false;

      const response = await fetch(buildApiUrl('/auth/validate'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      return data.success && unwrapResponse(data);
    } catch (error) {
      console.error('[Auth] Token validation failed:', error);
      return false;
    }
  },

  /**
   * Get current user info from token
   * @returns {Promise<object|null>} User info or null
   */
  getCurrentUser: async () => {
    try {
      const token = authService.getToken();
      if (!token) return null;

      const response = await fetch(buildApiUrl('/auth/me'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.success) {
        return unwrapResponse(data);
      }
      return null;
    } catch (error) {
      console.error('[Auth] Get current user failed:', error);
      return null;
    }
  },

  /**
   * Add authorization header to fetch options
   * @param {object} options - Fetch options
   * @returns {object} Options with auth header
   */
  withAuth: (options = {}) => {
    const token = authService.getToken();
    if (!token) return options;

    return {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': token,
      },
    };
  },
};

export default authService;
