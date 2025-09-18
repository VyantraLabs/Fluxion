import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Logger } from '../utils/logger';
import { sendError } from '../utils/response';

const logger = new Logger('Auth');

export interface AuthJWTPayload {
  wallet_address: string;
  user_id?: string;
  organization_id?: string;
  role?: string;
  iat: number;
  exp: number;
}

/**
 * JWT authentication middleware
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
    const decoded = jwt.verify(token, jwtSecret) as AuthJWTPayload;
    
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

    (req as any).user = decoded;

    next();
  } catch (error) {
    logger.warn('JWT verification failed', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 'Invalid or expired token', 401);
  }
}

/**
 * Optional JWT authentication middleware
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
    const decoded = jwt.verify(token, jwtSecret) as AuthJWTPayload;
    
    if (req.context) {
      req.context.userId = decoded.user_id;
      req.context.walletAddress = decoded.wallet_address;
      req.context.organizationId = decoded.organization_id;
      req.context.userRole = decoded.role;
    }

    (req as any).user = decoded;
  } catch (error) {
    // Ignore auth errors in optional middleware
  }

  next();
}

/**
 * Utility function to generate JWT tokens
 */
export function generateJWT(payload: Omit<AuthJWTPayload, 'iat' | 'exp'>): string {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(payload, jwtSecret);
}