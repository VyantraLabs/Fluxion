// System Role and Permission Utilities for Admin Frontend

import { SystemRole, SystemPermission, AdminUser } from '@/types/admin'

/**
 * System role hierarchy (higher roles include permissions of lower roles)
 */
export const SYSTEM_ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 4,
  admin: 3,
  support: 2,
  moderator: 1,
}

/**
 * Complete permission mapping for each system role
 */
export const SYSTEM_ROLE_PERMISSIONS: Record<string, SystemPermission[]> = {
  super_admin: [
    'system:stats:read',
    'system:health:read',
    'system:maintenance:toggle',
    'system:settings:read',
    'system:settings:write',
    'organizations:list',
    'organizations:read',
    'organizations:suspend',
    'users:list',
    'users:read',
    'users:admin_status:update',
    'users:activity:read',
    'templates:list',
    'templates:update',
    'templates:activate',
    'activity_logs:read',
    'audit:read',
    'content:moderate',
    'support:tickets:read',
    'support:tickets:respond',
  ],
  admin: [
    'system:stats:read',
    'system:health:read',
    'system:settings:read',
    'organizations:list',
    'organizations:read',
    'users:list',
    'users:read',
    'users:activity:read',
    'templates:list',
    'templates:update',
    'activity_logs:read',
    'audit:read',
  ],
  support: [
    'organizations:read',
    'users:read',
    'users:activity:read',
    'support:tickets:read',
    'support:tickets:respond',
    'activity_logs:read',
  ],
  moderator: [
    'users:read',
    'content:moderate',
    'activity_logs:read',
  ],
}

/**
 * Route access control based on system roles
 */
export const ROUTE_ACCESS_CONTROL: Record<string, string[]> = {
  '/dashboard': ['super_admin', 'admin', 'support'],
  '/users': ['super_admin', 'admin', 'support'],
  '/users/[id]': ['super_admin', 'admin', 'support'],
  '/organizations': ['super_admin', 'admin'],
  '/organizations/[id]': ['super_admin', 'admin'],
  '/settings': ['super_admin'],
  '/system': ['super_admin', 'admin'],
  '/maintenance': ['super_admin'],
  '/templates': ['super_admin', 'admin'],
  '/activity': ['super_admin', 'admin', 'support'],
  '/audit': ['super_admin', 'admin'],
  '/support': ['super_admin', 'support'],
}

/**
 * Check if user has system access
 */
export function hasSystemAccess(user: AdminUser | any | null): boolean {
  if (!user) return false
  
  // Handle both array format (legacy) and single role format (new)
  const systemRoles = user.system_roles || user.systemRoles || []
  const singleRole = user.role
  
  return (
    user.has_system_access ||
    (systemRoles && systemRoles.length > 0) ||
    (singleRole && ['super_admin', 'admin', 'support'].includes(singleRole))
  )
}

/**
 * Check if user has specific system role
 */
export function hasSystemRole(user: AdminUser | any | null, role: string): boolean {
  if (!user || !hasSystemAccess(user)) return false
  
  // Handle both array format (legacy) and single role format (new)
  const systemRoles = user.system_roles || user.systemRoles || []
  const singleRole = user.role
  
  // Check array format first (legacy)
  if (systemRoles.length > 0) {
    return systemRoles.includes(role)
  }
  
  // Check single role format (new)
  return singleRole === role
}

/**
 * Check if user has any of the specified system roles
 */
export function hasAnySystemRole(user: AdminUser | any | null, roles: string[]): boolean {
  if (!user || !hasSystemAccess(user)) return false
  
  return roles.some(role => hasSystemRole(user, role))
}

/**
 * Check if user has specific system permission
 */
export function hasSystemPermission(user: AdminUser | any | null, permission: SystemPermission): boolean {
  if (!user || !hasSystemAccess(user)) return false
  
  // Handle both array format (legacy) and single role format (new)
  const userRoles = user.system_roles || user.systemRoles || []
  const singleRole = user.role
  
  // Check array format first (legacy)
  if (userRoles.length > 0) {
    // System super admin has all permissions
    if (userRoles.includes('super_admin')) return true
    
    // Check if any of user's roles have the required permission
    return userRoles.some(role => 
      SYSTEM_ROLE_PERMISSIONS[role]?.includes(permission)
    )
  }
  
  // Check single role format (new)
  if (singleRole) {
    // System super admin has all permissions
    if (singleRole === 'super_admin') return true
    
    // Check if the user's single role has the required permission
    return SYSTEM_ROLE_PERMISSIONS[singleRole]?.includes(permission) || false
  }
  
  return false
}

