import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useState, useEffect } from 'react';
import './styles/App.css';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import SSOCallback from './pages/SSOCallback';
import { authService } from './services/authService';
import { DataProvider } from './context/DataContext';
import { applyTheme } from './themeConfig';

// Route-level code splitting. Designer + Dashboard pages import multi-MB
// Bold editors; lazy loading them cuts the initial bundle by ~50% for
// users that only need reports/dashboards viewing.
const Home = lazy(() => import('./pages/Home'));
const Reports = lazy(() => import('./pages/Reports'));
const Designer = lazy(() => import('./pages/Designer'));
const Dashboards = lazy(() => import('./pages/Dashboards'));
const DashboardDesigner = lazy(() => import('./pages/DashboardDesigner'));
const Schedules = lazy(() => import('./pages/Schedules'));
const Settings = lazy(() => import('./pages/Settings'));
const Deals = lazy(() => import('./pages/Deals'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Tickets = lazy(() => import('./pages/Tickets'));
const Operations = lazy(() => import('./pages/Operations'));
const Users = lazy(() => import('./pages/Users'));

const PageFallback = (
  <div className="flex items-center justify-center h-full bg-canvas">
    <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
  </div>
);

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('settings_theme');
    if (savedTheme === 'Dark Theme') return true;
    if (savedTheme === 'Light Theme') return false;
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) return savedDarkMode === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [syncfusionBaseTheme] = useState('tailwind3');
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    const handleThemeChange = () => {
      const savedTheme = localStorage.getItem('settings_theme');
      if (savedTheme === 'Dark Theme') setDarkMode(true);
      else if (savedTheme === 'Light Theme') setDarkMode(false);
      else setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };

    window.addEventListener('storage', handleThemeChange);
    window.addEventListener('theme-changed', handleThemeChange);
    return () => {
      window.removeEventListener('storage', handleThemeChange);
      window.removeEventListener('theme-changed', handleThemeChange);
    };
  }, []);

  const handleToggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('settings_theme', next ? 'Dark Theme' : 'Light Theme');
      localStorage.setItem('darkMode', String(next));
      window.dispatchEvent(new Event('theme-changed'));
      return next;
    });
  };

  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = authService.isAuthenticated();
      if (isAuthenticated) {
        const isValid = await authService.validateToken();
        if (!isValid) await authService.logout();
      }
      setIsAuthChecked(true);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    applyTheme(`${syncfusionBaseTheme}-${darkMode ? 'dark' : 'light'}`);
  }, [syncfusionBaseTheme, darkMode]);

  if (!isAuthChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-canvas">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center font-bold text-2xl text-white shadow-xl mx-auto mb-6">
          A
        </div>
        <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm font-medium text-on-surface-variant">Loading CRM Suite...</p>
      </div>
    );
  }

  return (
    <DataProvider>
      <div className={darkMode ? 'dark' : ''}>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/sso-callback" element={<SSOCallback />} />
            <Route path="/Home/SSOCallback" element={<SSOCallback />} />

            {/* Protected. We collapse all the previous 11 duplicated
                <ProtectedRoute><Layout>{Page}</Layout></ProtectedRoute>
                blocks into a single route + a single Layout. */}
            <Route element={<ProtectedRoute />}>
              <Route
                element={
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Suspense fallback={PageFallback} />
                  </Layout>
                }
              >
                <Route path="/" element={<Suspense fallback={PageFallback}><Home /></Suspense>} />
                <Route path="/dashboards" element={<Suspense fallback={PageFallback}><Dashboards /></Suspense>} />
                <Route path="/dashboards/designer" element={<Suspense fallback={PageFallback}><DashboardDesigner /></Suspense>} />
                <Route path="/reports" element={<Suspense fallback={PageFallback}><Reports /></Suspense>} />
                <Route path="/designer" element={<Suspense fallback={PageFallback}><Designer /></Suspense>} />
                <Route path="/reports/designer" element={<Suspense fallback={PageFallback}><Designer /></Suspense>} />
                <Route path="/schedules" element={<Suspense fallback={PageFallback}><Schedules /></Suspense>} />
                <Route path="/deals" element={<Suspense fallback={PageFallback}><Deals /></Suspense>} />
                <Route path="/contacts" element={<Suspense fallback={PageFallback}><Contacts /></Suspense>} />
                <Route path="/tickets" element={<Suspense fallback={PageFallback}><Tickets /></Suspense>} />
                <Route path="/operations" element={<Suspense fallback={PageFallback}><Operations /></Suspense>} />
                <Route path="/users" element={<Suspense fallback={PageFallback}><Users /></Suspense>} />
                <Route path="/settings" element={<Suspense fallback={PageFallback}><Settings /></Suspense>} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </DataProvider>
  );
}
