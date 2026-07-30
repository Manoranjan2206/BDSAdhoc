import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
  HomeIcon,
  DocumentTextIcon,
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { key: '/', label: 'Home', icon: HomeIcon, exact: true },
  { key: '/reports', label: 'Reports', icon: DocumentTextIcon, matchPrefix: '/reports' },
  { key: '/dashboards', label: 'Dashboards', icon: ChartBarIcon, matchPrefix: '/dashboards' },
  { key: '/schedules', label: 'Schedules', icon: ClockIcon, matchPrefix: '/schedules' },
  { key: '/settings', label: 'Settings', icon: Cog6ToothIcon, matchPrefix: '/settings' },
];

export default function Sidebar({ onWidthChange }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
  const {
    reportsSidebarCollapsed,
    setReportsSidebarCollapsed,
    dashboardsSidebarCollapsed,
    setDashboardsSidebarCollapsed,
  } = useData();

  // notify parent about width changes
  const width = collapsed ? 64 : 200;
  if (typeof onWidthChange === 'function') {
    onWidthChange(width);
  }

  // Determine if a nav item is active, supporting prefix matching for nested routes
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
      className={`fixed left-0 top-0 h-screen flex flex-col text-white shadow-2xl transition-all duration-300 ease-in-out z-40 ${
          collapsed ? 'w-[64px]' : 'w-[200px]'
        } bg-gradient-to-b from-[#131F3B] via-[#1a233a] to-[#0d1220] border-r border-white/5`}
    >
      {/* Logo Area */}
      <div className="flex items-center justify-center h-16 border-b border-white/10 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-orange/0 via-brand-orange/10 to-brand-orange/0 opacity-50"></div>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF4800] to-[#ff7b00] flex items-center justify-center font-bold text-sm text-white shadow-lg transition-transform duration-300 flex-shrink-0 ${collapsed ? 'scale-90' : 'scale-100'}`}>
          AA
        </div>
        {!collapsed && (
          <span className="ml-3 font-bold text-base tracking-wide text-white whitespace-nowrap overflow-hidden">
            Acme Analytics
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav 
        className="flex-1 overflow-y-auto py-4 px-2.5 flex flex-col gap-1 relative sidebar-nav" 
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`.sidebar-nav::-webkit-scrollbar { display: none; }`}</style>
        {navItems.map((item) => {
          const isActive = isItemActive(item);
          return (
            <div key={item.key} className="group relative">
              <Link
                to={item.key}
                onClick={() => handleNavClick(item.key)}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ease-out overflow-hidden ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/8'
                } ${collapsed ? 'justify-center' : ''}`}
                style={isActive ? { background: 'rgba(255,72,0,0.15)' } : {}}
              >
                {/* Active Left Indicator Bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-[#FF4800] rounded-r-full"
                       style={{ boxShadow: '0 0 8px rgba(255,72,0,0.7)' }}></div>
                )}

                <item.icon className={`w-5 h-5 flex-shrink-0 transition-all duration-200 ${
                  isActive ? 'text-[#FF4800]' : 'group-hover:text-gray-100'
                }`} />
                
                {!collapsed && (
                  <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${
                    isActive ? 'font-semibold text-white' : 'font-medium text-gray-300'
                  }`}>
                    {item.label}
                  </span>
                )}
              </Link>
              
              {/* Custom Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 shadow-xl border border-white/10 z-50 whitespace-nowrap">
                  {item.label}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45 border-l border-b border-white/10"></div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200 focus:outline-none ${
            collapsed ? 'justify-center' : 'justify-end gap-2'
          }`}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {!collapsed && <span className="text-xs font-medium text-gray-500">Collapse</span>}
          <div className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5">
            <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`} />
          </div>
        </button>
      </div>
    </aside>
  );
}