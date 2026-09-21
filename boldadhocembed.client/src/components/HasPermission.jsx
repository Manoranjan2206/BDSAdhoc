import PropTypes from 'prop-types';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Declarative component for conditional rendering based on RBAC permissions.
 *
 * Usage:
 * <HasPermission permission="canCopyReports">
 *   <button>Copy Report</button>
 * </HasPermission>
 */
export default function HasPermission({ permission, role, children, fallback = null }) {
  const { permissions, hasRole } = usePermissions();

  if (role && !hasRole(role)) {
    return fallback;
  }

  if (permission && !permissions[permission]) {
    return fallback;
  }

  return children;
}

HasPermission.propTypes = {
  permission: PropTypes.string,
  role: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  children: PropTypes.node,
  fallback: PropTypes.node,
};
