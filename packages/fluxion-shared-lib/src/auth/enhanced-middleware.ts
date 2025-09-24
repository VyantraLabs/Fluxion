import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { Logger } from '../utils/logger';
import { 
  AuthContext, 
  AuthMiddlewareOptions, 
  ServiceAuthConfig, 
  RouteAuthConfig,
  AuthResult,
  EnhancedJWTPayload,
  AuthAuditEntry,
  PermissionRequirement,
  RoleRequirement
} from './types';
import { AuthMetadataReader } from './decorators';
import { isPublicRoute, getRouteAuthConfig, createMiddlewareOptions } from './auth-config';

const logger = new Logger('EnhancedAuthMiddleware');

/**
 * Enhanced authentication middleware factory
 * Supports decorators, service configuration, and multiple auth methods
 */
export function createAuthMiddleware(serviceConfig?: ServiceAuthConfig) {
  const rateLimiters = new Map<string, RateLimiterRedis>();

  return function authMiddleware(options: AuthMiddlewareOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      try {
        // Determine auth configuration for this route
        const authConfig = determineAuthConfig(req, serviceConfig, options);
        
        // Apply rate limiting if configured
        await applyRateLimit(req, res, authConfig, rateLimiters);
        
        // Attempt authentication
        const authResult = await attemptAuthentication(req, authConfig);
        
        // Handle authentication result
        const success = await handleAuthResult(req, res, authResult, authConfig);
        
        if (success) {
          // Log successful authentication
          await logAuthEvent(req, 'login', true, authResult.context);
          
          logger.debug('Authentication successful', {
            userId: authResult.context?.userId,
            authMethod: authResult.context?.authMethod,
            duration: `${Date.now() - startTime}ms`,
            path: req.path
          });
          
          next();
        }
        // If not successful, response has already been sent by handleAuthResult
        
      } catch (error: any) {
        logger.error('Authentication middleware error', {
          error: error.message,
          path: req.path,
          method: req.method,
          duration: `${Date.now() - startTime}ms`
        });
        
        await logAuthEvent(req, 'auth_failure', false, undefined, error.message);
        
        sendErrorResponse(res, 'Authentication system error', 500);
      }
    };
  };
}

/**
 * Determine authentication configuration for the current route
 */
function determineAuthConfig(
  req: Request,
  serviceConfig?: ServiceAuthConfig,
  options: AuthMiddlewareOptions = {}
): RouteAuthConfig {
  const { method, path } = req;
  
  // 1. Check for decorator-based configuration
  const decoratorConfig = getDecoratorAuthConfig(req);
  if (decoratorConfig) {
    return decoratorConfig;
  }
  
  // 2. Check service-level route configuration
  if (serviceConfig) {
    const routeConfig = getRouteAuthConfig(path, method, serviceConfig);
    if (routeConfig) {
      return routeConfig;
    }
    
    // 3. Check if route is in public routes list
    if (isPublicRoute(path, method, serviceConfig)) {
      return { requireAuth: false };
    }
    
    // 4. Use service default configuration
    return {
      requireAuth: serviceConfig.defaultAuth.requireAuth,
      optional: serviceConfig.defaultAuth.optional
    };
  }
  
  // 5. Use middleware options
  if (options.routeAuth) {
    return options.routeAuth;
  }
  
  // 6. Default to requiring authentication
  return {
    requireAuth: !options.optional,
    optional: options.optional || false
  };
}

/**
 * Get authentication configuration from route handler decorators
 */
function getDecoratorAuthConfig(req: Request): RouteAuthConfig | null {
  // This would typically be implemented by examining the route handler
  // For now, we'll check if metadata is attached to the request
  if (req.authMetadata) {
    return req.authMetadata.config || null;
  }
  
  return null;
}

/**
 * Apply rate limiting based on configuration
 */
async function applyRateLimit(
  req: Request,
  res: Response,
  authConfig: RouteAuthConfig,
  rateLimiters: Map<string, RateLimiterRedis>
): Promise<void> {
  if (!authConfig.rateLimit) {
    return;
  }
  
  const { windowMs, max, skipSuccessfulRequests } = authConfig.rateLimit;
  const key = `${req.ip}:${req.path}`;
  
  let rateLimiter = rateLimiters.get(key);
  if (!rateLimiter) {
    // Note: In a real implementation, you'd need Redis configuration
    // For now, we'll skip rate limiting implementation
    logger.warn('Rate limiting configured but Redis not available');
    return;
  }
  
  try {
    const resRateLimiter = await rateLimiter.consume(req.ip || 'unknown');
    
    // Add rate limit info to request
    req.rateLimitInfo = {
      remaining: resRateLimiter.remainingPoints || 0,
      resetTime: new Date(Date.now() + resRateLimiter.msBeforeNext),
      limit: max
    };
    
  } catch (rejRes: any) {
    // Rate limit exceeded
    const errorMessage = 'Too many requests';
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: errorMessage
      },
      meta: {
        retryAfter: Math.round(rejRes.msBeforeNext / 1000),
        limit: max,
        window: windowMs
      }
    });
    
    throw new Error('Rate limit exceeded');
  }
}

