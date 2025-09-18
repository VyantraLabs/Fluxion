/**
 * Permission checking utilities for request handlers
 * 
 * These utilities provide easy-to-use permission checking functions
 * that can be used in Express route handlers and middleware.
 */

import { Request, Response, NextFunction } from 'express';
import { RequestContext } from '@/types/common';
import { permissions, Role, hasPermission } from './role-hierarchy';
import { Logger } from './logger';

const logger = new Logger('Permissions');

/**
 * Get user role from request context
 */
export function getUserRole(req: Request): Role | undefined {
  return req.context?.userRole as Role;
}

/**
 * Check if user has specific permission
 */
export function checkPermission(req: Request, permissionCheck: (role: Role | string | undefined) => boolean): boolean {
  const userRole = getUserRole(req);
  return permissionCheck(userRole);
}

/**
 * Middleware factory for requiring specific permissions
 */
export function requirePermission(permissionCheck: (role: Role | string | undefined) => boolean, errorMessage?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = getUserRole(req);
    const hasAccess = permissionCheck(userRole);
    
    if (!hasAccess) {
      logger.warn('Permission denied', {
        userId: req.context?.userId,
        userRole,
        path: req.path,
        method: req.method,
        errorMessage: errorMessage || 'Insufficient permissions'
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: errorMessage || 'Insufficient permissions for this operation'
        },
        meta: {
          requestId: req.context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    next();
  };
}

/**
 * Middleware factory for requiring minimum role level
 */
export function requireRole(minimumRole: Role, errorMessage?: string) {
  return requirePermission(
    (userRole) => hasPermission(userRole, minimumRole),
    errorMessage || `Requires ${minimumRole} role or higher`
  );
}

/**
 * Common permission middleware functions
 */
export const permissionMiddleware = {
  // System permissions
  requireSystemAccess: requirePermission(permissions.canManageSystem, 'System administrator access required'),
  requireSuperAdmin: requireRole('super_admin', 'Super administrator access required'),
  requireSystemAdmin: requireRole('system_admin', 'System administrator access required'),
  
  // Organization permissions
  requireOrganizationOwner: requireRole('owner', 'Organization owner access required'),
  requireOrganizationAdmin: requireRole('admin', 'Organization administrator access required'),
  requireMember: requireRole('member', 'Member access required'),
  requireViewer: requireRole('viewer', 'User access required'),
  
  // Feature-specific permissions
  requireUserManagement: requirePermission(permissions.canManageUsers, 'User management permissions required'),
  requireInvoiceCreation: requirePermission(permissions.canCreateInvoices, 'Invoice creation permissions required'),
  requireInvoiceEdit: requirePermission(permissions.canEditInvoices, 'Invoice editing permissions required'),
  requireInvoiceDelete: requirePermission(permissions.canDeleteInvoices, 'Invoice deletion permissions required'),
  requireAnalytics: requirePermission(permissions.canViewAnalytics, 'Analytics viewing permissions required'),
  requireSettings: requirePermission(permissions.canManageSettings, 'Settings management permissions required'),
  requireBilling: requirePermission(permissions.canManageBilling, 'Billing management permissions required'),
  requireDataExport: requirePermission(permissions.canExportData, 'Data export permissions required'),
};

/**
 * Helper functions for checking permissions in handlers
 */
export const can = {
  // System permissions
  manageSystem: (req: Request) => checkPermission(req, permissions.canManageSystem),
  manageAllOrganizations: (req: Request) => checkPermission(req, permissions.canManageAllOrganizations),
  manageOrganizations: (req: Request) => checkPermission(req, permissions.canManageOrganizations),
  
  // Organization permissions
  manageOrganization: (req: Request) => checkPermission(req, permissions.canManageOrganization),
  manageUsers: (req: Request) => checkPermission(req, permissions.canManageUsers),
  createInvoices: (req: Request) => checkPermission(req, permissions.canCreateInvoices),
  viewInvoices: (req: Request) => checkPermission(req, permissions.canViewInvoices),
  editInvoices: (req: Request) => checkPermission(req, permissions.canEditInvoices),
  deleteInvoices: (req: Request) => checkPermission(req, permissions.canDeleteInvoices),
  
  // Settings permissions
  manageSettings: (req: Request) => checkPermission(req, permissions.canManageSettings),
  manageBilling: (req: Request) => checkPermission(req, permissions.canManageBilling),
  viewAnalytics: (req: Request) => checkPermission(req, permissions.canViewAnalytics),
  exportData: (req: Request) => checkPermission(req, permissions.canExportData),
  
  // User management permissions
  inviteUsers: (req: Request) => checkPermission(req, permissions.canInviteUsers),
  removeUsers: (req: Request) => checkPermission(req, permissions.canRemoveUsers),
  changeRoles: (req: Request) => checkPermission(req, permissions.canChangeRoles),
};

/**
 * Permission checking for resource ownership
 * Use this when a user should be able to access their own resources regardless of role
 */
export function canAccessOwnResource(req: Request, resourceUserId: string): boolean {
  const currentUserId = req.context?.userId;
  
  // User can always access their own resources
  if (currentUserId === resourceUserId) {
    return true;
  }
  
  // Admins can access any user's resources
  return can.manageUsers(req);
}

/**
 * Permission checking for organization resources
 * Use this when checking access to organization-scoped resources
 */
export function canAccessOrganizationResource(req: Request, resourceTenantId?: string): boolean {
  const userTenantId = req.context?.tenantId;
  
  // System roles can access any organization's resources
  if (checkPermission(req, permissions.canManageSystem)) {
    return true;
  }
  
  // Must be in the same organization
  if (!userTenantId || !resourceTenantId || userTenantId !== resourceTenantId) {
    return false;
  }
  
  // Must have at least viewer access
  return can.viewInvoices(req);
}

/**
 * Enhanced permission error with detailed information
 */
export function createPermissionError(req: Request, action: string, resource?: string): any {
  const userRole = getUserRole(req);
  
  return {
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: `Insufficient permissions to ${action}${resource ? ` ${resource}` : ''}`,
      details: {
        currentRole: userRole,
        action,
        resource,
        userId: req.context?.userId,
        path: req.path,
        method: req.method
      }
    },
    meta: {
      requestId: req.context?.requestId || 'unknown',
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Utility to check and respond with proper error if permission denied
 */
export function requirePermissionOrFail(
  req: Request, 
  res: Response, 
  permissionCheck: (role: Role | string | undefined) => boolean,
  action: string,
  resource?: string
): boolean {
  const hasAccess = checkPermission(req, permissionCheck);
  
  if (!hasAccess) {
    logger.warn('Permission denied', {
      userId: req.context?.userId,
      userRole: getUserRole(req),
      action,
      resource,
      path: req.path,
      method: req.method
    });
    
    res.status(403).json(createPermissionError(req, action, resource));
    return false;
  }
  
  return true;
}

/**
 * Debug helper to log current user permissions
 */
export function debugPermissions(req: Request): void {
  const userRole = getUserRole(req);
  const userId = req.context?.userId;
  
  logger.debug('User permissions debug', {
    userId,
    userRole,
    path: req.path,
    method: req.method,
    permissions: {
      manageSystem: can.manageSystem(req),
      manageOrganization: can.manageOrganization(req),
      manageUsers: can.manageUsers(req),
      createInvoices: can.createInvoices(req),
      editInvoices: can.editInvoices(req),
      deleteInvoices: can.deleteInvoices(req),
      manageSettings: can.manageSettings(req),
      viewAnalytics: can.viewAnalytics(req)
    }
  });
}