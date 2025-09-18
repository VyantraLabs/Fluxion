import { APIResponse, PaginatedResponse } from '../types/common';

export interface ResponseBuilderOptions {
  requestId?: string;
  version?: string;
}

export class ResponseBuilder {
  private requestId: string;
  private version?: string;

  constructor(options: ResponseBuilderOptions = {}) {
    this.requestId = options.requestId || this.generateRequestId();
    this.version = options.version;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  success<T>(data: T, meta?: Record<string, any>): APIResponse<T> {
    return {
      success: true,
      data,
      meta: {
        requestId: this.requestId,
        timestamp: new Date().toISOString(),
        version: this.version,
        ...meta
      }
    };
  }

  error(
    error: Error | string,
    code?: string,
    details?: any,
    meta?: Record<string, any>
  ): APIResponse<never> {
    let errorCode: string;
    let errorMessage: string;

    if (error instanceof Error) {
      errorCode = code || 'INTERNAL_ERROR';
      errorMessage = error.message;
    } else {
      errorCode = code || 'INTERNAL_ERROR';
      errorMessage = error;
    }

    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details
      },
      meta: {
        requestId: this.requestId,
        timestamp: new Date().toISOString(),
        version: this.version,
        ...meta
      }
    };
  }

  paginated<T>(
    items: T[],
    pagination: {
      hasMore: boolean;
      nextToken?: string;
      totalCount?: number;
    },
    meta?: Record<string, any>
  ): PaginatedResponse<T> {
    return {
      success: true,
      data: items,
      pagination,
      meta: {
        requestId: this.requestId,
        timestamp: new Date().toISOString(),
        version: this.version,
        ...meta
      }
    };
  }
}

// Helper functions for Express middleware
export function createResponseBuilder(requestId?: string, version?: string): ResponseBuilder {
  return new ResponseBuilder({ requestId, version });
}

export function sendSuccess<T>(res: any, data: T, statusCode = 200, meta?: Record<string, any>): void {
  const builder = createResponseBuilder(res.locals?.requestId);
  res.status(statusCode).json(builder.success(data, meta));
}

export function sendError(res: any, error: Error | string, statusCode = 500, details?: any): void {
  const builder = createResponseBuilder(res.locals?.requestId);
  const response = typeof error === 'string' 
    ? builder.error(error, undefined, details)
    : builder.error(error, undefined, details);
    
  res.status(statusCode).json(response);
}