/**
 * Get highest system role for user (for display purposes)
 */
export function getHighestSystemRole(user: AdminUser | any | null): string | null {
  if (!user || !hasSystemAccess(user)) return null
  
  // Handle both array format (legacy) and single role format (new)
  const userRoles = user.system_roles || user.systemRoles || []
  const singleRole = user.role
  
  // If single role format, return that role
  if (singleRole && (!userRoles || userRoles.length === 0)) {
    return singleRole
  }
  
  // If array format, find highest role
  if (userRoles.length === 0) return null
  
  return userRoles.reduce((highest, current) => {
    return SYSTEM_ROLE_HIERARCHY[current] > SYSTEM_ROLE_HIERARCHY[highest] ? current : highest
  })
}

/**
 * Get display name for system role
 */
export function getSystemRoleDisplayName(role: string): string {
  const displayNames: Record<string, string> = {
    super_admin: 'Super Administrator',
    admin: 'System Administrator',
    support: 'Support Specialist',
    moderator: 'Content Moderator',
  }
  
  return displayNames[role] || role
}

/**
 * Get display badge color for system role
 */
export function getSystemRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    super_admin: 'bg-red-100 text-red-800 border-red-200',
    admin: 'bg-purple-100 text-purple-800 border-purple-200',
    support: 'bg-blue-100 text-blue-800 border-blue-200',
    moderator: 'bg-green-100 text-green-800 border-green-200',
  }
  
  return colors[role] || 'bg-gray-100 text-gray-800 border-gray-200'
}

/**
 * Check if user can access a specific route
 */
export function canAccessRoute(user: AdminUser | any | null, route: string): boolean {
  if (!user || !hasSystemAccess(user)) return false
  
  // Find matching route pattern
  const routePattern = Object.keys(ROUTE_ACCESS_CONTROL).find(pattern => {
    // Convert Next.js dynamic route pattern to regex
    const regexPattern = pattern
      .replace(/\[.*?\]/g, '[^/]+')  // Replace [id] with [^/]+
      .replace(/\//g, '\\/')         // Escape forward slashes
    
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(route)
  })
  
  if (!routePattern) {
    // If route not defined in access control, allow access for any system user
    return true
  }
  
  const allowedRoles = ROUTE_ACCESS_CONTROL[routePattern]
  return hasAnySystemRole(user, allowedRoles)
}

/**
 * Get user's effective permissions (all permissions from all roles)
 */
export function getUserSystemPermissions(user: AdminUser | any | null): SystemPermission[] {
  if (!user || !hasSystemAccess(user)) return []
  
  // Handle both array format (legacy) and single role format (new)
  const userRoles = user.system_roles || user.systemRoles || []
  const singleRole = user.role
  const permissions = new Set<SystemPermission>()
  
  // Check array format first (legacy)
  if (userRoles.length > 0) {
    userRoles.forEach(role => {
      SYSTEM_ROLE_PERMISSIONS[role]?.forEach(permission => {
        permissions.add(permission)
      })
    })
  } else if (singleRole) {
    // Check single role format (new)
    SYSTEM_ROLE_PERMISSIONS[singleRole]?.forEach(permission => {
      permissions.add(permission)
    })
  }
  
  return Array.from(permissions)
}

/**
 * Check if user has minimum role level required
 */
export function hasMinimumSystemRole(user: AdminUser | any | null, minimumRole: string): boolean {
  if (!user || !hasSystemAccess(user)) return false
  
  // Handle both array format (legacy) and single role format (new)
  const userRoles = user.system_roles || user.systemRoles || []
  const singleRole = user.role
  const minimumLevel = SYSTEM_ROLE_HIERARCHY[minimumRole]
  
  // Check array format first (legacy)
  if (userRoles.length > 0) {
    return userRoles.some(role => SYSTEM_ROLE_HIERARCHY[role] >= minimumLevel)
  }
  
  // Check single role format (new)
  if (singleRole) {
    return SYSTEM_ROLE_HIERARCHY[singleRole] >= minimumLevel
  }
  
  return false
}

/**
 * Error messages for access denied scenarios
 */
export const ACCESS_DENIED_MESSAGES = {
  NO_SYSTEM_ACCESS: 'Access denied: This area is restricted to system administrators only',
  INSUFFICIENT_ROLE: 'Access denied: You do not have sufficient privileges to access this area',
  ROUTE_RESTRICTED: 'Access denied: This page requires elevated system privileges',
  PERMISSION_DENIED: 'Access denied: This action requires specific system permissions',
} as const