import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { Logger } from '@/shared/utils/logger';
import { isFluxionError } from '@/shared/errors';
import { APIResponse, RequestContext } from '@/types/common';
import { JWTPayload } from '@/types/user';

const logger = new Logger('Middleware');

// Rate limiting store (in-memory for Lambda)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Set request ID in environment for logger
  process.env.AWS_REQUEST_ID = requestId;
  
  // Attach request context
  const context: RequestContext = {
    requestId,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION
  };
  
  req.context = context;

  // Skip logging for routine requests to reduce noise
  const shouldSkipLogging = req.path === '/health' || 
                           req.path === '/api-docs' ||
                           req.path.startsWith('/api-docs/');
  
  if (!shouldSkipLogging) {
    logger.info('Request started', {
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: (req.context as RequestContext).userAgent,
      ip: (req.context as RequestContext).ip
    });
  }

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (!shouldSkipLogging) {
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    }
  });

  next();
};

/**
 * CORS middleware
 */
export const corsHandler = (req: Request, res: Response, next: NextFunction) => {
  const allowedOrigins = [
    'https://fluxion.pay',
    'https://app.fluxion.pay',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003', // Admin frontend
    'http://localhost:3004', // Normal frontend
    'http://localhost:3005'  // Backend API
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-ID, X-Request-Timestamp, X-Client-Version, X-Request-Source, X-Tenant-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
};

/**
 * Rate limiting middleware
 */
export const rateLimit = (options: {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req.context as RequestContext)?.ip || 'unknown';
    const now = Date.now();

    // Clean up expired entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }

    let record = rateLimitStore.get(key);
    if (!record || record.resetTime < now) {
      record = { count: 0, resetTime: now + options.windowMs };
      rateLimitStore.set(key, record);
    }

    record.count++;

    if (record.count > options.maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip: key,
        count: record.count,
        maxRequests: options.maxRequests
      });

      const response: APIResponse = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        },
        meta: {
          requestId: req.context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };

      res.status(429).json(response);
      return;
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', record.resetTime);

    next();
  };
};

/**
 * JWT authentication middleware with comprehensive debugging
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.context?.requestId || 'unknown';
  const method = req.method;
  const path = req.path;
  
  logger.debug('JWT Authentication started', {
    requestId,
    method,
    path,
    hasAuthHeader: !!req.headers.authorization,
    authHeaderLength: req.headers.authorization?.length || 0
  });
  
  // Step 1: Extract Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    logger.warn('JWT Authentication failed: Missing Authorization header', {
      requestId,
      method,
      path,
      headers: Object.keys(req.headers)
    });
    
    const response: APIResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required'
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString()
      }
    };

    res.status(401).json(response);
    return;
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('JWT Authentication failed: Invalid Authorization header format', {
      requestId,
      method,
      path,
      authHeaderStart: authHeader.substring(0, 20),
      expectedFormat: 'Bearer <token>'
    });
    
    const response: APIResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authorization header format. Expected "Bearer <token>"'
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString()
      }
    };

    res.status(401).json(response);
    return;
  }

  // Step 2: Extract token
  const token = authHeader.substring(7);
  
  logger.debug('JWT token extracted', {
    requestId,
    tokenLength: token.length,
    tokenStart: token.substring(0, 10) + '...',
    tokenEnd: '...' + token.substring(token.length - 10)
  });
  
  // Step 3: Check JWT secret
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    logger.error('JWT Authentication failed: JWT_SECRET not configured', {
      requestId,
      method,
      path,
      nodeEnv: process.env.NODE_ENV,
      hasJwtSecret: false
    });
    
    const response: APIResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication system not properly configured'
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString()
      }
    };

    res.status(500).json(response);
    return;
  }
  
  logger.debug('JWT secret available', {
    requestId,
    secretLength: jwtSecret.length,
    hasSecret: true
  });

  // Step 4: Verify and decode JWT token
  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    logger.debug('JWT token decoded successfully', {
      requestId,
      userId: decoded.user_id,
      walletAddress: decoded.wallet_address,
      tenantId: decoded.tenant_id,
      role: decoded.role,
      isAdmin: decoded.is_admin,
      isSuperAdmin: decoded.is_super_admin,
      isSystemUser: decoded.is_system_user,
      systemRoles: decoded.system_roles,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp,
      currentTime: Math.floor(Date.now() / 1000)
    });
    
    // Step 5: Validate token fields
    if (!decoded.user_id) {
      logger.warn('JWT Authentication failed: Missing user_id in token', {
        requestId,
        decodedKeys: Object.keys(decoded)
      });
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token: missing user information'
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.status(401).json(response);
      return;
    }
    
    if (!decoded.wallet_address) {
      logger.warn('JWT Authentication failed: Missing wallet_address in token', {
        requestId,
        userId: decoded.user_id,
        decodedKeys: Object.keys(decoded)
      });
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token: missing wallet information'
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.status(401).json(response);
      return;
    }
    
    // Step 6: Add user info to request context
    if (!req.context) {
      logger.warn('Request context not initialized', { requestId });
      req.context = {
        requestId,
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress || 'unknown'
      };
    }
    
    // Set user context
    (req.context as RequestContext).userId = decoded.user_id;
    (req.context as RequestContext).walletAddress = decoded.wallet_address;
    (req.context as RequestContext).tenantId = decoded.tenant_id;
    (req.context as RequestContext).userRole = decoded.role;
    (req.context as RequestContext).isAdmin = decoded.is_admin || false;
    (req.context as RequestContext).isSuperAdmin = decoded.is_super_admin || false;
    (req.context as RequestContext).isSystemUser = decoded.is_system_user || false;
    (req.context as RequestContext).systemRoles = decoded.system_roles || [];

    // Store JWT payload for system role middleware
    (req as any).user = decoded;

    logger.info('JWT Authentication successful', {
      requestId,
      method,
      path,
      userId: decoded.user_id,
      walletAddress: decoded.wallet_address,
      tenantId: decoded.tenant_id,
      role: decoded.role,
      isAdmin: decoded.is_admin || false,
      contextSet: true
    });

    next();
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'Unknown';
    
    logger.warn('JWT Authentication failed: Token verification error', {
      requestId,
      method,
      path,
      error: errorMessage,
      errorName,
      tokenLength: token.length,
      secretLength: jwtSecret.length
    });
    
    // Determine specific error type
    let responseMessage = 'Invalid or expired authentication token';
    
    if (errorName === 'TokenExpiredError') {
      responseMessage = 'Authentication token has expired. Please login again.';
    } else if (errorName === 'JsonWebTokenError') {
      responseMessage = 'Invalid authentication token format.';
    } else if (errorName === 'NotBeforeError') {
      responseMessage = 'Authentication token not active yet.';
    }
    
    const response: APIResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: responseMessage
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString()
      }
    };

    res.status(401).json(response);
  }
};

/**
 * Optional JWT authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    if (req.context) {
      (req.context as RequestContext).userId = decoded.user_id; // Use UUID user ID
      (req.context as RequestContext).walletAddress = decoded.wallet_address; // Use wallet address
      (req.context as RequestContext).tenantId = decoded.tenant_id; // Add tenant ID
    }

    logger.debug('Optional auth successful', { 
      wallet_address: decoded.wallet_address 
    });
  } catch (error) {
    logger.debug('Optional auth failed, continuing without auth', { 
      error: error instanceof Error ? error.message : error 
    });
  }

  next();
};

/**
 * Global error handler with comprehensive authentication error support
 */
