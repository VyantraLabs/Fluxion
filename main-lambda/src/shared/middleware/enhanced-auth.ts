import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Logger } from '@/shared/utils/logger';
import { APIResponse, RequestContext, TenantContext } from '@/types/common';
import { JWTPayload } from '@/types/user';
import { RBACService } from '@/shared/services/rbac.service';
import { getDatabase } from '@/shared/database/client';
import { getBlockchainService } from '@/shared/blockchain/client';

const logger = new Logger('EnhancedAuthMiddleware');

export interface AuthContext {
  userId: string;
  walletAddress: string;
  tenantId: string;
  permissions: string[];
  roles: string[];
  isSystemAdmin: boolean;
  canCrossOrganizations: boolean;
  authMethod: 'jwt' | 'signature' | 'api_key' | 'development';
}

export interface PermissionRequirement {
  permissions: string | string[];
  requireAll?: boolean;
  allowSystemOverride?: boolean;
  organizationSpecific?: boolean;
}

/**
 * Enhanced JWT authentication with fallback mechanisms
 */
export const enhancedAuth = (options: {
  optional?: boolean;
  skipSignatureValidation?: boolean;
  developmentMode?: boolean;
} = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const authResult = await attemptAuthentication(req, options);
      
      if (!authResult && !options.optional) {
        return sendUnauthorizedResponse(res, req, 'Authentication required');
      }

      if (authResult) {
        // Attach auth context to request
        req.auth = authResult;
        
        // Update request context with auth info
        if (req.context) {
          (req.context as RequestContext).userId = authResult.userId;
          (req.context as RequestContext).walletAddress = authResult.walletAddress;
          (req.context as RequestContext).tenantId = authResult.tenantId;
        }

        logger.info('Authentication successful', {
          userId: authResult.userId,
          authMethod: authResult.authMethod,
          duration: `${Date.now() - startTime}ms`,
          permissions: authResult.permissions.length,
          isSystemAdmin: authResult.isSystemAdmin
        });
      }

      next();
    } catch (error: any) {
      logger.error('Authentication failed', {
        error: error.message,
        method: req.method,
        path: req.path,
        duration: `${Date.now() - startTime}ms`
      });

      if (options.optional) {
        next();
      } else {
        sendUnauthorizedResponse(res, req, 'Authentication failed');
      }
    }
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermissions = (requirement: PermissionRequirement) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return sendForbiddenResponse(res, req, 'Authentication required for this operation');
    }

    const { permissions: requiredPermissions, requireAll = false, allowSystemOverride = true } = requirement;
    const permissionList = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

    try {
      const rbacService = new RBACService(getDatabase());
      const organizationId = requirement.organizationSpecific ? req.auth.tenantId : undefined;

      const hasPermission = await rbacService.hasPermission(
        req.auth.userId,
        permissionList,
        {
          requireAll,
          organizationId,
          allowSystemOverride
        }
      );

      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId: req.auth.userId,
          requiredPermissions: permissionList,
          userPermissions: req.auth.permissions.slice(0, 10), // Log first 10
          organizationId,
          path: req.path
        });

        return sendForbiddenResponse(
          res, 
          req, 
          `Insufficient permissions. Required: ${permissionList.join(', ')}`
        );
      }

      logger.debug('Permission granted', {
        userId: req.auth.userId,
        requiredPermissions: permissionList,
        organizationId
      });

      next();
    } catch (error: any) {
      logger.error('Permission check failed', {
        error: error.message,
        userId: req.auth.userId,
        requiredPermissions: permissionList
      });

      return sendErrorResponse(res, req, 'Permission check failed', 500);
    }
  };
};

/**
 * Role-based authorization middleware
 */
export const requireRoles = (roles: string | string[], options: {
  requireAll?: boolean;
  organizationSpecific?: boolean;
} = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return sendForbiddenResponse(res, req, 'Authentication required for this operation');
    }

    const roleList = Array.isArray(roles) ? roles : [roles];
    const { requireAll = false, organizationSpecific = true } = options;

    try {
      const rbacService = new RBACService(getDatabase());
      const organizationId = organizationSpecific ? req.auth.tenantId : undefined;
      const userRoles = await rbacService.getUserRoles(req.auth.userId, organizationId);
      
      const userRoleKeys = userRoles.map(ur => ur.role.key);
      
      const hasRole = requireAll
        ? roleList.every(role => userRoleKeys.includes(role))
        : roleList.some(role => userRoleKeys.includes(role));

      if (!hasRole && !req.auth.isSystemAdmin) {
        logger.warn('Role requirement not met', {
          userId: req.auth.userId,
          requiredRoles: roleList,
          userRoles: userRoleKeys,
          organizationId
        });

        return sendForbiddenResponse(
          res,
          req,
          `Insufficient role privileges. Required: ${roleList.join(', ')}`
        );
      }

      next();
    } catch (error: any) {
      logger.error('Role check failed', {
        error: error.message,
        userId: req.auth.userId,
        requiredRoles: roleList
      });

      return sendErrorResponse(res, req, 'Role check failed', 500);
    }
  };
};

/**
 * System admin only middleware
 */
export const requireSystemAdmin = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return sendForbiddenResponse(res, req, 'Authentication required');
    }

    if (!req.auth.isSystemAdmin) {
      logger.warn('System admin access denied', {
        userId: req.auth.userId,
        path: req.path
      });

      return sendForbiddenResponse(res, req, 'System administrator privileges required');
    }

    next();
  };
};

