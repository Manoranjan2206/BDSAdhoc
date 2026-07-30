import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import '../styles/Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [demoUsers, setDemoUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDemoUsers = async () => {
      try {
        const res = await fetch('/api/auth/users');
        const data = await res.json();
        if (data && data.success) {
          setDemoUsers(data.data || []);
        }
      } catch (err) {
        console.error('Failed to load demo users:', err);
      }
    };
    fetchDemoUsers();
  }, []);

  // Redirect to home if already authenticated
  useEffect(() => {
    if (authService.isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validate email
      if (!email.trim()) {
        throw new Error('Email is required');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Attempt login
      const loginData = await authService.login(email, password);

      if (loginData && (loginData.token || loginData.sessionToken)) {
        // Login successful, navigate to home with replace: true to clear history stack
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* Left hero — restored original Bold Reports content (no hexagon) */}
        <div className="login-hero">
          <div className="hero-panel">
            <div className="side-content">
              <h2>Welcome to Acme Analytics</h2>
              <p>
                Create, share, and manage beautiful reports with ease. Enterprise-grade reporting solution for your organization.
              </p>
              <ul className="features-list">
                <li>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
                  </svg>
                  Interactive Report Viewer
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
                  </svg>
                  Advanced Design Tools
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
                  </svg>
                  Scheduled Exports
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
                  </svg>
                  Team Collaboration
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right card with existing form (keeps functionality) */}
        <div className="login-card">
          <div className="login-box">
            <div className="login-header">
              <div className="logo-section">
                <div className="logo-icon">
                  <svg width="48" height="48" viewBox="0 0 128 128" fill="none">
                    <defs>
                      <linearGradient id="acmeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FF4800" />
                        <stop offset="100%" stopColor="#FF7F50" />
                      </linearGradient>
                      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#131F3B" />
                        <stop offset="100%" stopColor="#1E293B" />
                      </linearGradient>
                    </defs>
                    <rect width="128" height="128" rx="32" fill="url(#bgGrad)" />
                    <g transform="translate(24, 28)">
                      <rect x="12" y="32" width="12" height="40" rx="6" fill="#006CDD" />
                      <rect x="34" y="12" width="12" height="60" rx="6" fill="url(#acmeGrad)" />
                      <rect x="56" y="24" width="12" height="48" rx="6" fill="#34D399" />
                      <rect x="18" y="44" width="44" height="8" rx="4" fill="#FFFFFF" opacity="0.9" />
                    </g>
                  </svg>
                </div>
                <h1>Acme Analytics</h1>
              </div>
              <p className="login-subtitle">Sign in to your account</p>
            </div>

            {error && (
              <div className="error-message">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {error}
              </div>
            )}

            {/* Quick Demo User Selection */}
            <div className="mb-6 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-700/60">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 text-left">Quick Demo User Selection</p>
              <div className="grid grid-cols-3 gap-2">
                {(demoUsers.length > 0 ? demoUsers : [
                  { email: 'admin@example.com', name: 'Admin User', role: 'Admin' },
                  { email: 'sales@example.com', name: 'Sales User', role: 'Sales' },
                  { email: 'manager@example.com', name: 'Manager User', role: 'Manager' }
                ]).map((u) => {
                  const pwd = u.email.includes('admin') ? 'admin123' : u.email.includes('sales') ? 'sales123' : 'manager123';
                  return (
                    <button
                      key={u.email}
                      type="button"
                      onClick={async () => {
                        setEmail(u.email);
                        setPassword(pwd);
                        setIsLoading(true);
                        setError('');
                        try {
                          const loginData = await authService.login(u.email, pwd);
                          if (loginData && (loginData.token || loginData.sessionToken)) {
                            navigate('/', { replace: true });
                          }
                        } catch (err) {
                          setError(err.message || 'Login failed.');
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      className="flex flex-col items-center p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#FF4800] dark:hover:border-[#FF4800] hover:shadow-md transition text-center cursor-pointer select-none"
                      style={{ cursor: 'pointer' }}
                      title={`Login as ${u.name}`}
                    >
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full">{u.role}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5 truncate w-full">{u.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                </div>
                <div className="password-field">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="form-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    )}
                  </button>
                </div>
                <p className="field-hint">
                  Password is optional. You can sign in with just your email using your system credentials.
                </p>
              </div>

              <button type="submit" disabled={isLoading} className="login-button green">
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="login-footer">
              <div className="footer-divider">
                <span>Secure Organization Login</span>
              </div>
              <p className="footer-text">Access your Acme Analytics workspace with your organization credentials</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

