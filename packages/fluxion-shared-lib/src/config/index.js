"use strict";
/**
 * Configuration management for Fluxion Main Lambda
 * Handles environment variable loading, validation, and typed configuration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigValidationError = exports.config = void 0;
exports.getConfig = getConfig;
const dotenv_1 = require("dotenv");
const path = __importStar(require("path"));
/**
 * Load environment variables from .env file in development
 */
function loadEnvironmentVariables() {
    // Only load .env file in development mode
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        const envPath = path.resolve(process.cwd(), '.env');
        const result = (0, dotenv_1.config)({ path: envPath });
        if (result.error && process.env.NODE_ENV === 'development') {
            console.warn(`Warning: Could not load .env file from ${envPath}. Using process environment variables.`);
        }
    }
}
/**
 * Configuration validation errors
 */
class ConfigValidationError extends Error {
    constructor(message) {
        super(`Configuration validation error: ${message}`);
        this.name = 'ConfigValidationError';
    }
}
exports.ConfigValidationError = ConfigValidationError;
/**
 * Get required environment variable with validation
 */
function getRequiredEnv(key, fallback) {
    const value = process.env[key] || fallback;
    if (!value) {
        throw new ConfigValidationError(`Missing required environment variable: ${key}`);
    }
    return value;
}
/**
 * Get optional environment variable with default
 */
function getOptionalEnv(key, defaultValue) {
    return process.env[key] || defaultValue;
}
/**
 * Get boolean environment variable
 */
function getBooleanEnv(key, defaultValue = false) {
    const value = process.env[key];
    if (!value)
        return defaultValue;
    return value.toLowerCase() === 'true';
}
/**
 * Get number environment variable
 */
function getNumberEnv(key, defaultValue) {
    const value = process.env[key];
    if (!value)
        return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new ConfigValidationError(`Environment variable ${key} must be a valid number, got: ${value}`);
    }
    return parsed;
}
/**
 * Create and validate configuration
 */
