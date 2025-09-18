/**
 * Single Role Hierarchy System
 * 
 * Each user has exactly ONE role that determines all their permissions.
 * Role hierarchy: super_admin > system_admin > owner > admin > member > viewer
 */

export type Role = 'super_admin' | 'system_admin' | 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Role hierarchy levels (higher number = more permissions)
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  'super_admin': 100,    // Full system access, can manage all organizations and users
  'system_admin': 90,    // System access, can manage organizations but not other system admins
  'owner': 50,           // Organization owner, can manage organization users and settings
  'admin': 40,           // Organization admin, can manage organization users but not settings
  'member': 20,          // Regular user, can create invoices and manage own content
  'viewer': 10           // Read-only access to organization content
};

/**
 * Get the hierarchy level for a role
 */
export function getRoleLevel(role: Role | string | undefined): number {
  if (!role || !isValidRole(role)) {
    return ROLE_HIERARCHY['viewer']; // Default to lowest permission
  }
  return ROLE_HIERARCHY[role as Role];
}

/**
 * Check if a string is a valid role
 */
export function isValidRole(role: string): role is Role {
  return Object.keys(ROLE_HIERARCHY).includes(role);
}

/**
 * Check if user role has equal or higher permissions than required role
 */
export function hasPermission(userRole: Role | string | undefined, requiredRole: Role): boolean {
  const userLevel = getRoleLevel(userRole);
  const requiredLevel = getRoleLevel(requiredRole);
  return userLevel >= requiredLevel;
}

/**
 * Check if user is a system-level role (super_admin or system_admin)
 */
export function isSystemRole(role: Role | string | undefined): boolean {
  return role === 'super_admin' || role === 'system_admin';
}

/**
 * Check if user is an organization-level role (owner, admin, member, viewer)
 */
export function isOrganizationRole(role: Role | string | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer';
}

/**
 * Check if user can manage other users' roles
 */
export function canManageRoles(managerRole: Role | string | undefined, targetRole: Role | string | undefined): boolean {
  const managerLevel = getRoleLevel(managerRole);
  const targetLevel = getRoleLevel(targetRole);
  
  // System roles can only be managed by super_admin
  if (isSystemRole(targetRole)) {
    return managerRole === 'super_admin';
  }
  
  // Organization roles can be managed by owner, admin, or system roles
  if (isOrganizationRole(targetRole)) {
    return managerLevel >= ROLE_HIERARCHY['admin'] || isSystemRole(managerRole);
  }
  
  return false;
}

/**
 * Get all roles that a user can assign to others
 */
export function getAssignableRoles(managerRole: Role | string | undefined): Role[] {
  const assignableRoles: Role[] = [];
  
  if (managerRole === 'super_admin') {
    // Super admin can assign any role
    return Object.keys(ROLE_HIERARCHY) as Role[];
  }
  
  if (managerRole === 'system_admin') {
    // System admin can assign organization roles but not system roles
    return ['owner', 'admin', 'member', 'viewer'];
  }
  
  if (managerRole === 'owner' || managerRole === 'admin') {
    // Organization admin/owner can assign organization roles
    return ['admin', 'member', 'viewer'];
  }
  
  // Members and viewers cannot assign roles
  return [];
}

/**
 * Permission checking functions for common operations
 */
export const permissions = {
  // System permissions
  canManageSystem: (role: Role | string | undefined) => isSystemRole(role),
  canManageAllOrganizations: (role: Role | string | undefined) => role === 'super_admin',
  canManageOrganizations: (role: Role | string | undefined) => hasPermission(role, 'system_admin'),
  
  // Organization permissions
  canManageOrganization: (role: Role | string | undefined) => hasPermission(role, 'owner'),
  canManageUsers: (role: Role | string | undefined) => hasPermission(role, 'admin'),
  canCreateInvoices: (role: Role | string | undefined) => hasPermission(role, 'member'),
  canViewInvoices: (role: Role | string | undefined) => hasPermission(role, 'viewer'),
  canEditInvoices: (role: Role | string | undefined) => hasPermission(role, 'member'),
  canDeleteInvoices: (role: Role | string | undefined) => hasPermission(role, 'admin'),
  
  // Settings permissions
  canManageSettings: (role: Role | string | undefined) => hasPermission(role, 'owner'),
  canManageBilling: (role: Role | string | undefined) => hasPermission(role, 'owner'),
  canViewAnalytics: (role: Role | string | undefined) => hasPermission(role, 'admin'),
  canExportData: (role: Role | string | undefined) => hasPermission(role, 'admin'),
  
  // User management permissions
  canInviteUsers: (role: Role | string | undefined) => hasPermission(role, 'admin'),
  canRemoveUsers: (role: Role | string | undefined) => hasPermission(role, 'admin'),
  canChangeRoles: (role: Role | string | undefined) => hasPermission(role, 'admin'),
};

/**
 * Get role display name
 */
export function getRoleDisplayName(role: Role | string | undefined): string {
  const displayNames: Record<Role, string> = {
    'super_admin': 'Super Administrator',
    'system_admin': 'System Administrator',
    'owner': 'Organization Owner',
    'admin': 'Administrator',
    'member': 'Member',
    'viewer': 'Viewer'
  };
  
  if (!role || !isValidRole(role)) {
    return 'Unknown Role';
  }
  
  return displayNames[role as Role];
}

/**
 * Get role description
 */
export function getRoleDescription(role: Role | string | undefined): string {
  const descriptions: Record<Role, string> = {
    'super_admin': 'Full system access, can manage all organizations and users',
    'system_admin': 'System access, can manage organizations but not other system admins',
    'owner': 'Organization owner, can manage organization users and settings',
    'admin': 'Organization admin, can manage organization users but not settings',
    'member': 'Regular user, can create invoices and manage own content',
    'viewer': 'Read-only access to organization content'
  };
  
  if (!role || !isValidRole(role)) {
    return 'Unknown role';
  }
  
  return descriptions[role as Role];
}

/**
 * Get default role for new users
 */
export function getDefaultRole(): Role {
  return 'member';
}

/**
 * Get default role for organization owners
 */
export function getOwnerRole(): Role {
  return 'owner';
}

/**
 * Validate role assignment
 */
export function validateRoleAssignment(
  managerRole: Role | string | undefined,
  targetRole: Role | string | undefined,
  newRole: Role | string | undefined
): { valid: boolean; error?: string } {
  // Check if manager can assign roles
  if (!permissions.canChangeRoles(managerRole)) {
    return { valid: false, error: 'Insufficient permissions to change roles' };
  }
  
  // Check if new role is valid
  if (!newRole || !isValidRole(newRole)) {
    return { valid: false, error: 'Invalid role specified' };
  }
  
  // Check if manager can assign this specific role
  const assignableRoles = getAssignableRoles(managerRole);
  if (!assignableRoles.includes(newRole as Role)) {
    return { valid: false, error: `Cannot assign role: ${newRole}` };
  }
  
  // Prevent self-demotion for owners (unless super_admin)
  if (targetRole === 'owner' && newRole !== 'owner' && managerRole !== 'super_admin') {
    return { valid: false, error: 'Cannot demote organization owner without super admin privileges' };
  }
  
  return { valid: true };
}