export const errorHandler = (error: any, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.context?.requestId || 'unknown';
  
  // Log errors appropriately based on severity
  if (isFluxionError(error)) {
    if (error.statusCode >= 500) {
      // Server errors - log with full stack trace
      logger.error('Server error', { 
        error: error.message,
        error_code: error.code,
        stack: error.stack,
        path: req.path,
        method: req.method,
        request_id: requestId
      });
    } else if (error.statusCode === 401 || error.statusCode === 403) {
      // Security errors - log but without stack trace
      logger.warn('Security error', { 
        error: error.message,
        error_code: error.code,
        path: req.path,
        method: req.method,
        ip: req.context?.ip,
        user_agent: req.context?.userAgent,
        request_id: requestId
      });
    } else {
      // Client errors - minimal logging
      logger.info('Client error', { 
        error: error.message,
        error_code: error.code,
        path: req.path,
        method: req.method,
        request_id: requestId
      });
    }
  } else {
    // Unknown errors - log with full details
    logger.error('Unhandled error', { 
      error: error.message,
      error_name: error.name,
      stack: error.stack,
      path: req.path,
      method: req.method,
      request_id: requestId
    });
  }

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details: any = undefined;

  if (isFluxionError(error)) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
    
    // Sanitize error messages for client consumption
    if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
      message = 'Internal server error';
      details = undefined; // Don't expose internal details in production
    }
  } else if (error instanceof ZodError) {
    statusCode = 422; // Use 422 for validation errors instead of 400
    errorCode = 'VALIDATION_ERROR';
    message = 'Invalid request data';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));
  } else if (error instanceof SyntaxError && 'body' in error) {
    // JSON parsing errors
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  } else if (error instanceof Error) {
    // Generic errors
    if (process.env.NODE_ENV === 'production') {
      message = 'An unexpected error occurred';
    } else {
      message = error.message;
    }
  }

  const response: APIResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV !== 'production' && error.stack && { 
        stack: error.stack.split('\n').slice(0, 10) // Limit stack trace in development
      })
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV !== 'production' && {
        path: req.path,
        method: req.method
      })
    }
  };

  // Security headers for authentication errors
  if (statusCode === 401) {
    res.setHeader('WWW-Authenticate', 'Bearer');
  }

  res.status(statusCode).json(response);
};

