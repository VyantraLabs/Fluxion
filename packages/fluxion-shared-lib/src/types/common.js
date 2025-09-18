"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSTANTS = exports.JWT_EXPIRES_IN = exports.JWT_SECRET = exports.TABLE_NAME = exports.POLYGON_RPC_URL = exports.POLYGON_CHAIN_ID = exports.POLYGON_USDC_CONTRACT = exports.SUPPORTED_CHAINS = exports.FluxionError = exports.ErrorCodes = void 0;
exports.sanitizeUserRecord = sanitizeUserRecord;
// Utility function to sanitize UserRecord for API responses
function sanitizeUserRecord(userRecord) {
    const { tenant_id, // Remove sensitive tenant_id
    is_admin, // Remove admin flags
    is_super_admin, // Remove admin flags 
    admin_granted_at, admin_granted_by, ...safeRecord } = userRecord;
    return safeRecord;
}
// Error handling
var ErrorCodes;
(function (ErrorCodes) {
    ErrorCodes["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCodes["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCodes["FORBIDDEN"] = "FORBIDDEN";
    ErrorCodes["NOT_FOUND"] = "NOT_FOUND";
    ErrorCodes["CONFLICT"] = "CONFLICT";
    ErrorCodes["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCodes["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ErrorCodes["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    ErrorCodes["BLOCKCHAIN_ERROR"] = "BLOCKCHAIN_ERROR";
    ErrorCodes["DATABASE_ERROR"] = "DATABASE_ERROR";
})(ErrorCodes || (exports.ErrorCodes = ErrorCodes = {}));
class FluxionError extends Error {
    constructor(code, message, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'FluxionError';
    }
}
exports.FluxionError = FluxionError;
exports.SUPPORTED_CHAINS = {
    polygon: {
        chainId: 137,
        name: 'Polygon',
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/' + (process.env.ALCHEMY_API_KEY || ''),
        explorerUrl: 'https://polygonscan.com',
        nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18
        },
        tokens: {
            USDC: {
                address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
                decimals: 6
            }
        }
    }
};
// Configuration constants
exports.POLYGON_USDC_CONTRACT = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
exports.POLYGON_CHAIN_ID = 137;
exports.POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/' + (process.env.ALCHEMY_API_KEY || '');
exports.TABLE_NAME = process.env.DYNAMODB_TABLE || 'fluxion-data-dev';
// DEPRECATED: Use config.aws.sqs.notificationQueueUrl instead
// export const NOTIFICATION_QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL || '';
exports.JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';
exports.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
exports.CONSTANTS = {
    MIN_CONFIRMATION_BLOCKS: 12,
    PAYMENT_TIMEOUT_HOURS: 24,
    MAX_INVOICE_AMOUNT: 1000000,
    MIN_INVOICE_AMOUNT: 0.01,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: 100
};
// Express Request interface extension is in types/express.d.ts
//# sourceMappingURL=common.js.map