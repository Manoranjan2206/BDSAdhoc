import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';

// Mirror of the ASP.NET MVC HomeController.SSOSignIn mapping:
//     company = tenantId switch { 1=>"AlphaCorp", 2=>"BetaSolutions", 3=>"GammaIndustries", 4=>"DeltaEnterprises", _=>"" }
// The React side must read `email`, `role`, `region`, and `tenantId` out of
// the JWT instead of inferring them from the email string.
function getCompanyFromTenantId(tenantId) {
  switch (tenantId) {
    case 1: return 'AlphaCorp';
    case 2: return 'BetaSolutions';
    case 3: return 'GammaIndustries';
    case 4: return 'DeltaEnterprises';
    default: return '';
  }
}

function decodeJwtClaims(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return json || {};
  } catch (e) {
    console.warn('Failed to parse JWT payload', e);
    return {};
  }
}

export default function SSOCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('Processing Keycloak SSO login...');
  const [error, setError] = useState('');

  useEffect(() => {
    const processSso = async () => {
      try {
      // Keycloak OAuth response_type=token returns parameters in hash (#access_token=... or ?access_token=...)
      const hash = window.location.hash.substring(1);
      const search = window.location.search.substring(1);
      const params = new URLSearchParams(hash || search);

      const accessToken = params.get('access_token') || params.get('token');
      const idToken = params.get('id_token');
      const tokenToUse = accessToken || idToken;

      if (tokenToUse) {
        // Read the same claims the MVC SSOSignIn controller reads:
        //   email, role, region, tenantId  →  derive company from tenantId.
        const claims = decodeJwtClaims(tokenToUse);
        const email = claims.email || claims.preferred_username || 'sso.user@example.com';
        const name = claims.name || claims.given_name || email.split('@')[0];
        const role = claims.role || '';
        const region = claims.region || '';
        const tenantIdRaw = claims.tenantId;
        const tenantId = tenantIdRaw === undefined || tenantIdRaw === null
          ? 0
          : (typeof tenantIdRaw === 'string' ? parseInt(tenantIdRaw, 10) : tenantIdRaw);
        const tenantName = getCompanyFromTenantId(tenantId);

        const userData = {
          email,
          name,
          role,
          tenantId,
          tenantName,
          region,
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(email),
        };

        // Exchange the external token with the server before accepting the
        // session. Local development receives a local signed JWT; a deployed
        // Keycloak configuration can preserve the validated provider token.
        const loginData = await authService.loginWithToken(tokenToUse);
        localStorage.setItem('boldreports_user', JSON.stringify(loginData?.user || userData));
        // Mirror MVC Session keys so any code reading either source is happy.
        sessionStorage.setItem('CurrentUser', email);
        sessionStorage.setItem('CurrentRole', role);
        sessionStorage.setItem('CurrentRegion', region);
        sessionStorage.setItem('TenantId', String(tenantId));
        sessionStorage.setItem('CurrentCompany', tenantName);
        sessionStorage.setItem('CustomAttribute', String(tenantId));
        if (idToken) sessionStorage.setItem('IdToken', idToken);

        window.dispatchEvent(new Event('auth-changed'));
        setStatus('SSO Login successful! Redirecting...');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 500);
      } else {
        setError('Keycloak did not return an access token. Please start SSO again.');
        setStatus('Keycloak login was not completed.');
      }
      } catch (err) {
        console.error('SSO Callback error:', err);
        setError(err.message || 'SSO authentication failed');
      }
    };

    processSso();
  }, [navigate, location]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center p-6 text-center">
      <div className="glass-card rounded-2xl p-8 max-w-md w-full shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-2xl mx-auto mb-4 shadow-md">
          <span className="material-symbols-outlined text-[28px]">key</span>
        </div>
        <h2 className="text-xl font-bold text-on-surface mb-2">Keycloak SSO Authentication</h2>
        {error ? (
          <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 rounded-lg text-sm mb-4">
            {error}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-sm text-on-surface-variant">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p>{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
