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

export default function Login() {
  const navigate = useNavigate();
  const [selectedUserEmail, setSelectedUserEmail] = useState('alpha1@alphacorp.com');
  const [activeTab, setActiveTab] = useState('user'); // user | jwt
  const [jwtToken, setJwtToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      if (activeTab === 'jwt') {
        if (!jwtToken.trim()) throw new Error('Please paste a valid JWT token');
        await authService.loginWithToken(jwtToken);
      } else {
        // Log in as the selected multi-tenant user
        const userData = {
          email: selectedUser.email,
          name: selectedUser.name,
          role: selectedUser.role,
          tenantId: selectedUser.tenantId,
          tenantName: selectedUser.tenantName,
          region: selectedUser.region,
          avatarUrl: selectedUser.avatar,
        };
        localStorage.setItem('boldreports_user', JSON.stringify(userData));
        localStorage.setItem('boldreports_token', 'demo-session-token-' + selectedUser.email);
      }

      window.dispatchEvent(new Event('auth-changed'));
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
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
          <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-xl mx-auto mb-2 shadow-md">
            B
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
            BDS CRM Suite
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
          <div className="md:col-span-7 glass-card rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-center">
            {/* Tabs */}
            <div className="flex border-b border-glass-border mb-4">
              <button
                onClick={() => setActiveTab('user')}
                className={`pb-2.5 text-xs font-bold border-b-2 mr-6 transition-colors ${
                  activeTab === 'user'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Select User Account
              </button>
              <button
                onClick={() => setActiveTab('jwt')}
                className={`pb-2.5 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === 'jwt'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Custom JWT Token
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-xs mb-3 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3">
              {activeTab === 'user' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                      Choose Enterprise User
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

                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">Password</label>
                    <input
                      type="password"
                      readOnly
                      value="••••••••••••"
                      className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface cursor-not-allowed"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">JWT Token Payload</label>
                  <textarea
                    rows={3}
                    placeholder="Paste encoded JWT token here..."
                    value={jwtToken}
                    onChange={(e) => setJwtToken(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-xl p-2.5 text-xs font-mono text-on-surface focus:ring-primary"
                  />
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
          </div>
        </div>
      </div>
    </div>
  );
}
