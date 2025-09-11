// Permission utility functions for admin interface

import { AdminPermission, AdminUser } from '@/types/admin'

export function hasPermission(user: AdminUser | null, permission: AdminPermission): boolean {
  if (!user) return false

  // Helper functions to check roles
  const hasSystemRole = (role: string) => user.system_roles?.includes(role) || false
  const hasOrgRole = (role: string) => user.organization_roles?.includes(role) || false

  // System Super Admins have all permissions
  if (hasSystemRole('super_admin')) return true
  
  // System Admins have most permissions
  if (hasSystemRole('admin')) {
    const systemAdminPermissions: AdminPermission[] = [
      'system:read',
      'organizations:read',
      'organizations:write', 
      'users:read',
      'users:write',
      'templates:read',
      'templates:write',
      'activity:read'
    ]
    
    if (systemAdminPermissions.includes(permission)) {
      return true
    }
  }

  // Organization Owners have admin rights within their organization context
  if (hasOrgRole('owner')) {
    const orgOwnerPermissions: AdminPermission[] = [
      'organizations:read',
      'organizations:write', // Can manage their own organization
      'users:read',          // Can view users in their organization
      'users:write',         // Can manage users in their organization
      'templates:read',
      'templates:write',
      'activity:read'        // Can view activity in their organization
    ]
    
    if (orgOwnerPermissions.includes(permission)) {
      return true
    }
  }

  // Organization Admins (non-owners) have limited admin rights
  if (hasOrgRole('admin')) {
    const orgAdminPermissions: AdminPermission[] = [
      'users:read',     // Can view users in their organization
      'users:write',    // Can manage users in their organization
      'templates:read',
      'activity:read'   // Can view activity in their organization
    ]
    
    if (orgAdminPermissions.includes(permission)) {
      return true
    }
  }

  // Super admin only permissions
  const superAdminPermissions: AdminPermission[] = [
    'system:write',
    'settings:read',
    'settings:write',
    'maintenance:toggle'
  ]

  if (superAdminPermissions.includes(permission)) {
    return hasSystemRole('super_admin')
  }

  return false
}

export function requiresSuperAdmin(permission: AdminPermission): boolean {
  const superAdminPermissions: AdminPermission[] = [
    'system:write',
    'settings:read', 
    'settings:write',
    'maintenance:toggle'
  ]
  
  return superAdminPermissions.includes(permission)
}

// RBAC utility functions
export function hasSystemRole(user: AdminUser | null, role: string): boolean {
  if (!user) return false
  return user.system_roles?.includes(role) || false
}

export function hasOrganizationRole(user: AdminUser | null, role: string): boolean {
  if (!user) return false
  return user.organization_roles?.includes(role) || false
}

export function isSystemSuperAdmin(user: AdminUser | null): boolean {
  return hasSystemRole(user, 'super_admin')
}

export function isSystemAdmin(user: AdminUser | null): boolean {
  return hasSystemRole(user, 'admin') || hasSystemRole(user, 'super_admin')
}

export function getPermissionLabel(permission: AdminPermission): string {
  const labels: Record<AdminPermission, string> = {
    'system:read': 'View System Statistics',
    'system:write': 'Manage System Settings',
    'organizations:read': 'View Organizations',
    'organizations:write': 'Manage Organizations',
    'users:read': 'View Users',
    'users:write': 'Manage Users',
    'templates:read': 'View Templates',
    'templates:write': 'Manage Templates',
    'settings:read': 'View Settings',
    'settings:write': 'Manage Settings',
    'activity:read': 'View Activity Logs',
    'maintenance:toggle': 'Toggle Maintenance Mode'
  }
  
  return labels[permission] || permission
}