function createConfig() {
    // Load environment variables first
    loadEnvironmentVariables();
    const environment = getOptionalEnv('NODE_ENV', 'development');
    // Development vs Production defaults
    const isDevelopment = environment === 'development';
    try {
        const config = {
            environment,
            port: getNumberEnv('PORT', 3000),
            database: {
                host: getOptionalEnv('DB_HOST', isDevelopment ? 'localhost' : 'postgres'),
                port: getNumberEnv('DB_PORT', 5432),
                username: getOptionalEnv('DB_USERNAME', isDevelopment ? 'postgres' : 'fluxion_app'),
                password: getRequiredEnv('DB_PASSWORD', isDevelopment ? 'postgres' : undefined),
                database: getOptionalEnv('DB_DATABASE', isDevelopment ? 'fluxion_local' : 'fluxion_prod'),
                ssl: getBooleanEnv('DB_SSL', !isDevelopment),
                logging: getBooleanEnv('DB_LOGGING', isDevelopment),
                pool: {
                    max: getNumberEnv('DB_POOL_MAX', isDevelopment ? 10 : 20),
                    min: getNumberEnv('DB_POOL_MIN', isDevelopment ? 2 : 5),
                    idleTimeoutMillis: getNumberEnv('DB_IDLE_TIMEOUT', 30000),
                    connectionTimeoutMillis: getNumberEnv('DB_CONNECTION_TIMEOUT', 2000),
                },
            },
            redis: {
                host: getOptionalEnv('REDIS_HOST', isDevelopment ? 'localhost' : 'redis'),
                port: getNumberEnv('REDIS_PORT', 6379),
                password: process.env.REDIS_PASSWORD || undefined,
                db: getNumberEnv('REDIS_DB', 0),
                cacheDb: getNumberEnv('REDIS_CACHE_DB', 1),
                sessionDb: getNumberEnv('REDIS_SESSION_DB', 2),
            },
            aws: {
                region: getOptionalEnv('AWS_REGION', 'ap-south-1'),
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
                sqs: {
                    notificationQueueUrl: getRequiredEnv('NOTIFICATION_QUEUE_URL', isDevelopment ? 'https://sqs.ap-south-1.amazonaws.com/123456789012/fluxion-notifications-dev' : undefined),
                },
                s3: {
                    bucketName: getRequiredEnv('S3_BUCKET_NAME', isDevelopment ? 'fluxion-templates-dev' : undefined),
                    bucketUrl: getRequiredEnv('S3_BUCKET_URL', isDevelopment ? 'https://fluxion-templates-dev.s3.ap-south-1.amazonaws.com' : undefined),
                    region: getOptionalEnv('S3_REGION', 'ap-south-1'),
                },
            },
            jwt: {
                secret: getRequiredEnv('JWT_SECRET', isDevelopment ? 'your-local-jwt-secret-change-in-production' : undefined),
                expiresIn: getOptionalEnv('JWT_EXPIRES_IN', '24h'),
            },
            blockchain: {
                defaultNetwork: getOptionalEnv('DEFAULT_BLOCKCHAIN_NETWORK', 'polygon'),
            },
            frontend: {
                url: getOptionalEnv('FRONTEND_URL', isDevelopment ? 'http://localhost:3001' : 'https://app.fluxion.pay'),
            },
            features: {
                enableRowLevelSecurity: getBooleanEnv('ENABLE_RLS', true),
                enableAuditLogging: getBooleanEnv('ENABLE_AUDIT_LOGGING', true),
                enableRedisCache: getBooleanEnv('ENABLE_REDIS_CACHE', false),
            },
            logging: {
                level: getOptionalEnv('LOG_LEVEL', isDevelopment ? 'debug' : 'info'),
            },
        };
        // Additional validations
        validateConfiguration(config);
        return config;
    }
    catch (error) {
        if (error instanceof ConfigValidationError) {
            console.error('Configuration Error:', error.message);
            console.error('\nRequired environment variables for production:');
            console.error('- JWT_SECRET');
            console.error('- DB_PASSWORD');
            console.error('- NOTIFICATION_QUEUE_URL');
            console.error('- S3_BUCKET_NAME');
            console.error('- S3_BUCKET_URL');
            console.error('\nOptional environment variables:');
            console.error('- NODE_ENV (development|staging|production)');
            console.error('- PORT (default: 3000)');
            console.error('- DB_HOST (default: localhost for dev, postgres for prod)');
            console.error('- DB_PORT (default: 5432)');
            console.error('- DB_USERNAME (default: postgres for dev, fluxion_app for prod)');
            console.error('- DB_DATABASE (default: fluxion_dev for dev, fluxion_prod for prod)');
            console.error('- DB_SSL (default: false for dev, true for prod)');
            console.error('- REDIS_HOST (default: localhost for dev, redis for prod)');
            console.error('- REDIS_PORT (default: 6379)');
            console.error('- REDIS_PASSWORD');
            console.error('- AWS_REGION (default: ap-south-1)');
            console.error('- AWS_ACCESS_KEY_ID');
            console.error('- AWS_SECRET_ACCESS_KEY');
            console.error('- S3_REGION (default: ap-south-1)');
            console.error('- DEFAULT_BLOCKCHAIN_NETWORK (default: polygon)');
            console.error('- FRONTEND_URL');
            console.error('- LOG_LEVEL (debug|info|warn|error)');
            process.exit(1);
        }
        throw error;
    }
}
/**
 * Validate configuration values
 */
