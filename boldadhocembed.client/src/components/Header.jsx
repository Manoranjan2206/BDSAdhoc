import {
  BellIcon,
  SunIcon,
  MoonIcon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useData } from '../context/DataContext';

export default function Header({ darkMode, onToggleDarkMode }) {
  const { getReports, getDashboards } = useData();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState([]);
  const [user, setUser] = useState(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Load user info on mount
  useEffect(() => {
    const currentUser = authService.getUser();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  // Search handler
  useEffect(() => {
    let active = true;
    const run = async () => {
      const term = (searchValue || '').trim().toLowerCase();
      if (term.length < 2) { setResults([]); return; }
      try {
        const [reports, dashboards] = await Promise.all([
          getReports(),
          getDashboards(),
        ]);
        const rep = (Array.isArray(reports) ? reports : []).flatMap(cat =>
          (cat.Reports || cat.reports || []).map(r => ({
            type: 'report',
            id: r.Id || r.id,
            name: r.Name || r.name,
            category: cat.Name || cat.name,
          }))
        ).filter(x => (x.name || '').toLowerCase().includes(term) || (x.category || '').toLowerCase().includes(term));

        const dash = (Array.isArray(dashboards) ? dashboards : []).map(d => ({
          type: 'dashboard',
          id: d.Id || d.id,
          name: d.Name || d.name,
          category: d.CategoryName || d.category,
        })).filter(x => (x.name || '').toLowerCase().includes(term) || (x.category || '').toLowerCase().includes(term));

        if (active) setResults([ ...rep.slice(0, 10), ...dash.slice(0, 10) ].slice(0, 10));
      } catch (e) {
        if (active) setResults([]);
      }
    };
    run();
    return () => { active = false; };
  }, [searchValue, getReports, getDashboards]);

  const handleLogout = async () => {
    try {
      await authService.logout();
      setShowProfileMenu(false);
      setShowLogoutConfirm(false);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Clear auth anyway and redirect
      localStorage.removeItem('boldreports_token');
      localStorage.removeItem('boldreports_user');
      setShowProfileMenu(false);
      setShowLogoutConfirm(false);
      navigate('/login');
    }
  };

  const getInitials = () => {
    if (!user) return 'U';
    
    // Try to get initials from name field
    if (user.name) {
      const nameParts = user.name.split(' ');
      const firstInitial = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() : '';
      const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0).toUpperCase() : '';
      return (firstInitial + lastInitial) || firstInitial || 'U';
    }
    
    // Fallback to firstName/lastName if available
    const firstInitial = user.firstName ? user.firstName.charAt(0).toUpperCase() : '';
    const lastInitial = user.lastName ? user.lastName.charAt(0).toUpperCase() : '';
    if (firstInitial || lastInitial) {
      return (firstInitial + lastInitial) || firstInitial || 'U';
    }
    
    // Last resort: use email
    return user.email ? user.email.charAt(0).toUpperCase() : 'U';
  };

  const getUserName = () => {
    if (!user) return 'User';
    return user.name || user.fullName || user.firstName || user.email || 'User';
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-[2000]" style={{ background: 'var(--surface)', borderBottom: '2px solid var(--brand-200)' }}>
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold hidden md:block" style={{ color: 'var(--brand-700)' }}>
          Bold Reports Explorer
        </h1>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-2xl px-4 hidden md:block">
        <div className="relative">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search reports, dashboards..."
            className="w-full pl-4 pr-10 py-2.5 rounded-full border"
            style={{ borderColor: 'var(--brand-200)', background: 'var(--surface)', color: 'var(--text-strong)' }}
          />
          {searchValue && (
            <button
              onClick={() => { setSearchValue(''); setResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition"
              title="Clear"
              style={{ background: 'transparent' }}
            >
              <XMarkIcon className="h-5 w-5" style={{ color: '#7C84A1' }} />
            </button>
          )}

          {(searchValue && results.length > 0) && (
            <div className="absolute mt-2 w-full rounded-xl shadow-xl z-40 max-h-80 overflow-auto"
                 style={{ background: 'var(--surface)', border: '1px solid var(--brand-200)' }}>
              {results.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (r.type === 'report') {
                      const q = new URLSearchParams();
                      q.set('report', r.name);
                      if (r.category) q.set('category', r.category);
                      navigate(`/reports?${q.toString()}`);
                    } else if (r.type === 'dashboard') {
                      const q = new URLSearchParams();
                      q.set('dashboardId', r.id);
                      navigate(`/dashboards?${q.toString()}`);
                    }
                    setSearchValue('');
                    setResults([]);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition flex items-center justify-between"
                >
                  <span className="text-sm text-gray-800 dark:text-gray-100">
                    {r.name}
                    {r.category ? <span className="text-xs text-gray-500"> — {r.category}</span> : null}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {r.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 transition" style={{ color: 'var(--text-strong)' }}>
          <BellIcon className="h-6 w-6" />
          <span className="absolute top-0 right-0 h-2.5 w-2.5 bg-red-500 rounded-full ring-2" style={{ boxShadow: '0 0 0 2px var(--surface) inset' }} />
        </button>

        <button
          onClick={onToggleDarkMode}
          className="p-2 transition"
          style={{ color: 'var(--text-strong)' }}
        >
          {darkMode ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
              {getInitials()}
            </div>
            <div className="hidden lg:flex flex-col items-start">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {getUserName()}
              </span>
              <span className="text-xs text-gray-500">{user?.email}</span>
            </div>
            <ChevronDownIcon className={`hidden lg:block h-4 w-4 text-gray-600 dark:text-gray-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {getUserName()}
                </p>
                <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
              </div>
              <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                Profile Settings
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                Account
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                Help & Support
              </a>
              <button
                onClick={() => {
                  setShowLogoutConfirm(true);
                  setShowProfileMenu(false);
                }}
                className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700 transition cursor-pointer font-medium"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowLogoutConfirm(false)}
          ></div>
          
          {/* Modal Content */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 max-w-sm w-full p-6 text-center transform transition-all scale-100">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Confirm Logout
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to sign out of your account? You will need to log in again to access your reports and dashboards.
            </p>
            
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-sm font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition shadow-lg shadow-red-600/20 cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}