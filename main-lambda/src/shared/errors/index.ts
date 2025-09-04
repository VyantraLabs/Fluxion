export class FluxionError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(message: string, code: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'FluxionError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FluxionError);
    }
  }
}

export class ValidationError extends FluxionError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends FluxionError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends FluxionError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends FluxionError {
  constructor(message: string = 'Forbidden access') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends FluxionError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class BlockchainError extends FluxionError {
  constructor(message: string, details?: any) {
    super(message, 'BLOCKCHAIN_ERROR', 502, details);
    this.name = 'BlockchainError';
  }
}

export class PaymentVerificationError extends FluxionError {
  constructor(message: string, details?: any) {
    super(message, 'PAYMENT_VERIFICATION_ERROR', 400, details);
    this.name = 'PaymentVerificationError';
  }
}

export class RateLimitError extends FluxionError {
  constructor(message: string = 'Too many requests') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends FluxionError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

// Error factory functions
export const createValidationError = (message: string, details?: any) => 
  new ValidationError(message, details);

export const createNotFoundError = (resource: string, identifier?: string) => 
  new NotFoundError(resource, identifier);

export const createUnauthorizedError = (message?: string) => 
  new UnauthorizedError(message);

export const createForbiddenError = (message?: string) => 
  new ForbiddenError(message);

export const createBlockchainError = (message: string, details?: any) => 
  new BlockchainError(message, details);

export const createPaymentVerificationError = (message: string, details?: any) => 
  new PaymentVerificationError(message, details);

// Type guard to check if error is a FluxionError
export const isFluxionError = (error: any): error is FluxionError => {
  return error instanceof FluxionError;
};

// Helper to convert unknown errors to FluxionError
export const normalizeError = (error: unknown): FluxionError => {
  if (isFluxionError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new FluxionError(error.message, 'INTERNAL_ERROR', 500, {
      originalName: error.name,
      stack: error.stack
    });
  }

  return new FluxionError('An unknown error occurred', 'UNKNOWN_ERROR', 500, {
    originalError: error
  });
};