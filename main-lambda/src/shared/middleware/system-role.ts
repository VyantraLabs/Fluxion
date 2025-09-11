import { Request, Response, NextFunction } from 'express';
import { createUnauthorizedError, createForbiddenError } from '@/shared/errors';
import { Logger } from '@/shared/utils/logger';
import { JWTPayload } from '@/types/user';
import { SystemRoleKey } from '@/database/entities/Role';

const logger = new Logger('SystemRoleMiddleware');

/**
 * Middleware to require specific system roles
 * This is separate from organization-level admin roles
 */
export function requireSystemRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get JWT payload from auth middleware
      const jwtPayload = (req as any).user as JWTPayload;
      
      if (!jwtPayload) {
        logger.warn('No JWT payload found in system role check');
        throw createUnauthorizedError('Authentication required');
      }

      // Check if user has system roles
      if (!jwtPayload.is_system_user || !jwtPayload.system_roles || jwtPayload.system_roles.length === 0) {
        logger.warn('User has no system roles', { 
          user_id: jwtPayload.user_id,
          wallet_address: jwtPayload.wallet_address
        });
        throw createForbiddenError('System admin privileges required');
      }

      // Check if user has any of the required system roles
      const hasRequiredRole = jwtPayload.system_roles.some(role => 
        allowedRoles.includes(role)
      );

      if (!hasRequiredRole) {
        logger.warn('User lacks required system role', { 
          user_id: jwtPayload.user_id,
          user_system_roles: jwtPayload.system_roles,
          required_roles: allowedRoles
        });
        throw createForbiddenError(`Insufficient privileges. Required roles: ${allowedRoles.join(', ')}`);
      }

      // Log successful system role check
      logger.debug('System role check passed', {
        user_id: jwtPayload.user_id,
        user_system_roles: jwtPayload.system_roles,
        required_roles: allowedRoles
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to require super admin system role
 */
export function requireSystemSuperAdmin() {
  return requireSystemRole([SystemRoleKey.SUPER_ADMIN]);
}

/**
 * Middleware to require any system admin role (super admin or admin)
 */
export function requireSystemAdmin() {
  return requireSystemRole([SystemRoleKey.SUPER_ADMIN, SystemRoleKey.ADMIN]);
}

/**
 * Middleware to check if user is a system user (has any system role)
 */
export function requireSystemUser() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const jwtPayload = (req as any).user as JWTPayload;
      
      if (!jwtPayload) {
        logger.warn('No JWT payload found in system user check');
        throw createUnauthorizedError('Authentication required');
      }

      if (!jwtPayload.is_system_user) {
        logger.warn('User is not a system user', { 
          user_id: jwtPayload.user_id,
          wallet_address: jwtPayload.wallet_address
        });
        throw createForbiddenError('System access required');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to reject regular users even if they have organization admin roles
 * Use this to ensure only system-level admins can access certain endpoints
 */
export function rejectOrganizationAdmins() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const jwtPayload = (req as any).user as JWTPayload;
      
      if (!jwtPayload) {
        throw createUnauthorizedError('Authentication required');
      }

      // Reject if user only has organization-level admin privileges
      if (jwtPayload.is_admin && !jwtPayload.is_system_user) {
        logger.warn('Organization admin attempted system access', { 
          user_id: jwtPayload.user_id,
          wallet_address: jwtPayload.wallet_address,
          is_admin: jwtPayload.is_admin,
          is_system_user: jwtPayload.is_system_user
        });
        throw createForbiddenError('System admin access required - organization admin privileges are not sufficient');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}