import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './styles/App.css';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Home from './pages/Home';
import Reports from './pages/Reports';
import Dashboards from './pages/Dashboards';
import Schedules from './pages/Schedules';
import Settings from './pages/Settings';
import Designer from './pages/Designer';
import DashboardDesigner from './pages/DashboardDesigner';
import Deals from './pages/Deals';
import Contacts from './pages/Contacts';
import Tickets from './pages/Tickets';
import Operations from './pages/Operations';
import { authService } from './services/authService';
import { DataProvider } from './context/DataContext';
import { applyTheme } from './themeConfig';

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
      if (savedTheme === 'Dark Theme') {
        setDarkMode(true);
      } else if (savedTheme === 'Light Theme') {
        setDarkMode(false);
      } else {
        setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    };

    window.addEventListener('storage', handleThemeChange);
    window.addEventListener('theme-changed', handleThemeChange);
    return () => {
      window.removeEventListener('storage', handleThemeChange);
      window.removeEventListener('theme-changed', handleThemeChange);
    };
  }, []);

  const handleToggleDarkMode = () => {
    setDarkMode(prev => {
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
        if (!isValid) {
          await authService.logout();
        }
      }
      setIsAuthChecked(true);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const themeKey = `${syncfusionBaseTheme}-${darkMode ? 'dark' : 'light'}`;
    applyTheme(themeKey);
  }, [syncfusionBaseTheme, darkMode]);

  if (!isAuthChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-canvas">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center font-bold text-2xl text-white shadow-xl mx-auto mb-6">
            B
          </div>
          <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-on-surface-variant">Loading BDS CRM Suite...</p>
        </div>
      </div>
    );
  }

  return (
    <DataProvider>
      <div className={darkMode ? 'dark' : ''}>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected Core CRM Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboards"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Dashboards />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboards/designer"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <DashboardDesigner />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/designer"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Designer />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/schedules"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Schedules />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/deals"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Deals />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Contacts />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Tickets />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/activities"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleDarkMode => handleToggleDarkMode()}>
                    <Operations />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Operations />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Operations />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Operations />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-log"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Operations />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/operations"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Operations />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/scheduler"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Schedules />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/designer"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Designer />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </DataProvider>
  );
}
