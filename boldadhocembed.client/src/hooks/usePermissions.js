import { useMemo } from 'react';
import { authService } from '../services/authService';

/**
 * Role-Based Access Control (RBAC) Permission Matrix
 * Maps application roles to fine-grained feature permissions.
 */
export const ROLE_PERMISSIONS = {
  admin: {
    canViewReports: true,
    canCopyReports: true,
    canEditReports: true,
    canExportReports: true,
    canScheduleReports: true,
    canViewDashboards: true,
    canEditDashboards: true,
    canManageUsers: true,
    canViewAuditLogs: true,
  },
  manager: {
    canViewReports: true,
    canCopyReports: true,
    canEditReports: true,
    canExportReports: true,
    canScheduleReports: true,
    canViewDashboards: true,
    canEditDashboards: true,
    canManageUsers: false,
    canViewAuditLogs: true,
  },
  operations: {
    canViewReports: true,
    canCopyReports: true,
    canEditReports: true,
    canExportReports: true,
    canScheduleReports: true,
    canViewDashboards: true,
    canEditDashboards: false,
    canManageUsers: false,
    canViewAuditLogs: true,
  },
  sales: {
    canViewReports: true,
    canCopyReports: false,
    canEditReports: false,
    canExportReports: true,
    canScheduleReports: false,
    canViewDashboards: true,
    canEditDashboards: false,
    canManageUsers: false,
    canViewAuditLogs: false,
  },
  finance: {
    canViewReports: true,
    canCopyReports: false,
    canEditReports: false,
    canExportReports: true,
    canScheduleReports: false,
    canViewDashboards: true,
    canEditDashboards: false,
    canManageUsers: false,
    canViewAuditLogs: false,
  },
  support: {
    canViewReports: true,
    canCopyReports: false,
    canEditReports: false,
    canExportReports: true,
    canScheduleReports: false,
    canViewDashboards: true,
    canEditDashboards: false,
    canManageUsers: false,
    canViewAuditLogs: false,
  },
  user: {
    canViewReports: true,
    canCopyReports: false,
    canEditReports: false,
    canExportReports: true,
    canScheduleReports: false,
    canViewDashboards: true,
    canEditDashboards: false,
    canManageUsers: false,
    canViewAuditLogs: false,
  },
  readonly: {
    canViewReports: true,
    canCopyReports: false,
    canEditReports: false,
    canExportReports: false,
    canScheduleReports: false,
    canViewDashboards: true,
    canEditDashboards: false,
    canManageUsers: false,
    canViewAuditLogs: false,
  },
  viewer: {
    canViewReports: true,
    canCopyReports: false,
    canEditReports: false,
    canExportReports: false,
    canScheduleReports: false,
    canViewDashboards: true,
    canEditDashboards: false,
    canManageUsers: false,
    canViewAuditLogs: false,
  },
};

/**
 * Custom React Hook for Role-Based Access Control
 */
export function usePermissions() {
  const currentUser = useMemo(() => {
    try {
      return authService.getUser()?.user || authService.getUser() || null;
    } catch {
      return null;
    }
  }, []);

  const role = useMemo(() => {
    return (currentUser?.role || 'viewer').toLowerCase().trim();
  }, [currentUser]);

  const permissions = useMemo(() => {
    // If backend provided explicit permissions in user object, merge with role matrix
    const basePermissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
    if (currentUser?.permissions) {
      return {
        ...basePermissions,
        canViewReports: currentUser.permissions.canView ?? basePermissions.canViewReports,
        canEditReports: currentUser.permissions.canEdit ?? basePermissions.canEditReports,
        canExportReports: currentUser.permissions.canExport ?? basePermissions.canExportReports,
        canScheduleReports: currentUser.permissions.canSchedule ?? basePermissions.canScheduleReports,
        canManageUsers: currentUser.permissions.canManageUsers ?? basePermissions.canManageUsers,
        canViewAuditLogs: currentUser.permissions.canViewAuditLogs ?? basePermissions.canViewAuditLogs,
      };
    }
    return basePermissions;
  }, [role, currentUser]);

  const hasRole = (roleToCheck) => {
    if (Array.isArray(roleToCheck)) {
      return roleToCheck.map(r => r.toLowerCase().trim()).includes(role);
    }
    return role === roleToCheck.toLowerCase().trim();
  };

  return {
    currentUser,
    role,
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isOperations: role === 'operations',
    permissions,
    canCopyReports: permissions.canCopyReports,
    canEditReports: permissions.canEditReports,
    canExportReports: permissions.canExportReports,
    canScheduleReports: permissions.canScheduleReports,
    canManageUsers: permissions.canManageUsers,
    canViewAuditLogs: permissions.canViewAuditLogs,
    hasRole,
  };
}

export default usePermissions;
