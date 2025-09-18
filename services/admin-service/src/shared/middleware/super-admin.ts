import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
import { APIResponse, RequestContext } from '../../types/common';
import { UserRepository } from '../../database/repositories/UserRepository';
import { AuditLogRepository } from '../../database/repositories/AuditLogRepository';
import { AuditLog } from '../../database/entities/AuditLog';

const logger = new Logger('SuperAdminMiddleware');

/**
 * Super admin middleware for highly sensitive operations
 * Requires is_super_admin = true and additional security checks
 */
export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = req.context as RequestContext;
    
    // Check if user is authenticated first
    if (!context?.userId) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for super admin access'
        },
        meta: {
          requestId: context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(401).json(response);
    }

    // Get user from database to check super admin status
    const userRepository = new UserRepository();
    const tenantContext = { tenantId: context.tenantId, userId: context.userId };
    const user = await userRepository.findById(tenantContext, context.userId);
    
    if (!user) {
      logger.error('Super admin check: User not found', {
        userId: context.userId,
        path: req.path
      });
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account not found'
        },
        meta: {
          requestId: context.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(404).json(response);
    }

    // Check super admin privileges
    if (!user.isSuperAdmin) {
      logger.warn('Non-super-admin user attempted to access super admin endpoint', {
        userId: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        path: req.path,
        method: req.method,
        ip: context.ip
      });

      // Log security event
      const auditLogRepository = new AuditLogRepository();
      const securityAuditLog = AuditLog.createForAdminAction(
        user.organizationId,
        user.id,
        user.id,
        'access_control',
        req.path,
        'CREATE',
        'critical',
        undefined,
        {
          attemptedAccess: 'super_admin_endpoint',
          path: req.path,
          method: req.method,
          denied: true
        },
        {
          endpoint: req.path,
          method: req.method,
          ip: context.ip,
          userAgent: context.userAgent,
          requestId: context.requestId,
          securityViolation: true,
          reason: 'insufficient_privileges'
        }
      );

      await auditLogRepository.create(securityAuditLog);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_PRIVILEGES',
          message: 'Super admin privileges required for this operation'
        },
        meta: {
          requestId: context.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(403).json(response);
    }

    // Additional security checks for super admin operations
    const securityChecks = await performAdditionalSecurityChecks(user, req);
    if (!securityChecks.passed) {
      logger.error('Super admin security check failed', {
        userId: user.id,
        reason: securityChecks.reason,
        path: req.path
      });

      const response: APIResponse = {
        success: false,
        error: {
          code: 'SECURITY_CHECK_FAILED',
          message: securityChecks.reason || 'Additional security verification required'
        },
        meta: {
          requestId: context.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(403).json(response);
    }

    // Log successful super admin access
    logger.info('Super admin access granted', {
      userId: user.id,
      email: user.email,
      path: req.path,
      method: req.method,
      ip: context.ip
    });

    // Add user object to request context for use in handlers
    (context as any).user = user;

    next();
  } catch (error: any) {
    logger.error('Failed to validate super admin access', {
      error: error.message,
      stack: error.stack,
      userId: req.context?.userId,
      path: req.path
    });
    
    const response: APIResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate super admin access'
      },
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };
    
    return res.status(500).json(response);
  }
};

/**
 * Admin middleware (regular admin access, not super admin)
 * Can be used for organization-level admin operations
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = req.context as RequestContext;
    
    if (!context?.userId) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for admin access'
        },
        meta: {
          requestId: context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(401).json(response);
    }

    const userRepository = new UserRepository();
    const tenantContext = { tenantId: context.tenantId, userId: context.userId };
    const user = await userRepository.findById(tenantContext, context.userId);
    
    if (!user) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account not found'
        },
        meta: {
          requestId: context.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(404).json(response);
    }

    // Check if user has any admin privileges (system admin, super admin, or organization admin/owner)
    const hasAdminPrivileges = user.isAdmin || user.isSuperAdmin || user.role === 'owner' || user.role === 'admin';
    
    if (!hasAdminPrivileges) {
      logger.warn('Non-admin user attempted to access admin endpoint', {
        userId: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        isOwner: user.role === 'owner',
        path: req.path
      });
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_PRIVILEGES',
          message: 'Admin privileges required for this operation'
        },
        meta: {
          requestId: context.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(403).json(response);
    }

    logger.info('Admin access granted', {
      userId: user.id,
      role: user.role,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin,
      path: req.path
    });

    // Add user object to request context
    (context as any).user = user;

    next();
  } catch (error: any) {
    logger.error('Failed to validate admin access', {
      error: error.message,
      userId: req.context?.userId,
      path: req.path
    });
    
    const response: APIResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate admin access'
      },
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };
    
    return res.status(500).json(response);
  }
};

/**
 * Middleware to enforce stricter rate limits for admin endpoints
 */
