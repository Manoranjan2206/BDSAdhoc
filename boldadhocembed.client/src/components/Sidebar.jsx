import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  FolderIcon,
  Squares2X2Icon,
  UserIcon,
  ClockIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { key: '/', label: 'Home', icon: HomeIcon },
  { key: '/reports', label: 'Reports', icon: FolderIcon },
  { key: '/dashboards', label: 'Dashboards', icon: Squares2X2Icon },
  { key: '/schedules', label: 'Schedules', icon: ClockIcon },
  { key: '/settings', label: 'Settings', icon: Cog6ToothIcon },
];

export default function Sidebar({ onWidthChange }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true); // ← Collapsed by default

  // notify parent about width changes
  const width = collapsed ? 56 : 208; // px (reduced sizes)
  if (typeof onWidthChange === 'function') {
    // render-time safe notify (no effect dependency loop as value stable per render)
    onWidthChange(width);
  }

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col text-white shadow-2xl transition-all duration-300 z-40 ${
          collapsed ? 'w-14' : 'w-52'
        }`}
      style={{ background: 'var(--brand-700)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16" style={{ borderBottom: '1px solid rgba(255,255,255,.15)' }}>
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-xl" style={{ color: 'var(--brand-700)' }}>
          BR
        </div>
        {!collapsed && <span className="ml-3 font-bold text-lg">Bold Reports</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.key;
          return (
            <Link
              key={item.key}
              to={item.key}
              className={`flex items-center gap-4 px-4 py-3 mx-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/80 hover:bg-white/5'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.label : ''}
            >
              <item.icon className="w-6 h-6 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,.15)' }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-white/10 transition"
        >
          <ChevronRightIcon className={`w-5 h-5 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>
    </aside>
  );
}