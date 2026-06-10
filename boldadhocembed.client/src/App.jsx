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
import { authService } from './services/authService';
import { DataProvider } from './context/DataContext';
import { applyTheme } from './themeConfig';


export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [syncfusionBaseTheme, setSyncfusionBaseTheme] = useState('tailwind3'); // tailwind3 | bootstrap5.3 | material3 | fluent2
  const [isAuthChecked, setIsAuthChecked] = useState(false);

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
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="inline-block">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
                  <Layout darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)}>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              }
            />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Layout darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)}>
                  <Reports />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/designer"
            element={
              <ProtectedRoute>
                <Layout darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)}>
                  <Designer />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/designer"
            element={
              <ProtectedRoute>
                <Layout darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)}>
                  <Designer />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/simple-designer"
            element={
              <ProtectedRoute>
                <Layout darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)}>
                  <Designer />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboards"
            element={
              <ProtectedRoute>
                <Layout darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)}>
                  <Dashboards />
                </Layout>
              </ProtectedRoute>
            }
          />
          {/* Users page removed from routes */}
          <Route
            path="/schedules"
            element={
              <ProtectedRoute>
                <Layout darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)}>
                  <Schedules />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)}>
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
