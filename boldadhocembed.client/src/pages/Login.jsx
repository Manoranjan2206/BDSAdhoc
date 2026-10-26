import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

const TENANT_USERS = [
  // AlphaCorp (Tenant 1)
  { email: 'alpha1@alphacorp.com', name: 'Anna Smith', role: 'Admin', tenantId: 1, tenantName: 'AlphaCorp', region: 'North America', avatar: 'https://randomuser.me/api/portraits/women/11.jpg', pwd: 'Password123!' },
  { email: 'alpha2@alphacorp.com', name: 'John Doe', role: 'Sales', tenantId: 1, tenantName: 'AlphaCorp', region: 'Europe', avatar: 'https://randomuser.me/api/portraits/men/12.jpg', pwd: 'Password123!' },
  { email: 'alpha3@alphacorp.com', name: 'Linda Lee', role: 'Finance', tenantId: 1, tenantName: 'AlphaCorp', region: 'Asia', avatar: 'https://randomuser.me/api/portraits/women/13.jpg', pwd: 'Password123!' },
  { email: 'alpha4@alphacorp.com', name: 'Mike Brown', role: 'Support', tenantId: 1, tenantName: 'AlphaCorp', region: 'Oceania', avatar: 'https://randomuser.me/api/portraits/men/14.jpg', pwd: 'Password123!' },
  { email: 'alpha5@alphacorp.com', name: 'Chris Green', role: 'Operations', tenantId: 1, tenantName: 'AlphaCorp', region: 'Oceania', avatar: 'https://randomuser.me/api/portraits/men/15.jpg', pwd: 'Password123!' },

  // BetaSolutions (Tenant 2)
  { email: 'beta1@betasolutions.com', name: 'Betty Jones', role: 'Admin', tenantId: 2, tenantName: 'BetaSolutions', region: 'North America', avatar: 'https://randomuser.me/api/portraits/men/21.jpg', pwd: 'Password123!' },
  { email: 'beta2@betasolutions.com', name: 'Julia King', role: 'Sales', tenantId: 2, tenantName: 'BetaSolutions', region: 'Europe', avatar: 'https://randomuser.me/api/portraits/women/22.jpg', pwd: 'Password123!' },
  { email: 'beta3@betasolutions.com', name: 'Brian Adams', role: 'Finance', tenantId: 2, tenantName: 'BetaSolutions', region: 'Asia', avatar: 'https://randomuser.me/api/portraits/men/23.jpg', pwd: 'Password123!' },
  { email: 'beta4@betasolutions.com', name: 'Diana Miller', role: 'Support', tenantId: 2, tenantName: 'BetaSolutions', region: 'Oceania', avatar: 'https://randomuser.me/api/portraits/women/24.jpg', pwd: 'Password123!' },
  { email: 'beta5@betasolutions.com', name: 'Eliza Scott', role: 'Operations', tenantId: 2, tenantName: 'BetaSolutions', region: 'Oceania', avatar: 'https://randomuser.me/api/portraits/women/25.jpg', pwd: 'Password123!' },

  // GammaIndustries (Tenant 3)
  { email: 'gamma1@gammaindustries.com', name: 'George William', role: 'Admin', tenantId: 3, tenantName: 'GammaIndustries', region: 'North America', avatar: 'https://randomuser.me/api/portraits/men/31.jpg', pwd: 'Password123!' },
  { email: 'gamma2@gammaindustries.com', name: 'Jack Black', role: 'Sales', tenantId: 3, tenantName: 'GammaIndustries', region: 'Europe', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', pwd: 'Password123!' },
  { email: 'gamma3@gammaindustries.com', name: 'Olivia Martin', role: 'Finance', tenantId: 3, tenantName: 'GammaIndustries', region: 'Asia', avatar: 'https://randomuser.me/api/portraits/women/33.jpg', pwd: 'Password123!' },
  { email: 'gamma4@gammaindustries.com', name: 'Sophia White', role: 'Support', tenantId: 3, tenantName: 'GammaIndustries', region: 'Oceania', avatar: 'https://randomuser.me/api/portraits/women/34.jpg', pwd: 'Password123!' },
  { email: 'gamma5@gammaindustries.com', name: 'Noah Clark', role: 'Operations', tenantId: 3, tenantName: 'GammaIndustries', region: 'Oceania', avatar: 'https://randomuser.me/api/portraits/men/35.jpg', pwd: 'Password123!' },

  // DeltaEnterprises (Tenant 4)
  { email: 'delta1@deltaenterprises.com', name: 'Megan Young', role: 'Admin', tenantId: 4, tenantName: 'DeltaEnterprises', region: 'North America', avatar: 'https://randomuser.me/api/portraits/women/41.jpg', pwd: 'Password123!' },
  { email: 'delta2@deltaenterprises.com', name: 'Zoe Turner', role: 'Sales', tenantId: 4, tenantName: 'DeltaEnterprises', region: 'Europe', avatar: 'https://randomuser.me/api/portraits/women/42.jpg', pwd: 'Password123!' },
  { email: 'delta3@deltaenterprises.com', name: 'Ryan Evans', role: 'Finance', tenantId: 4, tenantName: 'DeltaEnterprises', region: 'Asia', avatar: 'https://randomuser.me/api/portraits/men/43.jpg', pwd: 'Password123!' },
  { email: 'delta4@deltaenterprises.com', name: 'Liam Cooper', role: 'Support', tenantId: 4, tenantName: 'DeltaEnterprises', region: 'Oceania', avatar: 'https://randomuser.me/api/portraits/men/44.jpg', pwd: 'Password123!' },
  { email: 'delta5@deltaenterprises.com', name: 'Emma Hall', role: 'Operations', tenantId: 4, tenantName: 'DeltaEnterprises', region: 'Oceania', avatar: 'https://randomuser.me/api/portraits/women/45.jpg', pwd: 'Password123!' },
];

// Sample login data shown at the bottom of the right column when the
// "Show sample logins" checkbox is enabled.
const SAMPLE_LOGINS_TABLE = [
  { username: 'alpha1@alphacorp.com', password: 'alpha1', tenant: 'AlphaCorp', access: 'Admin / All', filters: 'North America' },
  { username: 'alpha2@alphacorp.com', password: 'alpha2', tenant: 'AlphaCorp', access: 'Sales / Pipeline', filters: 'Europe' },
  { username: 'beta1@betasolutions.com', password: 'beta1', tenant: 'BetaSolutions', access: 'Admin / All', filters: 'North America' },
  { username: 'gamma1@gammaindustries.com', password: 'gamma1', tenant: 'GammaIndustries', access: 'Admin / All', filters: 'North America' },
  { username: 'delta1@deltaenterprises.com', password: 'delta1', tenant: 'DeltaEnterprises', access: 'Admin / All', filters: 'North America' },
];

export default function Login() {
  const navigate = useNavigate();
  const [selectedUserEmail, setSelectedUserEmail] = useState('alpha1@alphacorp.com');
  const [showJwtInput, setShowJwtInput] = useState(false);
  const [jwtToken, setJwtToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSampleLogins, setShowSampleLogins] = useState(false);

  const selectedUser = TENANT_USERS.find(u => u.email === selectedUserEmail) || TENANT_USERS[0];

  useEffect(() => {
    if (authService.isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (showJwtInput) {
        if (!jwtToken.trim()) throw new Error('Please paste a valid JWT token');
        await authService.loginWithToken(jwtToken);
      } else {
        await authService.login(selectedUser.email, selectedUser.pwd);
      }

      window.dispatchEvent(new Event('auth-changed'));
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSsoLogin = () => {
    try {
      authService.startSsoLogin();
    } catch (err) {
      console.error('SSO login failed to start:', err);
      setError('SSO login could not be started. Please try again.');
    }
  };

  const handleAzureLogin = () => {
    try {
      // Redirect to backend Azure AD login endpoint
      // The backend will handle the OIDC flow and redirect back with a token
      window.location.href = '/api/auth/login-azure';
    } catch (err) {
      console.error('Azure AD login failed to start:', err);
      setError('Azure AD login could not be started. Please try again.');
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'Admin') return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300';
    if (role === 'Sales') return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300';
    if (role === 'Finance') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300';
    if (role === 'Support') return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-300';
    return 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-300';
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center py-4 sm:py-6 px-4 sm:px-6 lg:px-8 relative overflow-y-auto">
      {/* Decorative Blobs */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-5xl mx-auto w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden mx-auto mb-2 shadow-lg shadow-primary/25 ring-2 ring-primary/20 transition-transform duration-300 hover:scale-105">
            <img
              src="/acme-logo.png"
              alt="ACME CRM Suite Logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/acme-logo.svg';
              }}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
            ACME CRM Suite
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Enterprise Multi-Tenant CRM & Analytics Portal
          </p>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-stretch">
          {/* Left Info Panel (5 cols) */}
          <div className="md:col-span-5 glass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-bold text-sm text-on-surface mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">security</span>
                RLS & RBAC Security Model
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                Sign in with any user account below. Reports, dashboards, pipeline data, and support cases automatically adapt based on your <strong>Tenant Database</strong> and <strong>Assigned Region</strong>.
              </p>

              <div className="space-y-2">
                <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/30 flex items-start gap-2">
                  <span className="material-symbols-outlined text-role-finance text-[18px] mt-0.5">verified_user</span>
                  <div className="text-xs">
                    <strong className="text-on-surface">Row-Level Security (RLS)</strong>
                    <p className="text-on-surface-variant text-[11px]">Filtered via PostgreSQL session variable by user region.</p>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/30 flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">database</span>
                  <div className="text-xs">
                    <strong className="text-on-surface">Dedicated Tenant DBs</strong>
                    <p className="text-on-surface-variant text-[11px]">AlphaCorp, BetaSolutions, Gamma, Delta in Docker Postgres.</p>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/30 flex items-start gap-2">
                  <span className="material-symbols-outlined text-role-sales text-[18px] mt-0.5">pie_chart</span>
                  <div className="text-xs">
                    <strong className="text-on-surface">Embedded Analytics</strong>
                    <p className="text-on-surface-variant text-[11px]">Interactive Bold BI & Bold Reports embedded directly.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-on-surface-variant border-t border-glass-border pt-2">
              💡 <strong>Tip:</strong> Admin accounts see ALL regions, while Sales/Finance/Support/Ops see only their assigned region.
            </div>
          </div>

          {/* Right Login Card (7 cols) */}
          <div className="md:col-span-7 glass-card rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-center space-y-4">
            {error && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-xs mb-1 border border-red-200">
                {error}
              </div>
            )}

            {/* Direct Demo / Local Account Login */}
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Choose Enterprise User (Direct Sign-In)
                </label>
                <select
                  value={selectedUserEmail}
                  onChange={(e) => setSelectedUserEmail(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:ring-primary"
                >
                  {['AlphaCorp', 'BetaSolutions', 'GammaIndustries', 'DeltaEnterprises'].map(tenant => (
                    <optgroup key={tenant} label={tenant}>
                      {TENANT_USERS.filter(u => u.tenantName === tenant).map(u => (
                        <option key={u.email} value={u.email}>
                          {u.name} ({u.role}) — {u.region} [{u.email}]
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Selected User Preview Card */}
              <div className="p-2.5 rounded-xl bg-surface-container-high border border-glass-border flex items-center gap-2.5">
                <img
                  src={selectedUser.avatar}
                  alt={selectedUser.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-primary shadow-sm flex-shrink-0"
                />
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-on-surface truncate">{selectedUser.name}</h4>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getRoleBadge(selectedUser.role)}`}>
                      {selectedUser.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant truncate">{selectedUser.email}</p>
                  <p className="text-[11px] text-primary font-medium">{selectedUser.tenantName} • Region: {selectedUser.region}</p>
                </div>
              </div>

              {showJwtInput ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-on-surface-variant">Custom JWT Token</label>
                    <button
                      type="button"
                      onClick={() => setShowJwtInput(false)}
                      className="text-[11px] text-primary hover:underline cursor-pointer"
                    >
                      Use Demo Password
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Paste encoded JWT token here..."
                    value={jwtToken}
                    onChange={(e) => setJwtToken(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-xl p-2 text-xs font-mono text-on-surface focus:ring-primary"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-on-surface-variant font-medium">
                    Password: <span className="font-mono text-on-surface">••••••••••••</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowJwtInput(true)}
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    Paste Custom JWT
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary text-xs py-2.5 font-bold rounded-xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer mt-1"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">login</span>
                    Sign In to {selectedUser.tenantName}
                  </>
                )}
              </button>
            </form>

            {/* SSO Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-outline-variant/30"></div>
              <span className="flex-shrink mx-3 text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">
                Enterprise Single Sign-On
              </span>
              <div className="flex-grow border-t border-outline-variant/30"></div>
            </div>

            {/* Enterprise SSO Options */}
            <div className="space-y-3">
              {/* Microsoft Azure AD Option (Corporate - NO sample logins) */}
              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/60 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-white dark:bg-slate-900 shadow-xs flex items-center justify-center p-1 border border-blue-200/50">
                      <svg className="w-full h-full" viewBox="0 0 24 24">
                        <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                        <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
                        <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
                        <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        Microsoft Azure AD / Entra ID
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">Corporate</span>
                      </h4>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAzureLogin}
                  className="w-full bg-[#0078D4] hover:bg-[#006cbd] text-white text-xs py-2 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md active:scale-[0.99]"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                    <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
                    <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
                    <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
                  </svg>
                  <span>Sign In with Microsoft Azure AD</span>
                </button>
              </div>

              {/* Keycloak SSO Option (With Sample Logins strictly inside / next to it) */}
              <div className="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/40 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-[16px]">key</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        Keycloak SSO
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-primary/15 text-primary">Federated Realm</span>
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Keycloak Action Row: Sign In Button + Show Keycloak Sample Logins Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSsoLogin}
                    className="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 hover:border-primary/60 text-xs py-2 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
                  >
                    <span className="material-symbols-outlined text-primary text-[17px]">login</span>
                    <span>Sign In with Keycloak SSO</span>
                  </button>

                  {/* Button placed right next to Keycloak button */}
                  <button
                    type="button"
                    onClick={() => setShowSampleLogins(!showSampleLogins)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                      showSampleLogins
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface-container hover:bg-surface-container-high text-primary border-primary/40 hover:border-primary'
                    }`}
                    title="Keycloak-only test credentials"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {showSampleLogins ? 'visibility_off' : 'badge'}
                    </span>
                    <span>{showSampleLogins ? 'Hide Sample Logins' : 'Show Sample Logins (Keycloak only)'}</span>
                  </button>
                </div>

                {/* Keycloak Sample Logins Table (Strictly inside Keycloak card) */}
                {showSampleLogins && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-high/90 p-2.5 animate-fadeIn">
                    <div className="flex items-center gap-1.5 text-[11px] text-primary font-semibold mb-1">
                      <span className="material-symbols-outlined text-[14px]">info</span>
                      <span>Keycloak Test Credentials (enter on Keycloak screen):</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] text-on-surface">
                        <thead className="bg-surface-container text-on-surface-variant">
                          <tr>
                            <th className="px-2 py-1 text-left font-semibold">Keycloak Username</th>
                            <th className="px-2 py-1 text-left font-semibold">Password</th>
                            <th className="px-2 py-1 text-left font-semibold">Tenant</th>
                            <th className="px-2 py-1 text-left font-semibold">Access</th>
                            <th className="px-2 py-1 text-left font-semibold">Filters</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SAMPLE_LOGINS_TABLE.map((row) => (
                            <tr key={row.username} className="border-t border-outline-variant/20 even:bg-surface-container/40">
                              <td className="px-2 py-1 font-mono text-primary font-medium">{row.username}</td>
                              <td className="px-2 py-1 font-mono">{row.password}</td>
                              <td className="px-2 py-1">{row.tenant}</td>
                              <td className="px-2 py-1">{row.access}</td>
                              <td className="px-2 py-1">{row.filters}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}