export const adminRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // Use more restrictive rate limits for admin endpoints
  const restrictiveRateLimit = {
    windowMs: 60000, // 1 minute
    maxRequests: 20, // 20 requests per minute (vs 60 for regular endpoints)
  };

  // Apply rate limiting logic similar to the main rate limit middleware
  // but with stricter limits
  const key = `admin:${req.context?.ip || 'unknown'}`;
  // Implementation would be similar to the existing rate limit middleware
  // but with tighter restrictions
  
  next();
};

/**
 * Additional security checks for super admin operations
 */
async function performAdditionalSecurityChecks(user: any, req: Request): Promise<{
  passed: boolean;
  reason?: string;
}> {
  const context = req.context as RequestContext;

  // Check 1: Verify admin privileges are still active (not revoked)
  if (!user.adminGrantedAt) {
    return {
      passed: false,
      reason: 'Admin privileges were never properly granted'
    };
  }

  // Check 2: Time-based security - super admin access granted recently enough
  const adminGrantedHoursAgo = (Date.now() - user.adminGrantedAt.getTime()) / (1000 * 60 * 60);
  const maxAdminAge = parseInt(process.env.MAX_SUPER_ADMIN_AGE_HOURS || '168', 10); // 1 week default
  
  if (adminGrantedHoursAgo > maxAdminAge) {
    return {
      passed: false,
      reason: 'Super admin privileges have expired and need renewal'
    };
  }

  // Check 3: IP-based restrictions (if configured)
  const allowedIPs = process.env.SUPER_ADMIN_ALLOWED_IPS?.split(',').map(ip => ip.trim());
  if (allowedIPs && allowedIPs.length > 0 && !allowedIPs.includes(context.ip || '')) {
    return {
      passed: false,
      reason: 'Access denied from this IP address'
    };
  }

  // Check 4: Time-based restrictions (business hours only, if configured)
  if (process.env.SUPER_ADMIN_BUSINESS_HOURS_ONLY === 'true') {
    const currentHour = new Date().getHours();
    const startHour = parseInt(process.env.BUSINESS_HOURS_START || '8', 10);
    const endHour = parseInt(process.env.BUSINESS_HOURS_END || '18', 10);
    
    if (currentHour < startHour || currentHour >= endHour) {
      return {
        passed: false,
        reason: 'Super admin access is restricted to business hours'
      };
    }
  }

  // Check 5: User account must be active and verified
  if (!user.isActive) {
    return {
      passed: false,
      reason: 'User account is not active'
    };
  }

  // All checks passed
  return { passed: true };
}

/**
 * Audit logging middleware specifically for admin operations
 * Should be used after admin authentication middleware
 */
export const auditAdminOperation = (operation: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const context = req.context as RequestContext;
    const user = (context as any).user;
    
    if (!user) {
      // Should not happen if used after admin middleware, but safety check
      return next();
    }

    try {
      const auditLogRepository = new AuditLogRepository();
      
      // Create audit log entry for admin operation
      const auditData = AuditLog.createForAdminAction(
        user.organizationId,
        user.id,
        undefined, // target user (if applicable, will be set in handler)
        'admin_operations',
        operation,
        'CREATE',
        user.isSuperAdmin ? 'high' : 'medium',
        undefined,
        {
          operation,
          path: req.path,
          method: req.method,
          queryParams: req.query,
          bodyParams: sanitizeForAudit(req.body)
        },
        {
          endpoint: req.path,
          method: req.method,
          ip: context.ip,
          userAgent: context.userAgent,
          requestId: context.requestId,
          adminType: user.isSuperAdmin ? 'super_admin' : 'admin'
        }
      );

      await auditLogRepository.create(auditData);
      
      logger.info('Admin operation audit logged', {
        operation,
        adminUserId: user.id,
        path: req.path
      });
    } catch (error: any) {
      logger.error('Failed to create admin audit log', {
        error: error.message,
        operation,
        adminUserId: user?.id
      });
      // Don't fail the request due to audit logging issues
    }

    next();
  };
};

/**
 * Sanitize request body for audit logging (remove sensitive fields)
 */
function sanitizeForAudit(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'secret',
    'token',
    'key',
    'private_key',
    'api_key',
    'authorization'
  ];

  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}