/**
 * 404 handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route not found', { 
    path: req.path, 
    method: req.method 
  });

  const response: APIResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    },
    meta: {
      requestId: req.context?.requestId || 'unknown',
      timestamp: new Date().toISOString()
    }
  };

  res.status(404).json(response);
};

/**
 * Validation middleware factory
 */
export const validateRequest = (schemas: {
  body?: any;
  params?: any;
  query?: any;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body && req.body) {
        req.body = schemas.body.parse(req.body);
      }
      
      if (schemas.params && req.params) {
        req.params = schemas.params.parse(req.params);
      }
      
      if (schemas.query && req.query) {
        // Convert query string values to appropriate types
        const processedQuery: any = {};
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            processedQuery[key] = value;
          } else if (Array.isArray(value)) {
            processedQuery[key] = value;
          }
        }
        req.query = schemas.query.parse(processedQuery);
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        const response: APIResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: formattedErrors
          },
          meta: {
            requestId: req.context?.requestId || 'unknown',
            timestamp: new Date().toISOString()
          }
        };
        
        res.status(400).json(response);
        return;
      }
      
      next(error);
    }
  };
};

/**
 * Async error handler wrapper
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Response helper middleware
 */
export const responseHelpers = (req: Request, res: Response, next: NextFunction) => {
  // Success response helper
  res.success = (data: any, statusCode: number = 200) => {
    const response: APIResponse = {
      success: true,
      data,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(statusCode).json(response);
  };

  // Error response helper
  res.error = (code: string, message: string, statusCode: number = 400, details?: any) => {
    const response: APIResponse = {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(statusCode).json(response);
  };

  next();
};

/**
 * Cache response middleware (simplified in-memory cache for Lambda)
 * In production, this would use Redis or CloudFront
 */
const responseCache = new Map<string, { data: any; expires: number }>();

export const cacheResponse = (ttlSeconds: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Generate cache key based on URL and query params
    const cacheKey = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
    
    // Check if we have cached response
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      logger.debug('Serving cached response', { cacheKey });
      
      // Add cache headers
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      
      return res.json(cached.data);
    }

    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to cache response
    res.json = function(data: any) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        responseCache.set(cacheKey, {
          data,
          expires: Date.now() + (ttlSeconds * 1000)
        });
        
        // Add cache headers
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
        
        logger.debug('Cached response', { cacheKey, ttlSeconds });
      }
      
      return originalJson(data);
    };

    next();
  };
};

/**
 * Admin-only middleware
 */
export const adminOnly = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is authenticated first
    if (!req.context?.userId) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for admin access'
        },
        meta: {
          requestId: req.context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      res.status(401).json(response);
      return;
    }

    // Check admin privileges from JWT token first (faster and more reliable)
    const context = req.context as RequestContext & { isAdmin?: boolean; isSuperAdmin?: boolean };
    const hasAdminFromJWT = context?.isAdmin === true || context?.isSuperAdmin === true;
    
    logger.debug('Admin access check via JWT', {
      userId: req.context.userId,
      path: req.path,
      isAdmin: context?.isAdmin,
      isSuperAdmin: context?.isSuperAdmin,
      hasAdminFromJWT
    });

    if (hasAdminFromJWT) {
      logger.info('Admin access granted via JWT token', {
        userId: req.context.userId,
        path: req.path,
        isAdmin: context?.isAdmin,
        isSuperAdmin: context?.isSuperAdmin
      });
      next();
      return;
    }
    
    // Fallback to RBAC system for backward compatibility
    logger.debug('JWT admin check failed, falling back to RBAC validation', {
      userId: req.context.userId,
      path: req.path
    });

    // Import admin service to validate admin access
    const { AdminService } = await import('@/modules/admin/service');
    const adminService = new AdminService();
    
    // Get tenant context
    const { getTenantContext } = await import('@/shared/middleware/tenant');
    const tenantContext = getTenantContext(req);
    
    const isAdminViaRBAC = await adminService.validateAdminAccess(tenantContext);
    
    if (!isAdminViaRBAC) {
      logger.warn('Non-admin user attempted to access admin endpoint', {
        userId: req.context.userId,
        path: req.path,
        jwt_isAdmin: context?.isAdmin,
        jwt_isSuperAdmin: context?.isSuperAdmin,
        rbac_result: false
      });
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin privileges required for this operation'
        },
        meta: {
          requestId: req.context.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      res.status(403).json(response);
      return;
    }

    logger.info('Admin access granted via RBAC', {
      userId: req.context.userId,
      path: req.path
    });

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
    
    res.status(500).json(response);
  }
};

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (value.expires <= now) {
      responseCache.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Export system role middleware
export { 
  requireSystemRole, 
  requireSystemSuperAdmin, 
  requireSystemAdmin, 
  requireSystemUser, 
  rejectOrganizationAdmins 
} from './system-role';

// Extend Express Response types
declare global {
  namespace Express {
    interface Response {
      success: (data: any, statusCode?: number) => void;
      error: (code: string, message: string, statusCode?: number, details?: any) => void;
    }
  }
}