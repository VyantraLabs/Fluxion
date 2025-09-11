import { User } from '@/types/user';

// RBAC-based permission checks for frontend
export class UserPermissions {
  private user: User;

  constructor(user: User) {
    this.user = user;
  }

  // Helper to check organization roles
  private hasOrganizationRole(role: string): boolean {
    return this.user.organization_roles?.includes(role) || false;
  }

  // Helper to check system roles
  private hasSystemRole(role: string): boolean {
    return this.user.system_roles?.includes(role) || false;
  }

  // Check if user can view/manage organization users
  canManageUsers(): boolean {
    return this.hasOrganizationRole('owner') || this.hasOrganizationRole('admin');
  }

  // Check if user can view analytics
  canViewAnalytics(): boolean {
    return this.hasOrganizationRole('owner') || this.hasOrganizationRole('admin');
  }

  // Check if user can manage settings
  canManageSettings(): boolean {
    return this.hasOrganizationRole('owner');
  }

  // Check if user can create/edit invoices
  canCreateInvoices(): boolean {
    return !this.hasOrganizationRole('viewer');
  }

  // Check if user can manage templates
  canManageTemplates(): boolean {
    return this.hasOrganizationRole('owner') || this.hasOrganizationRole('admin');
  }

  // Check if user is organization owner
  isOwner(): boolean {
    return this.hasOrganizationRole('owner');
  }

  // Check if user is admin (organizational)
  isAdmin(): boolean {
    return this.hasOrganizationRole('admin');
  }

  // Check if user has system admin privileges
  isSystemAdmin(): boolean {
    return this.hasSystemRole('super_admin') || this.hasSystemRole('admin');
  }

  // System admin privileges are handled via JWT tokens and backend permissions
  // Frontend permissions are based on RBAC roles for security
}

// Utility functions for role checks
export const checkUserPermissions = (user: User | null) => {
  if (!user) return null;
  return new UserPermissions(user);
};

export const canUserManageUsers = (user: User | null): boolean => {
  if (!user) {
    console.debug('canUserManageUsers: No user provided');
    return false;
  }
  
  const permissions = checkUserPermissions(user);
  const canManage = permissions?.canManageUsers() || false;
  
  console.debug('canUserManageUsers:', {
    user: {
      id: user.id,
      organization_roles: user.organization_roles,
      system_roles: user.system_roles
    },
    canManage
  });
  
  return canManage;
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