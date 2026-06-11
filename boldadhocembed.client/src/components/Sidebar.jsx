import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
  HomeIcon,
  DocumentTextIcon,
  ChartBarIcon,
  UserIcon,
  ClockIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { key: '/', label: 'Home', icon: HomeIcon },
  { key: '/reports', label: 'Reports', icon: DocumentTextIcon },
  { key: '/dashboards', label: 'Dashboards', icon: ChartBarIcon },
  { key: '/schedules', label: 'Schedules', icon: ClockIcon },
  { key: '/settings', label: 'Settings', icon: Cog6ToothIcon },
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
  const width = collapsed ? 72 : 240; // px (slightly wider for a premium feel)
  if (typeof onWidthChange === 'function') {
    onWidthChange(width);
  }

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
      className={`fixed left-0 top-0 h-screen flex flex-col text-white shadow-2xl transition-all duration-400 ease-in-out z-40 ${
          collapsed ? 'w-[72px]' : 'w-[240px]'
        } bg-gradient-to-b from-primary-600 via-[#1a233a] to-gray-900 border-r border-white/5 backdrop-blur-xl`}
    >
      {/* Logo Area */}
      <div className="flex items-center justify-center h-20 border-b border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-orange/0 via-brand-orange/10 to-brand-orange/0 opacity-50"></div>
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-[#ff7b00] flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-brand-orange/20 transition-transform duration-300 ${collapsed ? 'scale-90' : 'scale-100'}`}>
          BR
        </div>
        {!collapsed && (
          <span className="ml-3 font-bold text-lg tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
            Bold Reports
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav 
        className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-2 relative sidebar-nav" 
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`.sidebar-nav::-webkit-scrollbar { display: none; }`}</style>
        {navItems.map((item) => {
          const isActive = location.pathname === item.key;
          return (
            <div key={item.key} className="group relative">
              <Link
                to={item.key}
                onClick={() => handleNavClick(item.key)}
                className={`relative flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-300 ease-out overflow-hidden ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                {/* Active Background Glow */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-orange/20 to-transparent opacity-100"></div>
                )}
                {/* Active Left Indicator Bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-orange rounded-r-full shadow-[0_0_8px_rgba(255,72,0,0.8)]"></div>
                )}

                <item.icon className={`w-6 h-6 flex-shrink-0 transition-transform duration-300 ${isActive ? 'text-brand-orange scale-110' : 'group-hover:scale-110 group-hover:text-gray-200'}`} />
                
                {!collapsed && (
                  <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isActive ? 'font-semibold tracking-wide' : ''}`}>
                    {item.label}
                  </span>
                )}
              </Link>
              
              {/* Custom Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-md opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 shadow-xl border border-white/10 z-50 whitespace-nowrap">
                  {item.label}
                  {/* Tooltip Arrow */}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-gray-800 rotate-45 border-l border-b border-white/10"></div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-300 focus:outline-none"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 shadow-inner">
            <ChevronRightIcon className={`w-4 h-4 transition-transform duration-500 ${collapsed ? '' : 'rotate-180'}`} />
          </div>
        </button>
      </div>
    </aside>
  );
}