/**
 * Authentication Service for Bold Reports
 * Handles login, logout, and token management
 */

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
const TOKEN_KEY = 'boldreports_token';
const USER_KEY = 'boldreports_user';
const SSO_FLAG_KEY = 'boldreports_is_sso';
const SSO_ID_TOKEN_KEY = 'boldreports_id_token';

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
        } catch {
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
        localStorage.setItem(USER_KEY, JSON.stringify(loginData.user || loginData));
        // Clear any old SSO session markers on regular credential login
        localStorage.removeItem(SSO_FLAG_KEY);
        localStorage.removeItem(SSO_ID_TOKEN_KEY);
        sessionStorage.removeItem('IsSsoSession');
        sessionStorage.removeItem('IdToken');
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
   * Login using a JWT token. Backend exposes POST /auth/login with a JwtToken
   * field; we wrap it here so React callers can pretend SSO returns a JWT.
   * @param {string} jwtToken - Encoded JWT bearer token
   * @returns {Promise<object>} Login response with token and user info
   */
  loginWithToken: async (jwtToken) => {
    try {
      if (!jwtToken || typeof jwtToken !== 'string' || !jwtToken.trim()) {
        throw new Error('A non-empty JWT token is required');
      }

      const response = await fetch(buildApiUrl('/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: '',
          password: '',
          jwtToken: jwtToken.trim(),
        }),
      });

      const raw = await response.text();
      let data = null;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          console.warn('[Auth] JWT login response is not valid JSON:', raw.slice(0, 100));
        }
      }

      if (!response.ok || !(data && data.success)) {
        throw new Error(data?.message || data?.error || raw || 'JWT login failed');
      }

      const loginData = unwrapResponse(data);
      let token = loginData?.token || loginData?.sessionToken || jwtToken.trim();
      token = token.replace(/^Bearer\s+/i, '').trim();

      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(loginData.user || loginData));
      return loginData;
    } catch (error) {
      console.error('[Auth] JWT login error:', error.message);
      throw error;
    }
  },

  /**
   * Build the Keycloak authorize URL and redirect the browser there.
   * Mirrors BoldAdhocEmbed.Server.Controllers.HomeController.SSOLogin so the
   * SPA flow works even when the ASP.NET endpoint is unreachable (e.g. Vite
   * dev server without a proxy).
   *
   * The callback path defaults to the SPA-native `/sso-callback` route
   * declared in App.jsx, which avoids needing `/Home/SSOCallback` to be
   * registered in the Keycloak client's allowed redirect URIs. Callers can
   * still pass `pathPrefix: '/Home'` to mimic the server-side flow.
   *
   * @param {object} [options]
   * @param {string} [options.keycloakBase] - Override the Keycloak base URL
   * @param {string} [options.realm] - Realm (default 'master')
   * @param {string} [options.clientId] - Client (default 'crm-app')
   * @param {string} [options.pathPrefix] - Server-side route prefix to mimic
   *   (default ''). With the default, the redirect_uri is /sso-callback.
   * @returns {string} The full authorize URL
   */
  buildSsoUrl: (options = {}) => {
    const {
      keycloakBase = 'https://keycloak.boldbidemo.com',
      realm = 'master',
      clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'crm-app',
      pathPrefix = '',
      callbackPath,
      responseType = 'id_token token',
      nonce = Math.random().toString(36).substring(2) + Date.now().toString(36),
    } = options;

    // `/sso-callback` is registered in App.jsx and works in both
    // dev (Vite SPA) and prod (served by the .NET host). `/Home/SSOCallback`
    // mirrors the original server-side flow for callers that have it on
    // their Keycloak client's allowed redirect list.
    let finalCallback;
    if (callbackPath) {
      finalCallback = callbackPath;
    } else if (pathPrefix) {
      finalCallback = `${pathPrefix}/SSOCallback`;
    } else {
      finalCallback = '/sso-callback';
    }

    const redirectUri =
      `${window.location.protocol}//${window.location.host}${finalCallback}`;
    const url =
      `${keycloakBase}/realms/${realm}/protocol/openid-connect/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=${encodeURIComponent(responseType)}` +
      `&scope=openid` +
      `&nonce=${encodeURIComponent(nonce)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return url;
  },

  /**
   * Try the server-side /Home/SSOLogin route first (production), then fall
   * back to a client-side Keycloak redirect if the SPA can't reach it.
   *
   * In Vite dev mode, `/Home/SSOLogin` falls back to index.html (a 200 HTML
   * response). Following that URL inside an SPA would just re-render the
   * login page and create a redirect loop, so we explicitly detect HTML
   * responses and skip to the Keycloak-authorize endpoint instead.
   * @returns {void}
   */
  startSsoLogin: () => {
    const url = authService.buildSsoUrl();

    const goToKeycloak = () => {
      console.log('[Auth] Redirecting to Keycloak authorize URL:', url);
      window.location.href = url;
    };

    fetch('/Home/SSOLogin', { redirect: 'manual', credentials: 'include' })
      .then((res) => {
        if (!res) return goToKeycloak();

        // `opaqueredirect` is what browsers report when redirect:'manual'
        // was applied to a real 3xx Location: header — that's the happy
        // path. We can't read the Location, but the browser followed it
        // already for cookies; re-navigating to the URL would still
        // work, so just go straight to Keycloak to be safe.
        if (res.type === 'opaqueredirect') return goToKeycloak();

        // Status 0 + no URL = CORS / opaque response — server is
        // unreachable, fall back to client-side.
        if (res.status === 0 && !res.url) return goToKeycloak();

        // Anything that returned HTML (SPA fallback), redirected to a
        // non-SSO page, or 4xx/5xx — skip the server hop.
        const contentType = res.headers?.get?.('content-type') || '';
        const isHtml = contentType.includes('text/html');
        const looksLikeSso = /keycloak|sso|oauth|login/i.test(res.url || '');

        if (res.ok && !isHtml && looksLikeSso) {
          // Server sent a non-HTML redirect-like response we can trust.
          window.location.href = res.url;
          return null;
        }

        return goToKeycloak();
      })
      .catch((err) => {
        console.warn('[Auth] /Home/SSOLogin probe failed, going to Keycloak directly:', err);
        goToKeycloak();
      });
  },

  /**
   * Check whether current session was authenticated through SSO
   * @returns {boolean}
   */
  isSsoSession: () => {
    const user = authService.getUser();
    return (
      sessionStorage.getItem('IsSsoSession') === 'true' ||
      localStorage.getItem(SSO_FLAG_KEY) === 'true' ||
      user?.isSso === true
    );
  },

  /**
   * Get stored Keycloak ID Token if available
   * @returns {string|null}
   */
  getSsoIdToken: () => {
    return (
      sessionStorage.getItem('IdToken') ||
      localStorage.getItem(SSO_ID_TOKEN_KEY) ||
      null
    );
  },

  /**
   * Build the Keycloak RP-Initiated logout URL
   * @param {object} [options]
   * @param {string} [options.keycloakBase] - Base URL of Keycloak
   * @param {string} [options.realm] - Keycloak Realm
   * @param {string} [options.clientId] - Keycloak client ID
   * @param {string} [options.postLogoutRedirectUri] - Where to return after logout
   * @param {string} [options.idToken] - ID token hint
   * @returns {string} The full logout URL
   */
  buildSsoLogoutUrl: (options = {}) => {
    const {
      keycloakBase = 'https://keycloak.boldbidemo.com',
      realm = 'master',
      clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'crm-app',
      postLogoutRedirectUri = `${window.location.protocol}//${window.location.host}/login`,
      idToken = authService.getSsoIdToken(),
    } = options;

    let url =
      `${keycloakBase}/realms/${realm}/protocol/openid-connect/logout` +
      `?client_id=${encodeURIComponent(clientId)}`;

    if (idToken) {
      url += `&id_token_hint=${encodeURIComponent(idToken)}`;
    }

    if (postLogoutRedirectUri) {
      url += `&post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
    }

    return url;
  },

  /**
   * Start Keycloak SSO logout flow: tries server-side /Home/SSOLogout first,
   * then falls back to direct browser navigation to Keycloak logout.
   * @param {object} [options]
   * @returns {void}
   */
  startSsoLogout: (options = {}) => {
    const idToken = options.idToken || authService.getSsoIdToken();
    const url = authService.buildSsoLogoutUrl({ ...options, idToken });

    const goToKeycloakLogout = () => {
      console.log('[Auth] Redirecting to Keycloak logout URL:', url);
      window.location.href = url;
    };

    const serverLogoutUrl = `/Home/SSOLogout${idToken ? `?idToken=${encodeURIComponent(idToken)}` : ''}`;
    fetch(serverLogoutUrl, { redirect: 'manual', credentials: 'include' })
      .then((res) => {
        if (!res) return goToKeycloakLogout();
        if (res.type === 'opaqueredirect') return goToKeycloakLogout();
        if (res.status === 0 && !res.url) return goToKeycloakLogout();

        const contentType = res.headers?.get?.('content-type') || '';
        const isHtml = contentType.includes('text/html');
        const looksLikeSso = /keycloak|sso|oauth|logout/i.test(res.url || '');

        if (res.ok && !isHtml && looksLikeSso) {
          window.location.href = res.url;
          return null;
        }

        return goToKeycloakLogout();
      })
      .catch((err) => {
        console.warn('[Auth] /Home/SSOLogout probe failed, going to Keycloak directly:', err);
        goToKeycloakLogout();
      });
  },

  /**
   * Logout user - clear stored credentials and optionally trigger SSO logout
   * @param {object} [options]
   * @param {boolean} [options.triggerSso] - Whether to navigate to SSO logout if session is SSO
   * @param {boolean} [options.sso] - Override SSO session check
   * @param {string} [options.idToken] - Override ID token hint
   * @returns {Promise<void>}
   */
  logout: async (options = {}) => {
    const isSso = options.sso !== undefined ? options.sso : authService.isSsoSession();
    const idToken = options.idToken || authService.getSsoIdToken();

    try {
      console.log('[Auth] Logging out user (isSso =', isSso, ')');
      
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

      // Clear local storage and session storage
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SSO_FLAG_KEY);
      localStorage.removeItem(SSO_ID_TOKEN_KEY);
      sessionStorage.clear();
      window.dispatchEvent(new Event('auth-changed'));
      console.log('[Auth] Logout complete');

      if (options.triggerSso && isSso) {
        authService.startSsoLogout({ idToken });
      }
    } catch (error) {
      console.error('[Auth] Logout error:', error.message);
      // Continue with logout even if API call fails
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SSO_FLAG_KEY);
      localStorage.removeItem(SSO_ID_TOKEN_KEY);
      sessionStorage.clear();
      window.dispatchEvent(new Event('auth-changed'));

      if (options.triggerSso && isSso) {
        authService.startSsoLogout({ idToken });
      }
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

      // If token is demo/simulated token or user is stored locally, consider authenticated
      if (token.startsWith('demo-session-token-') || localStorage.getItem(USER_KEY)) {
        return true;
      }

      const response = await fetch(buildApiUrl('/auth/validate'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Don't kill local session if offline
        return !!localStorage.getItem(USER_KEY);
      }

      const data = await response.json();
      return (data.success && unwrapResponse(data)) || !!localStorage.getItem(USER_KEY);
    } catch (error) {
      console.warn('[Auth] Token validation warning:', error);
      return !!localStorage.getItem(USER_KEY);
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

