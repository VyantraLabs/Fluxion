import { JWTPayload } from './auth';
import { Organization } from '../database/entities/Organization';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      organization?: Organization;
      context?: {
        tenantId?: string;
        userId?: string;
        organizationId?: string;
        permissions?: any;
      };
    }
  }
}

export {};