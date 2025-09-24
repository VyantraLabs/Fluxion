import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { Logger } from '../utils/logger';
import { sendError } from '../utils/response';
import { EnhancedJWTPayload, AuthContext } from './types';

const logger = new Logger('Auth');

// Legacy interface for backward compatibility
export interface AuthJWTPayload {
  wallet_address: string;
  user_id?: string;
  organization_id?: string;
  role?: string;
  iat: number;
  exp: number;
}

// Re-export enhanced types
export * from './types';
export * from './decorators';
export * from './auth-config';
export * from './enhanced-middleware';

/**
 * Enhanced JWT token generation with roles, permissions, and organization context
 */
export function generateEnhancedJWT(
  payload: Omit<EnhancedJWTPayload, 'iat' | 'exp' | 'jti'>,
  options: {
    expiresIn?: string;
    includeJti?: boolean;
  } = {}
): string {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const enhancedPayload: EnhancedJWTPayload = {
    ...payload,
    jti: options.includeJti ? ulid() : undefined,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + parseExpiresIn(options.expiresIn || '24h')
  };

  return jwt.sign(enhancedPayload, jwtSecret);
}

/**
 * Verify and decode enhanced JWT token
 */
export function verifyEnhancedJWT(token: string): EnhancedJWTPayload {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.verify(token, jwtSecret) as EnhancedJWTPayload;
}

/**
 * Create authentication context from JWT payload
 */
export function createAuthContextFromJWT(
  payload: EnhancedJWTPayload,
  req?: Request
): AuthContext {
  return {
    userId: payload.user_id,
    walletAddress: payload.wallet_address,
    tenantId: payload.organization_id || '01HBXYZ0000000000000000000',
    permissions: payload.permissions || [],
    roles: payload.roles || [],
    isSystemAdmin: payload.isSystemAdmin || false,
    canCrossOrganizations: payload.canCrossOrganizations || false,
    organizationId: payload.organization_id,
    organizationName: payload.organization_name,
    authMethod: 'jwt',
    sessionId: payload.jti,
    ipAddress: req?.ip,
    userAgent: req?.headers['user-agent']
  };
}

/**
 * Legacy JWT authentication middleware (maintained for backward compatibility)
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Authentication token required', 401);
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    logger.error('JWT_SECRET not configured');
    return sendError(res, 'Authentication system not configured', 500);
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as AuthJWTPayload & Partial<EnhancedJWTPayload>;
    
    if (!decoded.user_id || !decoded.wallet_address) {
      return sendError(res, 'Invalid token format', 401);
    }
    
    // Add user info to request context
    if (!req.context) {
      req.context = {
        requestId: req.headers['x-request-id'] as string || 'unknown',
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress || 'unknown'
      };
    }
    
    req.context.userId = decoded.user_id;
    req.context.walletAddress = decoded.wallet_address;
    req.context.organizationId = decoded.organization_id;
    req.context.userRole = decoded.role;

    // Create enhanced auth context if enhanced payload is available
    if (decoded.permissions || decoded.roles) {
      req.auth = createAuthContextFromJWT(decoded as EnhancedJWTPayload, req);
    }

    (req as any).user = decoded;

    next();
  } catch (error) {
    logger.warn('JWT verification failed', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 'Invalid or expired token', 401);
  }
}

/**
 * Optional JWT authentication middleware (legacy)
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
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
    const decoded = jwt.verify(token, jwtSecret) as AuthJWTPayload & Partial<EnhancedJWTPayload>;
    
    if (req.context) {
      req.context.userId = decoded.user_id;
      req.context.walletAddress = decoded.wallet_address;
      req.context.organizationId = decoded.organization_id;
      req.context.userRole = decoded.role;
    }

    // Create enhanced auth context if enhanced payload is available
    if (decoded.permissions || decoded.roles) {
      req.auth = createAuthContextFromJWT(decoded as EnhancedJWTPayload, req);
    }

    (req as any).user = decoded;
  } catch (error) {
    // Ignore auth errors in optional middleware
  }

  next();
}

/**
 * Legacy JWT generation function (maintained for backward compatibility)
 */
export function generateJWT(payload: Omit<AuthJWTPayload, 'iat' | 'exp'>): string {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(payload, jwtSecret);
}

/**
 * Parse expiration time string to seconds
 */
function parseExpiresIn(expiresIn: string): number {
  const units: { [key: string]: number } = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  };
  
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid expiresIn format: ${expiresIn}`);
  }
  
  const [, value, unit] = match;
  return parseInt(value, 10) * units[unit];
}

/**
 * Token revocation management (placeholder for Redis-based implementation)
 */
const revokedTokens = new Set<string>();

export function revokeJWT(jti: string): void {
  if (jti) {
    revokedTokens.add(jti);
    // In production, store in Redis with TTL
  }
}

export function isJWTRevoked(jti: string): boolean {
  return jti ? revokedTokens.has(jti) : false;
}

/**
 * Refresh token functionality
 */
export function generateRefreshToken(userId: string): string {
  const payload = {
    user_id: userId,
    type: 'refresh',
    jti: ulid()
  };
  
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }
  
  // Refresh tokens have longer expiration (30 days)
  return jwt.sign(payload, jwtSecret, { expiresIn: '30d' });
}

export function verifyRefreshToken(token: string): { user_id: string; jti: string } {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }
  
  const decoded = jwt.verify(token, jwtSecret) as any;
  
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  
  if (isJWTRevoked(decoded.jti)) {
    throw new Error('Refresh token has been revoked');
  }
  
  return { user_id: decoded.user_id, jti: decoded.jti };
}