import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children, darkMode, onToggleDarkMode }) {
  let sidebarWidth = 64;
  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <Sidebar onWidthChange={(w) => { sidebarWidth = w; document.documentElement.style.setProperty('--sidebar-width', `${w}px`); }} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 bg-inherit" style={{ marginLeft: 'var(--sidebar-width, 64px)' }}>
        <Header darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />
        <main className="flex-1 min-h-0 bg-inherit overflow-y-auto relative flex flex-col custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
