import { Navigate, Outlet } from 'react-router-dom';
import { authService } from '../services/authService';

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated.
 *
 * Works in either of two modes:
 *  - As a route wrapper  : <Route element={<ProtectedRoute />}>  -> uses <Outlet />
 *  - As a manual shell   : <ProtectedRoute><Page/></ProtectedRoute> -> uses children
 *
 * Set VITE_BYPASS_AUTH=true in .env to bypass authentication during development.
 */
export default function ProtectedRoute({ children }) {
  const isAuthenticated = authService.isAuthenticated();

  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';

  if (!isAuthenticated && !bypassAuth) {
    return <Navigate to="/login" replace />;
  }

  // When used as a <Route element={...}/> wrapper in react-router-dom v6/v7,
  // the inner routes are rendered through <Outlet />, not via the `children`
  // prop (which is undefined for element-only routes). Fall back to children
  // when called directly so the existing JSX usage still works.
  return children ?? <Outlet />;
}
