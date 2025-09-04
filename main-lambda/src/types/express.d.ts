import { RequestContext, TenantContext } from './common';

declare global {
  namespace Express {
    interface Request {
      user?: {
        wallet_address: string;
        user_id?: string;
        tenant_id?: string;
        iat: number;
        exp: number;
      };
      tenant?: TenantContext;
      context?: RequestContext;
    }
  }
}