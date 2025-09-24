/**
 * Simple JWT Authentication Middleware
 * 
 * Provides basic JWT authentication that services can use.
 * Services configure their own public paths and behavior.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Logger } from '../utils/logger';

const logger = new Logger('SimpleAuth');

export interface SimpleAuthOptions {
  /** JWT secret for token verification */
  secret?: string;
  /** Paths that don't require authentication */
  publicPaths?: string[];
  /** Whether to skip authentication in development */
  skipInDevelopment?: boolean;
}

export interface SimpleAuthContext {
  userId: string;
  walletAddress: string;
  organizationId?: string;
  organizationName?: string;
  roles?: string[];
  permissions?: string[];
  isSystemAdmin?: boolean;
}

/**
 * Create simple JWT authentication middleware
 */
export function createJWTAuth(options: SimpleAuthOptions = {}) {
  const {
    secret = process.env.JWT_SECRET,
    publicPaths = [],
    skipInDevelopment = false
  } = options;

  if (!secret) {
    throw new Error('JWT_SECRET is required for authentication');
  }

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if path is public
      if (isPublicPath(req.path, publicPaths)) {
        return next();
      }

      // Skip auth in development if configured
      if (skipInDevelopment && process.env.NODE_ENV === 'development') {
        (req as any).simpleAuth = createDevelopmentAuth();
        return next();
      }

      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication token required'
          }
        });
      }

      const token = authHeader.substring(7);
      
      // Verify JWT token
      const decoded = jwt.verify(token, secret) as any;
      
      if (!decoded.user_id || !decoded.wallet_address) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid token payload'
          }
        });
      }

      // Attach auth context to request
      (req as any).simpleAuth = {
        userId: decoded.user_id,
        walletAddress: decoded.wallet_address,
        organizationId: decoded.organization_id,
        organizationName: decoded.organization_name,
        roles: decoded.roles || [],
        permissions: decoded.permissions || [],
        isSystemAdmin: decoded.isSystemAdmin || false
      };

      next();

    } catch (error: any) {
      logger.debug('Authentication failed', {
        error: error.message,
        path: req.path,
        method: req.method
      });

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired'
          }
        });
      }

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        }
      });
    }
  };
}

/**
 * Create development authentication context
 */
function createDevelopmentAuth(): SimpleAuthContext {
  return {
    userId: 'dev-user-123',
    walletAddress: '0x0000000000000000000000000000000000000000',
    organizationId: 'dev-org-123',
    organizationName: 'Development Organization',
    roles: ['admin'],
    permissions: ['*'],
    isSystemAdmin: true
  };
}

/**
 * Check if a path is in the public paths list
 */
function isPublicPath(path: string, publicPaths: string[]): boolean {
  return publicPaths.some(publicPath => {
    // Support wildcard patterns
    if (publicPath.includes('*')) {
      const pattern = publicPath.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(path);
    }
    
    // Exact match or prefix match
    return path === publicPath || path.startsWith(publicPath);
  });
}

/**
 * Middleware to require specific roles
 */
export function requireRoles(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).simpleAuth as SimpleAuthContext;
    if (!auth) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const userRoles = auth.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole && !auth.isSystemAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of the following roles: ${roles.join(', ')}`
        }
      });
    }

    next();
  };
}

/**
 * Middleware to require system admin
 */
export function requireSystemAdmin() {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).simpleAuth as SimpleAuthContext;
    if (!auth || !auth.isSystemAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'System administrator privileges required'
        }
      });
    }
    next();
  };
}

