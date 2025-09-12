'use client';

import React from 'react';
import { Shield, AlertCircle, Lock } from 'lucide-react';
import { useUserPermissions } from '@/contexts/OrganizationContext';
import { Organization } from '@/types/user';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  organization?: Organization;
  requireOwner?: boolean;
  requireSystemAdmin?: boolean;
  requireOrgAdmin?: boolean;
  fallback?: React.ReactNode;
  showError?: boolean;
}

interface RoleBasedGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  userRoles: string[];
  fallback?: React.ReactNode;
}

interface PermissionCheckProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Main Permission Guard Component
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredRoles = [],
  requiredPermissions = [],
  organization,
  requireOwner = false,
  requireSystemAdmin = false,
  requireOrgAdmin = false,
  fallback,
  showError = true,
}) => {
  const permissions = useUserPermissions();

  if (!permissions) {
    if (showError) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
            <p className="text-gray-600">Please log in to access this content.</p>
          </div>
        </div>
      );
    }
    return fallback || null;
  }

  // Check system admin requirement
  if (requireSystemAdmin && !permissions.isSystemAdmin) {
    if (showError) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <Shield className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">System Admin Required</h3>
            <p className="text-gray-600">You need system administrator privileges to access this content.</p>
          </div>
        </div>
      );
    }
    return fallback || null;
  }

  // Check owner requirement
  if (requireOwner && !permissions.isOwner && !permissions.isSystemAdmin) {
    if (showError) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <Lock className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Owner Access Required</h3>
            <p className="text-gray-600">You need to be an organization owner to access this content.</p>
          </div>
        </div>
      );
    }
    return fallback || null;
  }

  // Check org admin requirement
  if (requireOrgAdmin && !permissions.isOrgAdmin && !permissions.isOwner && !permissions.isSystemAdmin) {
    if (showError) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <Shield className="mx-auto h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Admin Access Required</h3>
            <p className="text-gray-600">You need organization admin privileges to access this content.</p>
          </div>
        </div>
      );
    }
    return fallback || null;
  }

  // Check specific role requirements (simplified for single role system)
  if (requiredRoles.length > 0) {
    // Get user's single role and check hierarchical permissions
    const { checkUserPermissions, hasMinRole } = require('@/utils/permissions');
    const userPermissions = checkUserPermissions(permissions.user);
    const userRole = userPermissions?.getRole() || 'viewer';
    
    // Check if user has any of the required roles or higher
    const hasRequiredRole = requiredRoles.some(role => {
      // Direct role match
      if (userRole === role) return true;
      // Hierarchical check - if user has higher role
      return hasMinRole(permissions.user, role);
    });
    
    if (!hasRequiredRole) {
      if (showError) {
        return (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Insufficient Permissions</h3>
              <p className="text-gray-600">
                You need one of the following roles: {requiredRoles.join(', ')}. Your current role: {userRole}
              </p>
            </div>
          </div>
        );
      }
      return fallback || null;
    }
  }

  // Check specific permission requirements
  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission => {
      switch (permission) {
        case 'manage_users':
          return permissions.canManageUsers;
        case 'invite_users':
          return permissions.canInviteUsers;
        case 'remove_users':
          return permissions.canRemoveUsers;
        case 'change_roles':
          return permissions.canChangeRoles;
        case 'view_activity':
          return permissions.canViewActivity;
        case 'manage_settings':
          return permissions.canManageSettings;
        case 'view_all_organizations':
          return permissions.canViewAllOrganizations;
        default:
          return false;
      }
    });

    if (!hasAllPermissions) {
      if (showError) {
        return (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Lock className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
              <p className="text-gray-600">
                You don't have the required permissions to access this content.
              </p>
            </div>
          </div>
        );
      }
      return fallback || null;
    }
  }

  // If all checks pass, render children
  return <>{children}</>;
};

// Role-based Guard Component
export const RoleBasedGuard: React.FC<RoleBasedGuardProps> = ({
  children,
  allowedRoles,
  userRoles,
  fallback,
}) => {
  const hasAllowedRole = allowedRoles.some(role => userRoles.includes(role));

  if (!hasAllowedRole) {
    return fallback || null;
  }

  return <>{children}</>;
};

// Permission Check Component (for inline checks)
export const PermissionCheck: React.FC<PermissionCheckProps> = ({
  permission,
  children,
  fallback,
}) => {
  const permissions = useUserPermissions();

  if (!permissions) return fallback || null;

  let hasPermission = false;

  switch (permission) {
    case 'manage_users':
      hasPermission = permissions.canManageUsers;
      break;
    case 'invite_users':
      hasPermission = permissions.canInviteUsers;
      break;
    case 'remove_users':
      hasPermission = permissions.canRemoveUsers;
      break;
    case 'change_roles':
      hasPermission = permissions.canChangeRoles;
      break;
    case 'view_activity':
      hasPermission = permissions.canViewActivity;
      break;
    case 'manage_settings':
      hasPermission = permissions.canManageSettings;
      break;
    case 'view_all_organizations':
      hasPermission = permissions.canViewAllOrganizations;
      break;
    default:
      hasPermission = false;
  }

  return hasPermission ? <>{children}</> : (fallback || null);
};

// Owner Only Guard
export const OwnerGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => {
  return (
    <PermissionGuard requireOwner fallback={fallback} showError={false}>
      {children}
    </PermissionGuard>
  );
};

// System Admin Only Guard
export const SystemAdminGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => {
  return (
    <PermissionGuard requireSystemAdmin fallback={fallback} showError={false}>
      {children}
    </PermissionGuard>
  );
};

// Organization Admin Guard (includes owners and system admins)
export const OrgAdminGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => {
  return (
    <PermissionGuard requireOrgAdmin fallback={fallback} showError={false}>
      {children}
    </PermissionGuard>
  );
};

// Multi-Organization Guard
export const MultiOrgGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => {
  return (
    <PermissionGuard requiredPermissions={['view_all_organizations']} fallback={fallback} showError={false}>
      {children}
    </PermissionGuard>
  );
};

// Utility hook for permission checks
export const usePermissionCheck = () => {
  const permissions = useUserPermissions();

  return {
    canManageUsers: permissions?.canManageUsers || false,
    canInviteUsers: permissions?.canInviteUsers || false,
    canRemoveUsers: permissions?.canRemoveUsers || false,
    canChangeRoles: permissions?.canChangeRoles || false,
    canViewActivity: permissions?.canViewActivity || false,
    canManageSettings: permissions?.canManageSettings || false,
    canViewAllOrganizations: permissions?.canViewAllOrganizations || false,
    isOwner: permissions?.isOwner || false,
    isSystemAdmin: permissions?.isSystemAdmin || false,
    isOrgAdmin: permissions?.isOrgAdmin || false,
    hasRole: (role: string) => {
      if (!permissions) return false;
      const { checkUserPermissions } = require('@/utils/permissions');
      const userPermissions = checkUserPermissions(permissions.user);
      return userPermissions?.hasRole(role) || false;
    },
    hasAnyRole: (roles: string[]) => {
      if (!permissions) return false;
      const { checkUserPermissions } = require('@/utils/permissions');
      const userPermissions = checkUserPermissions(permissions.user);
      return roles.some(role => userPermissions?.hasRole(role) || userPermissions?.hasMinRole(role)) || false;
    },
  };
};