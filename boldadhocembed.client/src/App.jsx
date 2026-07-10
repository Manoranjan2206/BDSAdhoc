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
import { authService } from './services/authService';
import { DataProvider } from './context/DataContext';
import { applyTheme } from './themeConfig';


export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('settings_theme');
    if (savedTheme === 'Dark Theme') return true;
    if (savedTheme === 'Light Theme') return false;
    // Fallback to system preferences or standard localStorage darkMode
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) return savedDarkMode === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [syncfusionBaseTheme, setSyncfusionBaseTheme] = useState('tailwind3'); // tailwind3 | bootstrap5.3 | material3 | fluent2
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  // Synchronize theme across tabs and components
  useEffect(() => {
    const handleThemeChange = () => {
      const savedTheme = localStorage.getItem('settings_theme');
      if (savedTheme === 'Dark Theme') {
        setDarkMode(true);
      } else if (savedTheme === 'Light Theme') {
        setDarkMode(false);
      } else {
        // System Default
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

  // Check authentication status on app load
  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = authService.isAuthenticated();
      if (isAuthenticated) {
        // Validate token is still valid
        const isValid = await authService.validateToken();
        if (!isValid) {
          // Token expired, clear auth
          await authService.logout();
        }
      }
      setIsAuthChecked(true);
    };

    checkAuth();
  }, []);

  // Keep Syncfusion theme in sync with app theme
  useEffect(() => {
    const themeKey = `${syncfusionBaseTheme}-${darkMode ? 'dark' : 'light'}`;
    applyTheme(themeKey);
  }, [syncfusionBaseTheme, darkMode]);

  if (!isAuthChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'linear-gradient(135deg, #F3F3F7, #DDE0EB)' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF4800] to-[#ff7b00] flex items-center justify-center font-bold text-2xl text-white shadow-xl mx-auto mb-6">
            AA
          </div>
          <div className="w-10 h-10 border-4 border-gray-200 border-t-[#FF4800] rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-gray-500">Loading Acme Analytics...</p>
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

            {/* Protected Routes */}
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
            path="/simple-designer"
            element={
              <ProtectedRoute>
                <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                  <Designer />
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
          {/* Users page removed from routes */}
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
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout darkMode={darkMode} onToggleDarkMode={handleToggleDarkMode}>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all: Redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </div>
    </DataProvider>
  );
}
