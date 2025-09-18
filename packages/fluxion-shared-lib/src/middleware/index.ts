import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Logger } from '../utils/logger';

// Re-export auth middleware
export { authenticateJWT, optionalAuth, generateJWT, AuthJWTPayload } from '../auth/index';

const logger = new Logger('Middleware');

/**
 * Request logging and context middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Attach request context
  req.context = {
    requestId,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress || 'unknown'
  };
  
  res.locals.requestId = requestId;

  // Skip logging for routine requests
  const shouldSkipLogging = req.path === '/health' || 
                           req.path === '/api-docs' ||
                           req.path.startsWith('/api-docs/');
  
  if (!shouldSkipLogging) {
    logger.info('Request started', {
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.context.userAgent,
      ip: req.context.ip
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
}

/**
 * CORS middleware configuration
 */
export function createCorsMiddleware(allowedOrigins?: string[]) {
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:8080', // nginx gateway
    'https://fluxion.pay',
    'https://admin.fluxion.pay'
  ];

  const origins = allowedOrigins || defaultOrigins;

  return cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      if (origins.includes(origin)) {
        return callback(null, true);
      }
      
      logger.warn('CORS: Origin not allowed', { origin });
      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Request-ID',
      'X-Request-Timestamp',
      'X-Client-Type',
      'X-Client-Version',
      'X-Request-Source',
      'X-Service',
      'X-Service-Target',
      'X-Tenant-ID'
    ],
    credentials: true,
    maxAge: 86400,
    optionsSuccessStatus: 200
  });
}

/**
 * Security headers middleware
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  });
}

/**
 * Error handler middleware
 */
export function errorHandler(error: any, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.context?.requestId || 'unknown';
  
  logger.error('Request error', {
    error: error.message,
    path: req.path,
    method: req.method,
    requestId
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * 404 handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.context?.requestId || 'unknown';
  
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Async error handler wrapper
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Response helpers middleware - adds helper methods to response object
 */
export function responseHelpers(req: Request, res: Response, next: NextFunction): void {
  // Add success response helper
  res.success = function(data?: any, statusCode: number = 200) {
    return this.status(statusCode).json({
      success: true,
      data,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    });
  };

  // Add error response helper
  res.error = function(code: string, message: string, statusCode: number = 400, details?: any) {
    return this.status(statusCode).json({
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
    });
  };

  next();
}

/**
 * CORS handler (default configuration)
 */
export const corsHandler = createCorsMiddleware();

/**
 * Rate limiting middleware
 */
export function rateLimit(options: { windowMs: number; maxRequests: number; skipSuccessfulRequests?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - options.windowMs;
    
    // Clean old entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < windowStart) {
        rateLimitStore.delete(k);
      }
    }
    
    const current = rateLimitStore.get(key) || { count: 0, resetTime: now + options.windowMs };
    
    if (current.resetTime < now) {
      current.count = 0;
      current.resetTime = now + options.windowMs;
    }
    
    current.count++;
    rateLimitStore.set(key, current);
    
    if (current.count > options.maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
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
 * Validation middleware
 */
export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      next();
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors || error.message
        },
        meta: {
          requestId: req.context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

// Rate limiting store (in-memory)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Import types that are used but not defined
import jwt from 'jsonwebtoken';
import { FluxionError, ErrorCodes, TenantContext } from '../types/common';

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
      let tenantId: string = '01HBXYZ0000000000000000000'; // Default tenant ULID
      let userId: string | undefined;
      let walletAddress: string | undefined;

      // Try to extract from request context first (if already authenticated)
      if (req.context?.tenantId) {
        tenantId = req.context.tenantId;
        userId = req.context.userId;
        walletAddress = req.context.walletAddress;
      } else {
        // Fallback: Try to extract from JWT token directly
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const token = authHeader.substring(7);
            const decoded = jwt.decode(token) as any;
            
            if (decoded) {
              tenantId = decoded.tenant_id || '01HBXYZ0000000000000000000';
              userId = decoded.user_id;
              walletAddress = decoded.wallet_address;
            }
          } catch (error) {
            logger.debug('Failed to decode JWT for tenant context', { error });
          }
        }
      }

      // Allow override via header
      const tenantHeader = req.headers['x-tenant-id'] as string;
      if (tenantHeader && typeof tenantHeader === 'string') {
        tenantId = tenantHeader;
      }

      // Set tenant context on request
      (req as any).tenant = {
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
      next(error);
    }
  };
};

/**
 * Get tenant context from request
 * Utility function to safely extract tenant context
 */
export const getTenantContext = (req: Request): TenantContext => {
  const tenant = (req as any).tenant;
  if (!tenant) {
    throw new Error('Tenant context not available');
  }
  return tenant;
};

/**
 * Require tenant context middleware
 */
export const requireTenantContext = () => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!(req as any).tenant) {
      logger.error('Tenant context not available on request');
      return next(new Error('Tenant context not initialized'));
    }
    next();
  };
};