/**
 * Attempt authentication using multiple methods
 */
async function attemptAuthentication(
  req: Request,
  authConfig: RouteAuthConfig
): Promise<AuthResult> {
  // If authentication is not required, return success without context
  if (!authConfig.requireAuth) {
    return { success: true };
  }
  
  let lastError: any = null;
  
  // Method 1: JWT Token Authentication
  try {
    const jwtAuth = await authenticateJWT(req);
    if (jwtAuth) {
      return { 
        success: true, 
        context: jwtAuth,
        metadata: { authMethod: 'jwt', duration: 0 }
      };
    }
  } catch (error) {
    lastError = error;
    logger.debug('JWT authentication failed', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // Method 2: API Key Authentication
  try {
    const apiKeyAuth = await authenticateAPIKey(req);
    if (apiKeyAuth) {
      return { 
        success: true, 
        context: apiKeyAuth,
        metadata: { authMethod: 'api_key', duration: 0 }
      };
    }
  } catch (error) {
    lastError = error;
    logger.debug('API key authentication failed', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // Method 3: Development Mode
  if (process.env.NODE_ENV === 'development' && authConfig.optional) {
    logger.warn('Using development authentication bypass');
    return {
      success: true,
      context: createDevelopmentAuthContext(),
      metadata: { authMethod: 'development', duration: 0 }
    };
  }
  
  // All authentication methods failed
  return {
    success: false,
    error: {
      code: 'AUTHENTICATION_FAILED',
      message: lastError?.message || 'Authentication required',
      statusCode: 401
    }
  };
}

/**
 * Handle authentication result and apply authorization
 */
async function handleAuthResult(
  req: Request,
  res: Response,
  authResult: AuthResult,
  authConfig: RouteAuthConfig
): Promise<boolean> {
  // Handle authentication failure
  if (!authResult.success) {
    if (authConfig.optional) {
      return true; // Continue without authentication
    }
    
    const error = authResult.error!;
    sendErrorResponse(res, error.message, error.statusCode);
    return false;
  }
  
  // Attach auth context to request
  if (authResult.context) {
    req.auth = authResult.context;
  }
  
  // Skip authorization if no authentication context (optional auth)
  if (!authResult.context) {
    return true;
  }
  
  // Apply authorization checks
  const authorizationResult = await applyAuthorization(req, res, authResult.context, authConfig);
  
  if (!authorizationResult) {
    return false; // Response already sent by authorization handler
  }
  
  return true;
}

/**
 * Apply authorization checks based on configuration
 */
async function applyAuthorization(
  req: Request,
  res: Response,
  authContext: AuthContext,
  authConfig: RouteAuthConfig
): Promise<boolean> {
  // System admin check
  if (authConfig.systemAdminOnly && !authContext.isSystemAdmin) {
    await logAuthEvent(req, 'permission_denied', false, authContext, 'System admin required');
    sendErrorResponse(res, 'System administrator privileges required', 403);
    return false;
  }
  
  // Cross-organization access check
  if (authConfig.crossOrgAccess && !authContext.canCrossOrganizations) {
    await logAuthEvent(req, 'permission_denied', false, authContext, 'Cross-org access required');
    sendErrorResponse(res, 'Cross-organization access not permitted', 403);
    return false;
  }
  
  // Permission-based authorization
  if (authConfig.permissions) {
    const hasPermission = await checkPermissions(authContext, authConfig.permissions);
    if (!hasPermission) {
      await logAuthEvent(req, 'permission_denied', false, authContext, 'Insufficient permissions');
      sendErrorResponse(res, 'Insufficient permissions', 403);
      return false;
    }
  }
  
  // Role-based authorization
  if (authConfig.roles) {
    const hasRole = await checkRoles(authContext, authConfig.roles);
    if (!hasRole) {
      await logAuthEvent(req, 'permission_denied', false, authContext, 'Insufficient role privileges');
      sendErrorResponse(res, 'Insufficient role privileges', 403);
      return false;
    }
  }
  
  // Custom authorization
  if (authConfig.customAuth) {
    try {
      const customResult = await authConfig.customAuth(req, res, authContext);
      if (!customResult) {
        await logAuthEvent(req, 'permission_denied', false, authContext, 'Custom authorization failed');
        sendErrorResponse(res, 'Access denied by custom authorization', 403);
        return false;
      }
    } catch (error) {
      logger.error('Custom authorization error', { error: error instanceof Error ? error.message : String(error) });
      await logAuthEvent(req, 'permission_denied', false, authContext, 'Custom authorization error');
      sendErrorResponse(res, 'Authorization check failed', 500);
      return false;
    }
  }
  
  return true;
}

/**
 * Check user permissions
 */
async function checkPermissions(
  authContext: AuthContext,
  requirement: PermissionRequirement
): Promise<boolean> {
  const requiredPermissions = Array.isArray(requirement.permissions) 
    ? requirement.permissions 
    : [requirement.permissions];
  
  // System admin override
  if (requirement.allowSystemOverride !== false && authContext.isSystemAdmin) {
    return true;
  }
  
  // Check permissions
  if (requirement.requireAll) {
    return requiredPermissions.every(perm => authContext.permissions.includes(perm));
  } else {
    return requiredPermissions.some(perm => authContext.permissions.includes(perm));
  }
}

/**
 * Check user roles
 */
async function checkRoles(
  authContext: AuthContext,
  requirement: RoleRequirement
): Promise<boolean> {
  const requiredRoles = Array.isArray(requirement.roles) 
    ? requirement.roles 
    : [requirement.roles];
  
  // System admin override
  if (requirement.allowSystemOverride !== false && authContext.isSystemAdmin) {
    return true;
  }
  
  // Check roles
  if (requirement.requireAll) {
    return requiredRoles.every(role => authContext.roles.includes(role));
  } else {
    return requiredRoles.some(role => authContext.roles.includes(role));
  }
}

/**
 * JWT authentication implementation
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
  
  const decoded = jwt.verify(token, jwtSecret) as EnhancedJWTPayload;
  
  if (!decoded.user_id || !decoded.wallet_address) {
    throw new Error('Invalid JWT payload');
  }
  
  // In a real implementation, you'd fetch user permissions from database
  // For now, use the payload data
  return {
    userId: decoded.user_id,
    walletAddress: decoded.wallet_address,
    tenantId: decoded.organization_id || '01HBXYZ0000000000000000000',
    permissions: decoded.permissions || [],
    roles: decoded.roles || [],
    isSystemAdmin: decoded.isSystemAdmin || false,
    canCrossOrganizations: decoded.canCrossOrganizations || false,
    organizationId: decoded.organization_id,
    organizationName: decoded.organization_name,
    authMethod: 'jwt',
    sessionId: decoded.jti,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  };
}

/**
 * API key authentication (placeholder)
 */
async function authenticateAPIKey(_req: Request): Promise<AuthContext | null> {
  // TODO: Implement API key authentication
  return null;
}

/**
 * Development authentication context
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
 * Log authentication events for audit
 */
async function logAuthEvent(
  req: Request,
  eventType: AuthAuditEntry['eventType'],
  success: boolean,
  authContext?: AuthContext,
  errorMessage?: string
): Promise<void> {
  const auditEntry: AuthAuditEntry = {
    eventType,
    userId: authContext?.userId,
    walletAddress: authContext?.walletAddress,
    organizationId: authContext?.organizationId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: {
      path: req.path,
      method: req.method,
      authMethod: authContext?.authMethod
    },
    timestamp: new Date(),
    success,
    errorMessage
  };
  
  // In a real implementation, you'd save this to an audit log
  logger.info('Auth audit log', auditEntry);
}

/**
 * Send standardized error response
 */
function sendErrorResponse(res: Response, message: string, statusCode: number): void {
  res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : 'ERROR',
      message
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Utility function to create a simple auth middleware for Express routes
 */
export function simpleAuth(options: { 
  optional?: boolean; 
  permissions?: string[];
  roles?: string[];
  systemAdminOnly?: boolean;
} = {}) {
  const middleware = createAuthMiddleware();
  
  const routeConfig: RouteAuthConfig = {
    requireAuth: !options.optional,
    optional: options.optional,
    systemAdminOnly: options.systemAdminOnly,
    permissions: options.permissions ? {
      permissions: options.permissions,
      organizationSpecific: true
    } : undefined,
    roles: options.roles ? {
      roles: options.roles,
      organizationSpecific: true
    } : undefined
  };
  
  return middleware({ routeAuth: routeConfig });
}

/**
 * Express.js route integration helper
 */
export function withAuth(routeConfig: RouteAuthConfig) {
  const middleware = createAuthMiddleware();
  return middleware({ routeAuth: routeConfig });
}

/**
 * NestJS-style decorator support for Express
 */
export function applyAuthDecorators(router: any, controllerClass: any): void {
  const metadata = AuthMetadataReader.getClassAuthMetadata(controllerClass);
  
  metadata.forEach((authConfig, methodName) => {
    // This is a simplified example - real implementation would need
    // to integrate with your routing framework
    logger.info(`Would apply auth config to ${methodName}`, authConfig);
  });
}