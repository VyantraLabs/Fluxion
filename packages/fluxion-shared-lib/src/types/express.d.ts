import { RequestContext } from './common';

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
      user?: any;
    }
    
    interface Response {
      success(data?: any, statusCode?: number): this;
      error(code: string, message: string, statusCode?: number, details?: any): this;
    }
  }
}