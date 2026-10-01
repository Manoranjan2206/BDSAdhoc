import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { inferTenantFromEmail } from '../constants/tenants';

/**
 * Hook providing the authenticated user's profile and active context.
 * Automatically updates when 'auth-changed' event is dispatched.
 */
export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState(() => authService.getUser() || null);

  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentUser(authService.getUser() || null);
    };

    window.addEventListener('auth-changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('auth-changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  const userRole = currentUser?.role || 'Admin';
  const userRegion = currentUser?.region || 'North America';
  const tenantName = currentUser?.tenantName || inferTenantFromEmail(currentUser?.email);
  const isAuthenticated = !!currentUser && authService.isAuthenticated();

  return {
    currentUser,
    userRole,
    userRegion,
    tenantName,
    isAuthenticated,
  };
}
