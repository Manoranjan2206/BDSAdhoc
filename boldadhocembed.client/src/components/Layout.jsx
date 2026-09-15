import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ darkMode, onToggleDarkMode }) {
  // Hold the sidebar width in React state so the value is consistent across
  // renders and React's immutability hook is satisfied. Previously this was
  // a render-scope local variable that got reassigned inside a callback,
  // which tripped the react-hooks/immutability lint rule.
  const [sidebarWidth, setSidebarWidth] = useState(56);

  const onWidthChange = (w) => {
    setSidebarWidth(w);
    document.documentElement.style.setProperty('--sidebar-width', `${w}px`);
  };

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <Sidebar onWidthChange={onWidthChange} />
      <div
        className="flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 bg-inherit"
        style={{ marginLeft: 'var(--sidebar-width, 56px)' }}
      >
        <Header darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />
        <main className="flex-1 min-h-0 bg-inherit overflow-y-auto relative flex flex-col custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
