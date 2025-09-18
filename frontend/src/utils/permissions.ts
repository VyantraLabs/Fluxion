import { User } from '@/types/user';

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
  'super_admin': 100,
  'system_admin': 90,
  'owner': 50,
  'admin': 40,
  'member': 20,
  'viewer': 10
} as const;

// Permission matrix defining what each role can do
const ROLE_PERMISSIONS = {
  'super_admin': ['*'], // All permissions
  'system_admin': ['system:*', 'org:*', 'user:*', 'invoice:*'],
  'owner': ['org:manage', 'user:manage', 'invoice:*', 'template:*', 'settings:manage'],
  'admin': ['user:manage', 'invoice:*', 'template:read', 'analytics:view'],
  'member': ['invoice:create', 'invoice:read', 'template:read'],
  'viewer': ['invoice:read', 'template:read']
} as const;

type RoleName = keyof typeof ROLE_HIERARCHY;
type Permission = string;

// Simplified permission checks for single role system
export class UserPermissions {
  private user: User;
  private role: string;

  constructor(user: User) {
    this.user = user;
    // Get role from new single role field, fallback to legacy arrays for backwards compatibility
    this.role = this.getUserRole(user);
  }

  // Extract user's single role (handles backwards compatibility)
  private getUserRole(user: User): string {
    // First priority: new single role field
    if (user.role) {
      return user.role;
    }
    
    // Backwards compatibility: extract from legacy role arrays
    // Prioritize system roles over organization roles
    if (user.system_roles && user.system_roles.length > 0) {
      const systemRole = user.system_roles[0]; // Take first system role
      if (['super_admin', 'system_admin'].includes(systemRole)) {
        return systemRole;
      }
    }
    
    // Check organization roles
    if (user.organization_roles && user.organization_roles.length > 0) {
      const orgRole = user.organization_roles[0]; // Take first org role
      if (['owner', 'admin', 'member'].includes(orgRole)) {
        return orgRole;
      }
      // Handle legacy role names
      if (orgRole === 'org_admin') return 'admin';
    }
    
    // Default to viewer if no role found
    return 'viewer';
  }

  // Check if user has specific role
  hasRole(requiredRole: string): boolean {
    return this.role === requiredRole;
  }

  // Check if user has minimum role level (hierarchical check)
  hasMinRole(minRole: string): boolean {
    const userLevel = ROLE_HIERARCHY[this.role as RoleName] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole as RoleName] || 0;
    return userLevel >= requiredLevel;
  }

  // Check if user has specific permission
  hasPermission(permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[this.role as RoleName] || [];
    
    // Check for wildcard permissions
    if ((rolePermissions as unknown as string[]).includes('*')) {
      return true;
    }
    
    // Check for exact permission match
    if ((rolePermissions as unknown as string[]).includes(permission)) {
      return true;
    }
    
    // Check for wildcard category matches (e.g., 'user:*' matches 'user:manage')
    const category = permission.split(':')[0];
    if ((rolePermissions as unknown as string[]).includes(`${category}:*`)) {
      return true;
    }
    
    return false;
  }

  // Specific permission checks
  canManageUsers(): boolean {
    return this.hasPermission('user:manage');
  }

  canViewAnalytics(): boolean {
    return this.hasPermission('analytics:view') || this.hasMinRole('admin');
  }

  canManageSettings(): boolean {
    return this.hasPermission('settings:manage');
  }

  canCreateInvoices(): boolean {
    return this.hasPermission('invoice:create');
  }

  canManageTemplates(): boolean {
    return this.hasPermission('template:manage');
  }

  canViewAllOrganizations(): boolean {
    return this.hasMinRole('system_admin');
  }

  // Role checks
  isOwner(): boolean {
    return this.hasRole('owner');
  }

  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  isSystemAdmin(): boolean {
    return this.hasMinRole('system_admin');
  }

  isSuperAdmin(): boolean {
    return this.hasRole('super_admin');
  }

  // Get user's role for display
  getRole(): string {
    return this.role;
  }

  // Get role display name
  getRoleDisplayName(): string {
    const displayNames: Record<string, string> = {
      'super_admin': 'Super Admin',
      'system_admin': 'System Admin',
      'owner': 'Owner',
      'admin': 'Admin',
      'member': 'Member',
      'viewer': 'Viewer'
    };
    return displayNames[this.role] || this.role;
  }
}

// Utility functions for role checks
export const checkUserPermissions = (user: User | null) => {
  if (!user) return null;
  return new UserPermissions(user);
};

// Simplified utility functions for single role system
export const canUserManageUsers = (user: User | null): boolean => {
  if (!user) {
    return false;
  }
  
  const permissions = checkUserPermissions(user);
  return permissions?.canManageUsers() || false;
};

export const canUserViewAnalytics = (user: User | null): boolean => {
  if (!user) return false;
  const permissions = checkUserPermissions(user);
  return permissions?.canViewAnalytics() || false;
};

export const canUserManageSettings = (user: User | null): boolean => {
  if (!user) return false;
  const permissions = checkUserPermissions(user);
  return permissions?.canManageSettings() || false;
};

// New utility functions for single role system
export const hasRole = (user: User | null, requiredRole: string): boolean => {
  if (!user) return false;
  const permissions = checkUserPermissions(user);
  return permissions?.hasRole(requiredRole) || false;
};

export const hasMinRole = (user: User | null, minRole: string): boolean => {
  if (!user) return false;
  const permissions = checkUserPermissions(user);
  return permissions?.hasMinRole(minRole) || false;
};

export const canViewAllOrganizations = (user: User | null): boolean => {
  if (!user) return false;
  const permissions = checkUserPermissions(user);
  return permissions?.canViewAllOrganizations() || false;
};

// Role hierarchy utility
export const getRoleHierarchy = () => ROLE_HIERARCHY;
export const getRolePermissions = () => ROLE_PERMISSIONS;

// Helper to get user's effective role (for debugging/display)
export const getUserEffectiveRole = (user: User | null): string => {
  if (!user) return 'none';
  const permissions = checkUserPermissions(user);
  return permissions?.getRole() || 'viewer';
};

export const getUserRoleDisplayName = (user: User | null): string => {
  if (!user) return 'Not authenticated';
  const permissions = checkUserPermissions(user);
  return permissions?.getRoleDisplayName() || 'Viewer';
};