import {
  BellIcon,
  SunIcon,
  MoonIcon,
  ChevronDownIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  QuestionMarkCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { useData } from '../context/DataContext';
import { reportsAPI } from '../services/apiService';

export default function Header({ darkMode, onToggleDarkMode }) {
  const { getReports, getDashboards } = useData();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [user, setUser] = useState(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Resources dropdown state and ref
  const [showResourcesMenu, setShowResourcesMenu] = useState(false);
  const resourcesRef = useRef(null);

  // Load user info on mount
  const [reportsSettings, setReportsSettings] = useState(null);

  // Profile modal states
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    const currentUser = authService.getUser();
    setUser(currentUser?.user || currentUser);

    const fetchSettings = async () => {
      try {
        const settings = await reportsAPI.getViewerSettings();
        setReportsSettings(settings);
      } catch (e) {
        console.warn('Failed to load viewer settings in Header', e);
      }
    };
    fetchSettings();
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setResults([]);
      }
      if (resourcesRef.current && !resourcesRef.current.contains(event.target)) {
        setShowResourcesMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear search results and close menus when navigating
  useEffect(() => {
    setSearchValue('');
    setResults([]);
    setShowResourcesMenu(false);
  }, [location.pathname]);

  // Search handler
  useEffect(() => {
    let active = true;
    const run = async () => {
      const term = (searchValue || '').trim().toLowerCase();
      if (term.length < 2) { setResults([]); setSearchLoading(false); return; }
      setSearchLoading(true);
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

        if (active) {
          setResults([...rep.slice(0, 10), ...dash.slice(0, 10)].slice(0, 10));
          setSearchLoading(false);
        }
      } catch (e) {
        if (active) { setResults([]); setSearchLoading(false); }
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

  const getRoleColorClass = (role) => {
    const r = (role || '').toLowerCase();
    if (r === 'admin') return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300';
    if (r === 'sales') return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300';
    if (r === 'finance') return 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300';
    if (r === 'support') return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300';
    if (r === 'operations') return 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300';
    return 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const tenantName = user?.tenantName || (user?.email?.includes('alpha') ? 'AlphaCorp' : user?.email?.includes('beta') ? 'BetaSolutions' : user?.email?.includes('gamma') ? 'GammaIndustries' : user?.email?.includes('delta') ? 'DeltaEnterprises' : 'AlphaCorp');
  const userRegion = user?.region || 'North America';
  const userRole = user?.role || 'Admin';

  return (
    <header className="h-16 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-[2000] glass-header bg-[#f8f9ff]/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border-b border-glass-border">
      {/* Left: Tenant Badge & Region */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-lg text-primary dark:text-purple-400">
            {tenantName}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1 bg-surface-container text-on-surface-variant border-outline-variant/40">
            <span className="material-symbols-outlined text-[14px]">location_on</span>
            {userRegion}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getRoleColorClass(userRole)}`}>
            {userRole}
          </span>
        </div>

        {/* Navigation Link for Resources */}
        <div className="relative hidden md:block" ref={resourcesRef}>
          <button
            onClick={() => setShowResourcesMenu(!showResourcesMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-250 hover:text-[#FF4800] dark:hover:text-[#FF4800] transition rounded-lg hover:bg-gray-100/50 dark:hover:bg-gray-850/50 cursor-pointer"
          >
            Resources
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${showResourcesMenu ? 'rotate-180' : ''}`} />
          </button>

          {showResourcesMenu && (
            <div className="absolute left-0 top-full mt-2 w-[760px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 z-50 animate-fade-in flex gap-6">
              {/* Left Column: Bold Reports */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF4800]" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#FF4800] dark:text-[#FF6A00]">
                    Bold Reports
                  </h4>
                </div>
                <div className="grid grid-cols-1 gap-1 max-h-[420px] overflow-y-auto pr-1">
                  {/* Free Tools */}
                  <a
                    href="https://www.boldreports.com/free-tools/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.67 2.67 0 1121 17.25l-5.83-5.83m-3.75 3.75a2.67 2.67 0 01-3.75-3.75m3.75 3.75l-4.95-4.95A4.9 4.9 0 006 10.5c0 .64.12 1.25.35 1.82L4.05 14.6a.75.75 0 01-1.02.1l-.9-.72a.75.75 0 01-.06-1.11L4 10.5m1.5 1.5l.72.9" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#FF4800] transition-colors text-left">Free Tools</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">Helpful reporting tools.</p>
                    </div>
                  </a>

                  {/* Documentation */}
                  <a
                    href="https://help.boldreports.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#FF4800] transition-colors text-left">Documentation</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">Setup and developer guides.</p>
                    </div>
                  </a>

                  {/* Videos */}
                  <a
                    href="https://www.boldreports.com/resources/videos/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#FF4800] transition-colors text-left">Videos</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">Tutorials and walkthroughs.</p>
                    </div>
                  </a>

                  {/* Knowledge Base */}
                  <a
                    href="https://support.boldreports.com/kb"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.044l4.5-2.25V9.75m-9 0v6.044l4.5 2.25M12 3v15.044m0-15.044L7.5 5.25M12 3l4.5 2.25M7.5 5.25v4.5M16.5 5.25v4.5m-9 0l4.5 2.25m4.5-2.25l-4.5 2.25m-4.5 2.25l4.5 2.25m4.5-2.25l-4.5 2.25M12 18.044l-4.5-2.25" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#FF4800] transition-colors text-left">Knowledge Base</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">Find quick answers to questions.</p>
                    </div>
                  </a>

                  {/* Report Examples */}
                  <a
                    href="https://www.boldreports.com/report-examples/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75c.621 0 1.125.504 1.125 1.125v17.25c0 .621-.504 1.125-1.125 1.125H5.625c-.621 0-1.125-.504-1.125-1.125V5.625c0-.621.504-1.125 1.125-1.125z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#FF4800] transition-colors text-left">Report Examples</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">Sample interactive reports.</p>
                    </div>
                  </a>

                  {/* Roadmap */}
                  <a
                    href="https://www.boldreports.com/roadmap/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-pink-50 dark:bg-pink-950/30 flex items-center justify-center text-pink-600 dark:text-pink-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8m-9-3.75h.008v.008H6V11.25zm.008 3h.008v.008H6V14.25zm3.75-3.75h.008v.008H9.75V11.25zm.008 3h.008v.008H9.75V14.25zm3.75-3h.008v.008h-.008V11.25zm.008 3h.008v.008h-.008v-.008zm3.75-3h.008v.008h-.008V11.25zm.008 3h.008v.008h-.008v-.008zM4 19.5H20a2 2 0 002-2v-11a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#FF4800] transition-colors text-left">Roadmap</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">Planned improvements.</p>
                    </div>
                  </a>

                  {/* Release History */}
                  <a
                    href="https://www.boldreports.com/resources/release-history/embedded-reporting/13-1/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#FF4800] transition-colors text-left">Release History</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">Embedded Reporting 13.1.</p>
                    </div>
                  </a>

                  {/* Contact Support */}
                  <a
                    href="https://www.boldreports.com/resources/contact-support/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center text-teal-600 dark:text-teal-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 3.75m0 0a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v11.25m0-11.25H9.75M3.75 20.25h16.5A2.25 2.25 0 0022 18V6.75a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6.75V18a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#FF4800] transition-colors text-left">Contact Support</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">Get help from support team.</p>
                    </div>
                  </a>

                  {/* Blogs */}
                  <a
                    href="https://www.boldreports.com/blog/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-sky-600 dark:text-sky-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#FF4800] transition-colors text-left">Blogs</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">Reporting best practices.</p>
                    </div>
                  </a>
                </div>
              </div>

              {/* Vertical Divider */}
              <div className="w-px bg-gray-150 dark:bg-gray-800 self-stretch" />

              {/* Right Column: Bold BI */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#006CDD]" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#006CDD] dark:text-[#3B82F6]">
                    Bold BI
                  </h4>
                </div>
                <div className="grid grid-cols-1 gap-1 max-h-[420px] overflow-y-auto pr-1">
                  {/* Solutions & Examples */}
                  <a
                    href="https://samples.boldbi.com/solutions/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#006CDD] transition-colors text-left">Solutions & Examples</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">BI dashboard examples.</p>
                    </div>
                  </a>

                  {/* Documentation */}
                  <a
                    href="https://help.boldbi.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#006CDD] transition-colors text-left">Documentation</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">BI guides and help.</p>
                    </div>
                  </a>

                  {/* Videos & Overview */}
                  <a
                    href="https://www.boldbi.com/resources/videos/overview/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#006CDD] transition-colors text-left">Videos & Overview</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">BI tutorials and overview.</p>
                    </div>
                  </a>

                  {/* Roadmap */}
                  <a
                    href="https://www.boldbi.com/roadmap/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-pink-50 dark:bg-pink-950/30 flex items-center justify-center text-pink-600 dark:text-pink-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499c-1.072.11-1.861.859-1.861 1.854v13.5c0 .995.789 1.743 1.861 1.853l7.008.701C19.728 21.532 21 20.485 21 19.2V4.8c0-1.285-1.272-2.332-2.511-2.102l-7.008.701zm-3.488.701c-1.239-.23-2.511.817-2.511 2.102v14.4c0 1.285 1.272 2.332 2.511 2.102l1-.1V4.1l-1 .1z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#006CDD] transition-colors text-left">Roadmap</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">Planned BI features.</p>
                    </div>
                  </a>

                  {/* Release History */}
                  <a
                    href="https://www.boldbi.com/resources/release-history/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#006CDD] transition-colors text-left">Release History</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">BI release history.</p>
                    </div>
                  </a>

                  {/* Pricing */}
                  <a
                    href="https://www.boldbi.com/pricing/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879-.659c1.546-1.16 3.7-1.16 5.244 0l.879.66M8.25 19.5a.05.05 0 01-.05-.05c0-.012.002-.023.007-.033l1.83-3.66a.05.05 0 01.089 0l1.83 3.66a.05.05 0 01-.044.073H8.25zm9.75-9.75c0 .012.002.023.007.033l1.83 3.66a.05.05 0 01-.089 0l-1.83-3.66a.05.05 0 01.044-.073h1.83a.05.05 0 01.05.05z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#006CDD] transition-colors text-left">Pricing</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">BI licensing details.</p>
                    </div>
                  </a>

                  {/* Blogs */}
                  <a
                    href="https://www.boldbi.com/blog/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                  >
                    <div className="w-8.5 h-8.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-sky-600 dark:text-sky-400 flex-shrink-0">
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-[#006CDD] transition-colors text-left">Blogs</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5 text-left">BI insights & updates.</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-xl px-4 hidden md:block" ref={searchRef}>
        <div className="relative">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setSearchValue(''); setResults([]); }
            }}
            placeholder="Search reports, dashboards, folders..."
            className="w-full pl-4 pr-10 py-2 rounded-full border text-sm"
            style={{ borderColor: 'var(--brand-200)', background: 'var(--surface)', color: 'var(--text-strong)' }}
            aria-label="Search reports, dashboards, folders"
          />
          {searchValue && (
            <button
              onClick={() => { setSearchValue(''); setResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition"
              title="Clear search"
              aria-label="Clear search"
              style={{ background: 'transparent' }}
            >
              <XMarkIcon className="h-4 w-4" style={{ color: '#7C84A1' }} />
            </button>
          )}

          {/* Search Results Dropdown */}
          {searchValue.trim().length >= 2 && (
            <div className="absolute mt-2 w-full rounded-xl shadow-xl z-40 overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--brand-200)' }}>
              {searchLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : results.length > 0 ? (
                <div className="max-h-80 overflow-auto">
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
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.type === 'report' ? 'bg-blue-500' : 'bg-orange-500'
                          }`} />
                        <span className="text-sm truncate" style={{ color: 'var(--text-strong)' }}>
                          {r.name}
                        </span>
                        {r.category && <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>— {r.category}</span>}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--brand-100)', color: 'var(--text-muted)' }}>
                        {r.type}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results for "{searchValue}"</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-light)' }}>Try a different keyword</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg transition hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: 'var(--text-strong)' }}
            aria-label="Notifications"
            title="Notifications"
          >
            <BellIcon className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/80">
                <p className="font-semibold text-sm text-gray-900 dark:text-white">Notifications</p>
                <span className="bg-orange-100 text-[#FF4800] dark:bg-orange-950/40 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  New
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                <a
                  href="https://www.boldreports.com/resources/release-history/embedded-reporting/13-1/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                  onClick={() => setShowNotifications(false)}
                >
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-950/50 flex items-center justify-center text-[#FF4800] flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21m0 0l-.813-5.096L3 15.187m6 .813l5.096-.813M21 9l-5.096-.813M15 3l-.813 5.096L9 9m6 0l-5.096.813m5.096 4.283L21 15m0 0l-5.096-.813M9 15.904L3 15" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white text-left">New Release Available!</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed text-left">
                        Bold Reports Embedded Reporting version 13.1 has been released. Explore the release history and new features.
                      </p>
                      <span className="text-[10px] text-[#FF4800] font-semibold mt-1.5 inline-flex items-center gap-0.5 hover:underline">
                        Get the details
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg transition hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ color: 'var(--text-strong)' }}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Light Mode' : 'Dark Mode'}
        >
          {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
        </button>

        {/* Profile Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            aria-label="Profile menu"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {getInitials()}
            </div>
            <div className="hidden lg:flex flex-col items-start max-w-[120px]">
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate w-full">
                {getUserName()}
              </span>
              <span className="text-xs text-gray-500 truncate w-full">{user?.email}</span>
            </div>
            <ChevronDownIcon className={`hidden lg:block h-3.5 w-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {getInitials()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {getUserName()}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                </div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowProfileModal(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left"
                >
                  <UserCircleIcon className="w-4 h-4 text-gray-400" />
                  Profile Settings
                </button>
                <button
                  onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <Cog6ToothIcon className="w-4 h-4 text-gray-400" />
                  App Settings
                </button>
                <a
                  href="https://help.boldreports.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                  Help & Support
                </a>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                <button
                  onClick={() => {
                    setShowLogoutConfirm(true);
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowLogoutConfirm(false)}
          ></div>

          {/* Modal Content */}
          <div className="relative z-10 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 max-w-sm w-full p-6 text-center transform transition-all scale-100">
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
        </div>,
        document.body
      )}

      {/* Profile Settings Modal */}
      {showProfileModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative z-10 bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all scale-100 p-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UserCircleIcon className="w-5 h-5 text-[#FF4800]" />
                Profile Settings
              </h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    First Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.firstName || (user?.name ? user.name.split(' ')[0] : '')}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 text-sm cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.lastName || (user?.name ? user.name.split(' ').slice(1).join(' ') : '')}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 text-sm cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.role || ''}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 text-sm cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tenant
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.tenantName || ''}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}