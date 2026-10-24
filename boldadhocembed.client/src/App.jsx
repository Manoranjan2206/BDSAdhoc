import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useState, useEffect } from 'react';
import './styles/App.css';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import SSOCallback from './pages/SSOCallback';
import AzureLoginCallback from './pages/AzureLoginCallback';
import { authService } from './services/authService';
import { DataProvider } from './context/DataContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

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

function AppRoutes({ isAuthChecked }) {
  const { theme, isDark, toggleDarkMode } = useTheme();

  if (!isAuthChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-canvas">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center font-bold text-2xl text-white shadow-xl mx-auto mb-6">
            A
          </div>
          <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm font-medium text-on-surface-variant">Loading CRM Suite...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isDark ? 'dark' : ''} transition-colors duration-200`}
      data-theme={theme}
      style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
    >
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/sso-callback" element={<SSOCallback />} />
          <Route path="/login-success" element={<AzureLoginCallback />} />

          {/* Protected. Collapsed into a single route + a single Layout. */}
          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <Layout darkMode={isDark} onToggleDarkMode={toggleDarkMode}>
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
  );
}

export default function App() {
  const [isAuthChecked, setIsAuthChecked] = useState(false);

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

  return (
    <ThemeProvider>
      <DataProvider>
        <AppRoutes isAuthChecked={isAuthChecked} />
      </DataProvider>
    </ThemeProvider>
  );
}
