"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeError = exports.isFluxionError = exports.createRateLimitError = exports.createRepositoryOperationError = exports.createInvalidMessageFormatError = exports.createMessageExpiredError = exports.createSignatureVerificationError = exports.createAuthenticationError = exports.createPaymentVerificationError = exports.createBlockchainError = exports.createForbiddenError = exports.createUnauthorizedError = exports.createNotFoundError = exports.createValidationError = exports.DatabaseError = exports.RepositoryOperationError = exports.InvalidMessageFormatError = exports.MessageExpiredError = exports.SignatureVerificationError = exports.AuthenticationError = exports.RateLimitError = exports.PaymentVerificationError = exports.BlockchainError = exports.ConflictError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.FluxionError = void 0;
class FluxionError extends Error {
    constructor(message, code, statusCode = 500, details) {
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
exports.FluxionError = FluxionError;
class ValidationError extends FluxionError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', 400, details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends FluxionError {
    constructor(resource, identifier) {
        const message = identifier
            ? `${resource} with identifier '${identifier}' not found`
            : `${resource} not found`;
        super(message, 'NOT_FOUND', 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends FluxionError {
    constructor(message = 'Unauthorized access') {
        super(message, 'UNAUTHORIZED', 401);
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends FluxionError {
    constructor(message = 'Forbidden access') {
        super(message, 'FORBIDDEN', 403);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
class ConflictError extends FluxionError {
    constructor(message, details) {
        super(message, 'CONFLICT', 409, details);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class BlockchainError extends FluxionError {
    constructor(message, details) {
        super(message, 'BLOCKCHAIN_ERROR', 502, details);
        this.name = 'BlockchainError';
    }
}
exports.BlockchainError = BlockchainError;
class PaymentVerificationError extends FluxionError {
    constructor(message, details) {
        super(message, 'PAYMENT_VERIFICATION_ERROR', 400, details);
        this.name = 'PaymentVerificationError';
    }
}
exports.PaymentVerificationError = PaymentVerificationError;
class RateLimitError extends FluxionError {
    constructor(message = 'Too many requests') {
        super(message, 'RATE_LIMIT_EXCEEDED', 429);
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
class AuthenticationError extends FluxionError {
    constructor(message, details) {
        super(message, 'AUTHENTICATION_FAILED', 401, details);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class SignatureVerificationError extends FluxionError {
    constructor(message = 'Invalid signature verification', details) {
        super(message, 'SIGNATURE_VERIFICATION_FAILED', 401, details);
        this.name = 'SignatureVerificationError';
    }
}
exports.SignatureVerificationError = SignatureVerificationError;
class MessageExpiredError extends FluxionError {
    constructor(message = 'Authentication message has expired', details) {
        super(message, 'AUTH_MESSAGE_EXPIRED', 401, details);
        this.name = 'MessageExpiredError';
    }
}
exports.MessageExpiredError = MessageExpiredError;
class InvalidMessageFormatError extends FluxionError {
    constructor(message = 'Invalid authentication message format', details) {
        super(message, 'INVALID_MESSAGE_FORMAT', 422, details);
        this.name = 'InvalidMessageFormatError';
    }
}
exports.InvalidMessageFormatError = InvalidMessageFormatError;
class RepositoryOperationError extends FluxionError {
    constructor(operation, entityName, originalError) {
        const message = `Failed to ${operation} ${entityName}`;
        super(message, 'REPOSITORY_OPERATION_FAILED', 500, {
            operation,
            entityName,
            originalError: originalError?.message || originalError
        });
        this.name = 'RepositoryOperationError';
    }
}
exports.RepositoryOperationError = RepositoryOperationError;
class DatabaseError extends FluxionError {
    constructor(message, details) {
        super(message, 'DATABASE_ERROR', 500, details);
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
// Error factory functions
const createValidationError = (message, details) => new ValidationError(message, details);
exports.createValidationError = createValidationError;
const createNotFoundError = (resource, identifier) => new NotFoundError(resource, identifier);
exports.createNotFoundError = createNotFoundError;
const createUnauthorizedError = (message) => new UnauthorizedError(message);
exports.createUnauthorizedError = createUnauthorizedError;
const createForbiddenError = (message) => new ForbiddenError(message);
exports.createForbiddenError = createForbiddenError;
const createBlockchainError = (message, details) => new BlockchainError(message, details);
exports.createBlockchainError = createBlockchainError;
const createPaymentVerificationError = (message, details) => new PaymentVerificationError(message, details);
exports.createPaymentVerificationError = createPaymentVerificationError;
const createAuthenticationError = (message, details) => new AuthenticationError(message, details);
exports.createAuthenticationError = createAuthenticationError;
const createSignatureVerificationError = (message, details) => new SignatureVerificationError(message, details);
exports.createSignatureVerificationError = createSignatureVerificationError;
const createMessageExpiredError = (message, details) => new MessageExpiredError(message, details);
exports.createMessageExpiredError = createMessageExpiredError;
const createInvalidMessageFormatError = (message, details) => new InvalidMessageFormatError(message, details);
exports.createInvalidMessageFormatError = createInvalidMessageFormatError;
const createRepositoryOperationError = (operation, entityName, originalError) => new RepositoryOperationError(operation, entityName, originalError);
exports.createRepositoryOperationError = createRepositoryOperationError;
const createRateLimitError = (message) => new RateLimitError(message);
exports.createRateLimitError = createRateLimitError;
// Type guard to check if error is a FluxionError
const isFluxionError = (error) => {
    return error instanceof FluxionError;
};
exports.isFluxionError = isFluxionError;
// Helper to convert unknown errors to FluxionError
const normalizeError = (error) => {
    if ((0, exports.isFluxionError)(error)) {
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
exports.normalizeError = normalizeError;
//# sourceMappingURL=index.js.map