/**
 * Cross-organization access middleware
 */
export const requireCrossOrgAccess = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return sendForbiddenResponse(res, req, 'Authentication required');
    }

    if (!req.auth.canCrossOrganizations) {
      logger.warn('Cross-organization access denied', {
        userId: req.auth.userId,
        path: req.path
      });

      return sendForbiddenResponse(res, req, 'Cross-organization access not permitted');
    }

    next();
  };
};

/**
 * Attempt authentication using multiple methods with fallbacks
 */
async function attemptAuthentication(
  req: Request, 
  options: { optional?: boolean; skipSignatureValidation?: boolean; developmentMode?: boolean }
): Promise<AuthContext | null> {
  // Method 1: JWT Token Authentication (primary)
  try {
    const jwtAuth = await authenticateJWT(req);
    if (jwtAuth) {
      return jwtAuth;
    }
  } catch (error: any) {
    logger.debug('JWT authentication failed, trying fallbacks', { error: error.message });
  }

  // Method 2: API Key Authentication (for integrations)
  try {
    const apiKeyAuth = await authenticateAPIKey(req);
    if (apiKeyAuth) {
      return apiKeyAuth;
    }
  } catch (error: any) {
    logger.debug('API key authentication failed', { error: error.message });
  }

  // Method 3: Development Mode (skip authentication in development)
  if (options.developmentMode && process.env.NODE_ENV === 'development') {
    logger.warn('Using development authentication bypass');
    return createDevelopmentAuthContext();
  }

  // Method 4: Wallet Signature (fallback for failed JWT)
  if (!options.skipSignatureValidation) {
    try {
      const signatureAuth = await authenticateWalletSignature(req);
      if (signatureAuth) {
        return signatureAuth;
      }
    } catch (error: any) {
      logger.debug('Wallet signature authentication failed', { error: error.message });
    }
  }

  return null;
}

/**
 * JWT token authentication
 */
async function authenticateJWT(req: Request): Promise<AuthContext | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
  
  if (!decoded.user_id || !decoded.wallet_address) {
    throw new Error('Invalid JWT payload');
  }

  // Get user permissions and sync roles
  const rbacService = new RBACService(getDatabase());
  const userPermissions = await rbacService.getUserPermissions(decoded.user_id, decoded.tenant_id);

  if (!userPermissions) {
    throw new Error('User permissions not found');
  }

  // Synchronize RBAC roles back to legacy User.role field for compatibility
  if (decoded.tenant_id) {
    try {
      await rbacService.syncUserLegacyRole(decoded.user_id, decoded.tenant_id);
    } catch (syncError: any) {
      logger.warn('Failed to sync legacy role', { 
        userId: decoded.user_id, 
        tenantId: decoded.tenant_id,
        error: syncError.message 
      });
      // Don't fail auth for sync errors
    }
  }

  // Get the actual user record to include legacy role information
  const { UserRepository } = await import('@/database/repositories/UserRepository');
  const userRepo = new UserRepository();
  const user = await userRepo.findById(decoded.user_id);
  
  if (!user) {
    throw new Error('User not found');
  }

  return {
    userId: decoded.user_id,
    walletAddress: decoded.wallet_address,
    tenantId: decoded.tenant_id || '01HBXYZ0000000000000000000',
    permissions: userPermissions.permissions,
    roles: userPermissions.roles.map(r => r.role.key),
    isSystemAdmin: userPermissions.isSystemAdmin || user.isSystemAdmin,
    canCrossOrganizations: userPermissions.canCrossOrganizations,
    authMethod: 'jwt'
  };
}

/**
 * API key authentication (placeholder for future implementation)
 */
async function authenticateAPIKey(_req: Request): Promise<AuthContext | null> {
  // TODO: Implement API key authentication for integrations
  return null;
}

/**
 * Wallet signature authentication (fallback)
 */
async function authenticateWalletSignature(_req: Request): Promise<AuthContext | null> {
  // TODO: Implement wallet signature verification fallback
  // This would require the client to send signature data in headers
  return null;
}

/**
 * Development mode authentication bypass
 */
function createDevelopmentAuthContext(): AuthContext {
  return {
    userId: 'dev-user-id',
    walletAddress: '0x0000000000000000000000000000000000000000',
    tenantId: '01HBXYZ0000000000000000000000',
    permissions: ['*'],
    roles: ['super_admin'],
    isSystemAdmin: true,
    canCrossOrganizations: true,
    authMethod: 'development'
  };
}

/**
 * Response helper functions
 */
function sendUnauthorizedResponse(res: Response, req: Request, message: string): void {
  const response: APIResponse = {
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message
    },
    meta: {
      requestId: req.context?.requestId || 'unknown',
      timestamp: new Date().toISOString()
    }
  };

  res.status(401).json(response);
}

function sendForbiddenResponse(res: Response, req: Request, message: string): void {
  const response: APIResponse = {
    success: false,
    error: {
      code: 'FORBIDDEN',
      message
    },
    meta: {
      requestId: req.context?.requestId || 'unknown',
      timestamp: new Date().toISOString()
    }
  };

  res.status(403).json(response);
}

function sendErrorResponse(res: Response, req: Request, message: string, statusCode: number): void {
  const response: APIResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message
    },
    meta: {
      requestId: req.context?.requestId || 'unknown',
      timestamp: new Date().toISOString()
    }
  };

  res.status(statusCode).json(response);
}

// Extend Express Request types
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      tenant?: TenantContext;
    }
  }
}