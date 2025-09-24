import { Request, Response, NextFunction } from 'express';

/**
 * Enhanced JWT payload with roles, permissions, and organization context
 */
export interface EnhancedJWTPayload {
  // User identification
  user_id: string;
  wallet_address: string;
  
  // Organization context (multi-tenant)
  organization_id?: string;
  organization_name?: string;
  organization_slug?: string;
  
  // Role-based access control
  roles?: string[];
  permissions?: string[];
  
  // Legacy single role for backward compatibility
  role?: string;
  
  // System-level permissions
  isSystemAdmin?: boolean;
  canCrossOrganizations?: boolean;
  
  // Token metadata
  iat: number;
  exp: number;
  jti?: string; // JWT ID for revocation
}

/**
 * Authentication context attached to requests
 */
export interface AuthContext {
  userId: string;
  walletAddress: string;
  tenantId: string;
  
  // RBAC data
  permissions: string[];
  roles: string[];
  isSystemAdmin: boolean;
  canCrossOrganizations: boolean;
  
  // Organization context
  organizationId?: string;
  organizationName?: string;
  
  // Auth method used
  authMethod: 'jwt' | 'signature' | 'api_key' | 'development';
  
  // Session metadata
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Permission requirement configuration
 */
export interface PermissionRequirement {
  permissions: string | string[];
  requireAll?: boolean; // Default: false (any permission)
  allowSystemOverride?: boolean; // Default: true
  organizationSpecific?: boolean; // Default: true
}

/**
 * Role requirement configuration
 */
export interface RoleRequirement {
  roles: string | string[];
  requireAll?: boolean; // Default: false (any role)
  organizationSpecific?: boolean; // Default: true
  allowSystemOverride?: boolean; // Default: true
}

/**
 * Route authentication configuration
 */
export interface RouteAuthConfig {
  // Authentication requirement
  requireAuth?: boolean; // Default: true
  optional?: boolean; // Allow unauthenticated access but populate auth if present
  
  // Permission-based access control
  permissions?: PermissionRequirement;
  
  // Role-based access control
  roles?: RoleRequirement;
  
  // System-level access
  systemAdminOnly?: boolean;
  crossOrgAccess?: boolean;
  
  // Custom authorization function
  customAuth?: (req: Request, res: Response, auth: AuthContext) => Promise<boolean> | boolean;
  
  // Rate limiting (optional)
  rateLimit?: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests?: boolean;
  };
}

/**
 * Service-level authentication configuration
 */
export interface ServiceAuthConfig {
  // Default behavior for all routes
  defaultAuth: {
    requireAuth: boolean;
    optional?: boolean;
  };
  
  // Public routes (no authentication required)
  publicRoutes: string[];
  
  // Route-specific configurations
  routeConfigs: Record<string, RouteAuthConfig>;
  
  // Global options
  options: {
    // JWT settings
    jwtSecret?: string;
    jwtExpiresIn?: string;
    
    // Development mode
    developmentMode?: boolean;
    skipSignatureValidation?: boolean;
    
    // CORS settings
    corsOrigins?: string[];
    
    // Rate limiting
    globalRateLimit?: {
      windowMs: number;
      max: number;
    };
    
    // Session management
    enableSessions?: boolean;
    sessionTimeout?: number;
  };
}

/**
 * Decorator metadata for route authentication
 */
export interface AuthMetadata {
  type: 'public' | 'protected' | 'permission' | 'role' | 'system-admin' | 'custom';
  config?: RouteAuthConfig;
}

/**
 * Auth middleware options
 */
export interface AuthMiddlewareOptions {
  // Basic auth settings
  optional?: boolean;
  skipSignatureValidation?: boolean;
  developmentMode?: boolean;
  
  // Service configuration
  serviceConfig?: ServiceAuthConfig;
  
  // Route-specific overrides
  routeAuth?: RouteAuthConfig;
  
  // Logging and monitoring
  enableAuditLog?: boolean;
  logFailedAttempts?: boolean;
}

/**
 * Authentication result from middleware
 */
export interface AuthResult {
  success: boolean;
  context?: AuthContext;
  error?: {
    code: string;
    message: string;
    statusCode: number;
  };
  metadata?: {
    authMethod: string;
    duration: number;
    rateLimited?: boolean;
  };
}

/**
 * API key authentication payload (for integrations)
 */
export interface APIKeyPayload {
  keyId: string;
  organizationId: string;
  permissions: string[];
  scopes: string[];
  rateLimit?: {
    rpm: number; // requests per minute
    daily: number; // requests per day
  };
  expiresAt?: string;
}

/**
 * Wallet signature authentication payload
 */
export interface SignatureAuthPayload {
  walletAddress: string;
  signature: string;
  message: string;
  nonce: string;
  timestamp: number;
}

/**
 * Express request extensions
 */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      authMetadata?: AuthMetadata;
      rateLimitInfo?: {
        remaining: number;
        resetTime: Date;
        limit: number;
      };
    }
  }
}

/**
 * Authentication service interface
 */
export interface IAuthenticationService {
  // Token management
  generateJWT(payload: Omit<EnhancedJWTPayload, 'iat' | 'exp'>): Promise<string>;
  verifyJWT(token: string): Promise<EnhancedJWTPayload>;
  revokeJWT(jti: string): Promise<void>;
  
  // Permission management
  getUserPermissions(userId: string, organizationId?: string): Promise<string[]>;
  hasPermission(userId: string, permission: string | string[], organizationId?: string): Promise<boolean>;
  
  // Role management
  getUserRoles(userId: string, organizationId?: string): Promise<string[]>;
  hasRole(userId: string, role: string | string[], organizationId?: string): Promise<boolean>;
  
  // Session management
  createSession(userId: string, metadata: any): Promise<string>;
  validateSession(sessionId: string): Promise<boolean>;
  destroySession(sessionId: string): Promise<void>;
}

/**
 * Audit log entry for authentication events
 */
export interface AuthAuditEntry {
  eventType: 'login' | 'logout' | 'auth_failure' | 'permission_denied' | 'session_created' | 'session_destroyed';
  userId?: string;
  walletAddress?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  timestamp: Date;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Custom authorization handler
 */
export type CustomAuthHandler = (
  req: Request,
  res: Response,
  auth: AuthContext
) => Promise<boolean> | boolean;

/**
 * Middleware factory function type
 */
export type AuthMiddlewareFactory = (
  options?: AuthMiddlewareOptions
) => (req: Request, res: Response, next: NextFunction) => Promise<void> | void;