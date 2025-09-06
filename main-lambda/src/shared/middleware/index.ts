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
    'http://localhost:3003'
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
 * JWT authentication middleware
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const response: APIResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required'
      },
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    res.status(401).json(response);
    return;
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    logger.error('JWT_SECRET not configured');
    
    const response: APIResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication system not properly configured'
      },
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    res.status(500).json(response);
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    // Add user info to request context
    if (req.context) {
      (req.context as RequestContext).userId = decoded.user_id; // Always use the UUID user ID
      (req.context as RequestContext).walletAddress = decoded.wallet_address;
      (req.context as RequestContext).tenantId = decoded.tenant_id; // Add tenant ID to context
    }

    logger.info('User authenticated', { 
      wallet_address: decoded.wallet_address 
    });

    next();
  } catch (error) {
    logger.warn('Invalid JWT token', { error: error instanceof Error ? error.message : error });
    
    const response: APIResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired authentication token'
      },
      meta: {
        requestId: req.context?.requestId || 'unknown',
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
 * Global error handler
 */
export const errorHandler = (error: any, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { 
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details: any = undefined;

  if (isFluxionError(error)) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Invalid request data';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));
  } else if (error instanceof Error) {
    message = error.message;
  }

  const response: APIResponse = {
    success: false,
    error: {
      code: errorCode,
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

    // Import admin service to validate admin access
    const { AdminService } = await import('@/modules/admin/service');
    const adminService = new AdminService();
    
    // Get tenant context
    const { getTenantContext } = await import('@/shared/middleware/tenant');
    const tenantContext = getTenantContext(req);
    
    const isAdmin = await adminService.validateAdminAccess(tenantContext);
    
    if (!isAdmin) {
      logger.warn('Non-admin user attempted to access admin endpoint', {
        userId: req.context.userId,
        path: req.path
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

    logger.info('Admin access granted', {
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

// Extend Express Response types
declare global {
  namespace Express {
    interface Response {
      success: (data: any, statusCode?: number) => void;
      error: (code: string, message: string, statusCode?: number, details?: any) => void;
    }
  }
}