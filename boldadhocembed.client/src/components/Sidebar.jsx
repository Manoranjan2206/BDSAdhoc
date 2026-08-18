import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { authService } from '../services/authService';

const ALL_NAV_ITEMS = [
  { key: '/', label: 'Home', icon: 'home', exact: true, roles: ['Admin', 'Sales', 'Finance', 'Support', 'Operations'] },
  { key: '/dashboards', label: 'Dashboard', icon: 'dashboard', matchPrefix: '/dashboards', roles: ['Admin', 'Sales', 'Finance', 'Support', 'Operations'] },
  { key: '/reports', label: 'Reports', icon: 'assessment', matchPrefix: '/reports', roles: ['Admin', 'Sales', 'Finance', 'Support', 'Operations'] },
  { key: '/schedules', label: 'Scheduler', icon: 'calendar_month', matchPrefix: '/schedules', roles: ['Admin', 'Sales', 'Finance', 'Support', 'Operations'] },
  { key: '/contacts', label: 'Contacts', icon: 'contacts', matchPrefix: '/contacts', roles: ['Admin', 'Sales', 'Support'] },
  { key: '/deals', label: 'Deals', icon: 'handshake', matchPrefix: '/deals', roles: ['Admin', 'Sales'] },
  { key: '/activities', label: 'Activities', icon: 'event_note', matchPrefix: '/activities', roles: ['Admin', 'Sales', 'Support', 'Operations'] },
  { key: '/tickets', label: 'Tickets', icon: 'confirmation_number', matchPrefix: '/tickets', roles: ['Admin', 'Support'] },
  { key: '/invoices', label: 'Invoices', icon: 'receipt', matchPrefix: '/invoices', roles: ['Admin', 'Finance'] },
  { key: '/campaigns', label: 'Campaigns', icon: 'campaign', matchPrefix: '/campaigns', roles: ['Admin', 'Operations', 'Sales'] },
  { key: '/tasks', label: 'Tasks', icon: 'assignment', matchPrefix: '/tasks', roles: ['Admin', 'Sales', 'Support', 'Operations'] },
  { key: '/audit-log', label: 'Audit Log', icon: 'history', matchPrefix: '/audit-log', roles: ['Admin'] },
];

export default function Sidebar({ onWidthChange }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const currentUser = authService.getUser() || { role: 'Admin', name: 'User' };
  const userRole = currentUser.role || 'Admin';

  const {
    reportsSidebarCollapsed,
    setReportsSidebarCollapsed,
    dashboardsSidebarCollapsed,
    setDashboardsSidebarCollapsed,
  } = useData();

  // Filter items based on user role (case-insensitive)
  const navItems = ALL_NAV_ITEMS.filter(item =>
    !item.roles || item.roles.some(r => r.toLowerCase() === userRole.toLowerCase())
  );

  const width = collapsed ? 72 : 260;
  if (typeof onWidthChange === 'function') {
    onWidthChange(width);
  }

  const isItemActive = (item) => {
    if (item.exact) return location.pathname === item.key;
    if (item.matchPrefix) return location.pathname === item.key || location.pathname.startsWith(item.matchPrefix + '/');
    return location.pathname === item.key;
  };

  const handleNavClick = (path) => {
    if (path === '/reports') {
      if (location.pathname === '/reports') {
        setReportsSidebarCollapsed(!reportsSidebarCollapsed);
      } else {
        setReportsSidebarCollapsed(false);
      }
    } else if (path === '/dashboards') {
      if (location.pathname === '/dashboards') {
        setDashboardsSidebarCollapsed(!dashboardsSidebarCollapsed);
      } else {
        setDashboardsSidebarCollapsed(false);
      }
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col font-body-md transition-all duration-200 ease-in-out z-50 ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      } glass-sidebar shadow-sm bg-[#f8f9ff]/90 dark:bg-[#0f172a]/95`}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-glass-border flex items-center justify-between flex-shrink-0">
        <Link to="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-lg bg-primary-container text-white flex items-center justify-center font-bold text-xl shadow-md flex-shrink-0">
            B
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-headline-md text-base font-bold text-primary dark:text-purple-400 leading-tight whitespace-nowrap">
                BDS CRM Suite
              </h1>
              <p className="text-[10px] text-on-surface-variant font-medium tracking-wider uppercase whitespace-nowrap">
                Enterprise Edition
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Quick Action Button */}
      {!collapsed ? (
        <div className="p-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-quick-create'))}
            className="w-full bg-primary hover:bg-[#4029ba] text-white rounded-lg py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create Record
          </button>
        </div>
      ) : (
        <div className="p-2 flex justify-center">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-quick-create'))}
            title="Create Record"
            className="w-10 h-10 bg-primary hover:bg-[#4029ba] text-white rounded-lg flex items-center justify-center shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1 custom-scrollbar">
        {navItems.map((item) => {
          const isActive = isItemActive(item);
          return (
            <div key={item.key} className="group relative">
              <Link
                to={item.key}
                onClick={() => handleNavClick(item.key)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 relative ${
                  isActive
                    ? 'bg-primary-container/15 text-primary font-semibold border-l-4 border-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>

                {!collapsed && (
                  <span className="text-sm truncate">
                    {item.label}
                  </span>
                )}
              </Link>

              {/* Hover Tooltip when collapsed */}
              {collapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-xl z-50 whitespace-nowrap">
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Section: Settings & Collapse Toggle */}
      <div className="p-3 border-t border-glass-border space-y-1 flex-shrink-0">
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title="Settings"
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          {!collapsed && <span className="text-sm">Settings</span>}
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors ${
            collapsed ? 'justify-center' : 'justify-between px-3'
          }`}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {!collapsed && <span className="text-xs text-on-surface-variant">Collapse</span>}
          <span className="material-symbols-outlined text-[18px]">
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>
    </aside>
  );
}