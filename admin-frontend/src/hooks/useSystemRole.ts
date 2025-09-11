// Custom hook for system role and permission checking

import { useMemo } from 'react'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { SystemRole, SystemPermission } from '@/types/admin'
import {
  hasSystemAccess,
  hasSystemRole,
  hasAnySystemRole,
  hasSystemPermission,
  hasMinimumSystemRole,
  getHighestSystemRole,
  getUserSystemPermissions,
  canAccessRoute,
} from '@/utils/systemRoles'

export function useSystemRole() {
  const { user, isAuthenticated, isLoading } = useAdminAuth()

  // Memoized role checks
  const roleChecks = useMemo(() => {
    if (!isAuthenticated || !user) {
      return {
        hasAccess: false,
        isSystemSuperAdmin: false,
        isSystemAdmin: false,
        isSystemSupport: false,
        isSystemModerator: false,
        highestRole: null,
        allPermissions: [],
        systemRoles: [],
      }
    }

    return {
      hasAccess: hasSystemAccess(user),
      isSystemSuperAdmin: hasSystemRole(user, 'system_super_admin'),
      isSystemAdmin: hasSystemRole(user, 'system_admin'),
      isSystemSupport: hasSystemRole(user, 'system_support'),
      isSystemModerator: hasSystemRole(user, 'system_moderator'),
      highestRole: getHighestSystemRole(user),
      allPermissions: getUserSystemPermissions(user),
      systemRoles: user.system_roles || [],
    }
  }, [user, isAuthenticated])

  // Helper functions
  const checkRole = (role: SystemRole): boolean => {
    return hasSystemRole(user, role)
  }

  const checkAnyRole = (roles: SystemRole[]): boolean => {
    return hasAnySystemRole(user, roles)
  }

  const checkPermission = (permission: SystemPermission): boolean => {
    return hasSystemPermission(user, permission)
  }

  const checkAnyPermission = (permissions: SystemPermission[]): boolean => {
    return permissions.some(permission => hasSystemPermission(user, permission))
  }

  const checkAllPermissions = (permissions: SystemPermission[]): boolean => {
    return permissions.every(permission => hasSystemPermission(user, permission))
  }

  const checkMinimumRole = (minimumRole: SystemRole): boolean => {
    return hasMinimumSystemRole(user, minimumRole)
  }

  const checkRouteAccess = (route: string): boolean => {
    return canAccessRoute(user, route)
  }

  // UI helper functions
  const canViewSystemStats = (): boolean => {
    return checkPermission('system:stats:read')
  }

  const canViewSystemHealth = (): boolean => {
    return checkPermission('system:health:read')
  }

  const canToggleMaintenance = (): boolean => {
    return checkPermission('system:maintenance:toggle')
  }

  const canViewSettings = (): boolean => {
    return checkPermission('system:settings:read')
  }

  const canEditSettings = (): boolean => {
    return checkPermission('system:settings:write')
  }

  const canListOrganizations = (): boolean => {
    return checkPermission('organizations:list')
  }

  const canViewOrganizations = (): boolean => {
    return checkPermission('organizations:read')
  }

  const canSuspendOrganizations = (): boolean => {
    return checkPermission('organizations:suspend')
  }

  const canListUsers = (): boolean => {
    return checkPermission('users:list')
  }

  const canViewUsers = (): boolean => {
    return checkPermission('users:read')
  }

  const canUpdateUserAdminStatus = (): boolean => {
    return checkPermission('users:admin_status:update')
  }

  const canViewUserActivity = (): boolean => {
    return checkPermission('users:activity:read')
  }

  const canListTemplates = (): boolean => {
    return checkPermission('templates:list')
  }

  const canUpdateTemplates = (): boolean => {
    return checkPermission('templates:update')
  }

  const canActivateTemplates = (): boolean => {
    return checkPermission('templates:activate')
  }

  const canViewActivityLogs = (): boolean => {
    return checkPermission('activity_logs:read')
  }

  const canViewAudit = (): boolean => {
    return checkPermission('audit:read')
  }

  const canModerateContent = (): boolean => {
    return checkPermission('content:moderate')
  }

  const canViewSupportTickets = (): boolean => {
    return checkPermission('support:tickets:read')
  }

  const canRespondToSupportTickets = (): boolean => {
    return checkPermission('support:tickets:respond')
  }

  return {
    // Loading and authentication state
    isLoading,
    isAuthenticated,
    user,

    // Basic role checks
    ...roleChecks,

    // Role and permission checking functions
    checkRole,
    checkAnyRole,
    hasAnySystemRole: checkAnyRole, // Alias for compatibility
    checkPermission,
    checkSystemPermission: checkPermission, // Alias for compatibility
    checkAnyPermission,
    checkAllPermissions,
    checkMinimumRole,
    checkRouteAccess,

    // UI-specific permission helpers
    canViewSystemStats,
    canViewSystemHealth,
    canToggleMaintenance,
    canViewSettings,
    canEditSettings,
    canListOrganizations,
    canViewOrganizations,
    canSuspendOrganizations,
    canListUsers,
    canViewUsers,
    canUpdateUserAdminStatus,
    canViewUserActivity,
    canListTemplates,
    canUpdateTemplates,
    canActivateTemplates,
    canViewActivityLogs,
    canViewAudit,
    canModerateContent,
    canViewSupportTickets,
    canRespondToSupportTickets,
  }
}

export default useSystemRole