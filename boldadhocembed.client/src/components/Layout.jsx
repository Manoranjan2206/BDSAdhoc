import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children, darkMode, onToggleDarkMode }) {
  let sidebarWidth = 64;
  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      <Sidebar onWidthChange={(w) => { sidebarWidth = w; document.documentElement.style.setProperty('--sidebar-width', `${w}px`); }} />
      <div className="flex-1 transition-all duration-300 bg-inherit" style={{ marginLeft: 'var(--sidebar-width, 64px)' }}>
        <Header darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />
        <main className="p-4 md:p-6 bg-inherit min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
