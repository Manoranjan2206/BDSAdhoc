import { Navigate } from 'react-router-dom';
import { authService } from '../services/authService';

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 * Set VITE_BYPASS_AUTH=true in .env to bypass authentication during development
 */
export default function ProtectedRoute({ children }) {
  const isAuthenticated = authService.isAuthenticated();

  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';

  if (!isAuthenticated && !bypassAuth) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
