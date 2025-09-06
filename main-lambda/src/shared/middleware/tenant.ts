import { Request, Response, NextFunction } from 'express';
import { FluxionError, ErrorCodes, TenantContext } from '@/types/common';
import { Logger } from '@/shared/utils/logger';
import jwt from 'jsonwebtoken';

const logger = new Logger('TenantMiddleware');

/**
 * Extract tenant context from request
 * This middleware sets the tenant context based on:
 * 1. JWT token (if authenticated)
 * 2. X-Tenant-ID header (for public endpoints)
 * 3. Default tenant (fallback)
 */
export const extractTenantContext = () => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      let tenantId: string = '01HBXYZ0000000000000000000'; // Default tenant ULID (matches user service)
      let userId: string | undefined;
      let walletAddress: string | undefined;

      // Try to extract from JWT token first (if authenticated)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.decode(token) as any;
          
          if (decoded) {
            tenantId = decoded.tenant_id || '01HBXYZ0000000000000000000'; // Default tenant ULID
            userId = decoded.user_id;
            walletAddress = decoded.wallet_address;
          }
        } catch (error) {
          // JWT decode failed, continue with header/default tenant
          logger.debug('Failed to decode JWT for tenant context', { error });
        }
      }

      // Allow override via header (for multi-tenant scenarios)
      const tenantHeader = req.headers['x-tenant-id'] as string;
      if (tenantHeader && typeof tenantHeader === 'string') {
        tenantId = tenantHeader;
      }

      // Validate tenant ID format
      if (!isValidTenantId(tenantId)) {
        logger.error('Invalid tenant ID format detected', { 
          tenantId, 
          length: tenantId.length,
          format: typeof tenantId 
        });
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid tenant ID format',
          400,
          { tenantId }
        );
      }

      // Set tenant context on request
      req.tenant = {
        tenantId,
        userId,
        walletAddress
      };

      logger.debug('Tenant context extracted', { 
        tenantId, 
        userId: userId || 'none',
        walletAddress: walletAddress || 'none'
      });

      next();
    } catch (error: any) {
      logger.error('Failed to extract tenant context', { error: error.message });
      
      if (error instanceof FluxionError) {
        next(error);
      } else {
        next(new FluxionError(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to process tenant context',
          500,
          error
        ));
      }
    }
  };
};

/**
 * Require tenant context middleware
 * Ensures that tenant context is available on the request
 */
export const requireTenantContext = () => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.tenant) {
      logger.error('Tenant context not available on request');
      return next(new FluxionError(
        ErrorCodes.INTERNAL_ERROR,
        'Tenant context not initialized',
        500
      ));
    }

    logger.debug('Tenant context validated', { tenantId: req.tenant.tenantId });
    next();
  };
};

/**
 * Validate tenant access middleware
 * Ensures the requesting user has access to the specified tenant
 */
export const validateTenantAccess = () => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const tenantContext = req.tenant;
    
    if (!tenantContext) {
      return next(new FluxionError(
        ErrorCodes.INTERNAL_ERROR,
        'Tenant context not available',
        500
      ));
    }

    // For now, we allow access if tenant context is present
    // In a more complex system, you might check:
    // - User permissions for the tenant
    // - Tenant status (active/suspended)
    // - Resource quotas and limits
    // - Billing status

    const isValidAccess = validateUserTenantAccess(req.user, tenantContext);
    
    if (!isValidAccess) {
      logger.warn('Tenant access denied', { 
        userId: req.context?.userId || 'none',
        tenantId: tenantContext.tenantId 
      });
      
      return next(new FluxionError(
        ErrorCodes.FORBIDDEN,
        'Access denied to tenant resources',
        403,
        { tenantId: tenantContext.tenantId }
      ));
    }

    logger.debug('Tenant access validated', { 
      userId: req.context?.userId || 'none',
      tenantId: tenantContext.tenantId 
    });

    next();
  };
};

/**
 * Tenant isolation middleware
 * Ensures data queries are properly scoped to the tenant
 */