function validateConfiguration(config) {
    // Validate JWT secret strength (production only)
    if (config.environment === 'production' && config.jwt.secret.length < 32) {
        throw new ConfigValidationError('JWT_SECRET must be at least 32 characters long in production');
    }
    // Validate URLs
    if (!isValidUrl(config.frontend.url)) {
        throw new ConfigValidationError(`FRONTEND_URL must be a valid URL, got: ${config.frontend.url}`);
    }
    // Validate SQS Queue URL
    if (!isValidSqsUrl(config.aws.sqs.notificationQueueUrl)) {
        throw new ConfigValidationError(`NOTIFICATION_QUEUE_URL must be a valid SQS queue URL, got: ${config.aws.sqs.notificationQueueUrl}`);
    }
    // Validate S3 configuration
    if (!config.aws.s3.bucketName) {
        throw new ConfigValidationError('S3_BUCKET_NAME is required');
    }
    if (!isValidUrl(config.aws.s3.bucketUrl)) {
        throw new ConfigValidationError(`S3_BUCKET_URL must be a valid URL, got: ${config.aws.s3.bucketUrl}`);
    }
    if (!config.aws.s3.bucketUrl.includes('s3')) {
        throw new ConfigValidationError(`S3_BUCKET_URL must be a valid S3 URL, got: ${config.aws.s3.bucketUrl}`);
    }
    // Validate database configuration
    if (!config.database.host) {
        throw new ConfigValidationError('DB_HOST is required');
    }
    if (config.database.port < 1 || config.database.port > 65535) {
        throw new ConfigValidationError('DB_PORT must be a valid port number (1-65535)');
    }
    if (!config.database.username) {
        throw new ConfigValidationError('DB_USERNAME is required');
    }
    if (!config.database.database) {
        throw new ConfigValidationError('DB_DATABASE is required');
    }
    // Validate database name format
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(config.database.database)) {
        throw new ConfigValidationError(`Invalid database name: ${config.database.database}. Must be 1-63 characters, start with letter, alphanumeric with underscores`);
    }
    // Validate Redis configuration
    if (!config.redis.host) {
        throw new ConfigValidationError('REDIS_HOST is required');
    }
    if (config.redis.port < 1 || config.redis.port > 65535) {
        throw new ConfigValidationError('REDIS_PORT must be a valid port number (1-65535)');
    }
    // Validate database pool configuration
    if (config.database.pool.max < config.database.pool.min) {
        throw new ConfigValidationError('DB_POOL_MAX must be greater than or equal to DB_POOL_MIN');
    }
    if (config.database.pool.min < 1) {
        throw new ConfigValidationError('DB_POOL_MIN must be at least 1');
    }
    // Validate blockchain network
    if (!config.blockchain.defaultNetwork) {
        throw new ConfigValidationError('DEFAULT_BLOCKCHAIN_NETWORK is required');
    }
    // Validate logging level
    const validLogLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(config.logging.level)) {
        throw new ConfigValidationError(`LOG_LEVEL must be one of: ${validLogLevels.join(', ')}. Got: ${config.logging.level}`);
    }
}
/**
 * Check if string is a valid URL
 */
function isValidUrl(str) {
    try {
        new URL(str);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if string is a valid SQS queue URL
 */
function isValidSqsUrl(str) {
    return str.startsWith('https://sqs.') && str.includes('.amazonaws.com/');
}
// Create and export singleton configuration
let configInstance = null;
function getConfig() {
    if (!configInstance) {
        configInstance = createConfig();
    }
    return configInstance;
}
// Export configuration for immediate use
exports.config = getConfig();
// Log configuration summary (non-sensitive info only)
if (process.env.NODE_ENV !== 'test') {
    console.log('Fluxion Main Lambda Configuration Loaded:', {
        environment: exports.config.environment,
        port: exports.config.port,
        database: {
            host: exports.config.database.host,
            port: exports.config.database.port,
            database: exports.config.database.database,
            ssl: exports.config.database.ssl,
        },
        redis: {
            host: exports.config.redis.host,
            port: exports.config.redis.port,
            cacheEnabled: exports.config.features.enableRedisCache,
        },
        features: {
            rowLevelSecurity: exports.config.features.enableRowLevelSecurity,
            auditLogging: exports.config.features.enableAuditLogging,
            redisCache: exports.config.features.enableRedisCache,
        },
        logLevel: exports.config.logging.level,
        frontendUrl: exports.config.frontend.url,
    });
}
//# sourceMappingURL=index.js.map