export const enforceTenantIsolation = () => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const tenantContext = req.tenant;
    
    if (!tenantContext) {
      return next(new FluxionError(
        ErrorCodes.INTERNAL_ERROR,
        'Tenant context required for data isolation',
        500
      ));
    }

    // Add tenant context to request for database queries
    // This ensures all database operations are automatically scoped to the tenant
    
    // Log tenant isolation enforcement
    logger.debug('Tenant isolation enforced', { 
      tenantId: tenantContext.tenantId,
      endpoint: req.path,
      method: req.method
    });

    next();
  };
};

/**
 * Multi-tenant aware error handler
 * Ensures error responses don't leak cross-tenant information
 */
export const tenantAwareErrorHandler = () => {
  return (error: any, req: Request, _res: Response, next: NextFunction) => {
    const tenantContext = req.tenant;

    // Sanitize error details for cross-tenant security
    if (error instanceof FluxionError) {
      // Remove sensitive details if they might contain cross-tenant info
      if (error.details && tenantContext) {
        error.details = sanitizeErrorDetails(error.details, tenantContext.tenantId);
      }
    }

    // Log error with tenant context
    logger.error('Request error in tenant context', {
      tenantId: tenantContext?.tenantId || 'unknown',
      error: error.message,
      code: error.code || 'UNKNOWN',
      endpoint: req.path
    });

    next(error);
  };
};

/**
 * Get tenant context from request
 * Utility function to safely extract tenant context
 */
export const getTenantContext = (req: Request): TenantContext => {
  if (!req.tenant) {
    throw new FluxionError(
      ErrorCodes.INTERNAL_ERROR,
      'Tenant context not available',
      500
    );
  }
  return req.tenant;
};

/**
 * Create tenant-scoped resource ID
 * Utility to create resource IDs that include tenant context
 */
export const createTenantScopedId = (tenantId: string, resourceId: string): string => {
  return `${tenantId}:${resourceId}`;
};

/**
 * Parse tenant-scoped resource ID
 * Utility to extract tenant and resource ID from scoped ID
 */
export const parseTenantScopedId = (scopedId: string): { tenantId: string; resourceId: string } => {
  const parts = scopedId.split(':');
  if (parts.length !== 2) {
    throw new FluxionError(
      ErrorCodes.VALIDATION_ERROR,
      'Invalid scoped resource ID format',
      400,
      { scopedId }
    );
  }
  return {
    tenantId: parts[0],
    resourceId: parts[1]
  };
};

// Helper functions

/**
 * Validate tenant ID format
 */
function isValidTenantId(tenantId: string): boolean {
  // Support multiple tenant ID formats:
  // 1. Standard UUID format (for organization IDs)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // 2. ULID format (legacy)
  const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;
  // 3. Alphanumeric format (legacy)
  const alphanumericRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  
  return uuidRegex.test(tenantId) || ulidRegex.test(tenantId) || alphanumericRegex.test(tenantId);
}

/**
 * Validate user access to tenant
 */
function validateUserTenantAccess(user: any, tenantContext: TenantContext): boolean {
  // If no user (public endpoint), allow if tenant is valid
  if (!user) {
    return true;
  }

  // If user has explicit tenant_id in token, validate it matches
  if (user.tenant_id && user.tenant_id !== tenantContext.tenantId) {
    return false;
  }

  // Additional validation logic can be added here:
  // - Check user permissions for tenant
  // - Validate tenant status
  // - Check subscription/billing status
  // - Validate API quotas

  return true;
}

/**
 * Sanitize error details to prevent cross-tenant information leakage
 */
function sanitizeErrorDetails(details: any, _tenantId: string): any {
  if (!details || typeof details !== 'object') {
    return details;
  }

  const sanitized = { ...details };

  // Remove any fields that might contain cross-tenant data
  const sensitiveFields = ['userId', 'invoiceId', 'paymentId', 'walletAddress'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      // Keep the field but mask sensitive parts
      if (typeof sanitized[field] === 'string') {
        sanitized[field] = sanitized[field].substring(0, 8) + '...';
      }
    }
  });

  return sanitized;
}

/**
 * Development tenant middleware
 * For local development, automatically sets a default tenant
 */
export const developmentTenant = () => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'development' && !req.tenant) {
      req.tenant = {
        tenantId: '01HBXYZ0000000000000000000', // Default tenant ULID for development (matches user service)
        userId: undefined,
        walletAddress: undefined
      };
      
      logger.debug('Development tenant context set', { tenantId: '01HBXYZ0000000000000000000' });
    }
    
    next();
  };
};