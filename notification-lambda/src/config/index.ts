/**
 * Configuration management for Fluxion Notification Lambda
 * Handles environment variable loading, validation, and typed configuration
 */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';

/**
 * Load environment variables from .env file in development
 */
function loadEnvironmentVariables(): void {
  // Only load .env file in development mode
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    const envPath = path.resolve(process.cwd(), '.env');
    const result = loadEnv({ path: envPath });
    
    if (result.error && process.env.NODE_ENV === 'development') {
      console.warn(`Warning: Could not load .env file from ${envPath}. Using process environment variables.`);
    }
  }
}

/**
 * Notification Lambda Configuration Interface
 */
export interface Config {
  environment: string;
  port: number;
  aws: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    ses: {
      region: string;
      fromEmail: string;
      fromName: string;
    };
  };
  logging: {
    level: string;
  };
  smtp?: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
}

/**
 * Configuration validation errors
 */
class ConfigValidationError extends Error {
  constructor(message: string) {
    super(`Configuration validation error: ${message}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Get required environment variable with validation
 */
function getRequiredEnv(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value) {
    throw new ConfigValidationError(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Get number environment variable
 */
function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new ConfigValidationError(`Environment variable ${key} must be a valid number, got: ${value}`);
  }
  return parsed;
}

/**
 * Create and validate configuration
 */
function createConfig(): Config {
  // Load environment variables first
  loadEnvironmentVariables();
  
  const environment = getOptionalEnv('NODE_ENV', 'development');
  
  // Development vs Production defaults
  const isDevelopment = environment === 'development';
  
  try {
    const config: Config = {
      environment,
      port: getNumberEnv('PORT', 3001),
      
      aws: {
        region: getOptionalEnv('AWS_REGION', 'us-east-1'),
        accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Optional, will use IAM role in Lambda
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Optional, will use IAM role in Lambda
        ses: {
          region: getOptionalEnv('SES_REGION', getOptionalEnv('AWS_REGION', 'us-east-1')),
          fromEmail: getRequiredEnv(
            'FROM_EMAIL',
            isDevelopment ? 'noreply@localhost.dev' : undefined
          ),
          fromName: getOptionalEnv('FROM_NAME', 'Fluxion'),
        },
      },
      
      logging: {
        level: getOptionalEnv('LOG_LEVEL', isDevelopment ? 'debug' : 'info'),
      },
    };
    
    // Optional SMTP configuration (alternative to SES)
    if (process.env.SMTP_HOST) {
      config.smtp = {
        host: getRequiredEnv('SMTP_HOST'),
        port: getNumberEnv('SMTP_PORT', 587),
        user: getRequiredEnv('SMTP_USER'),
        pass: getRequiredEnv('SMTP_PASS'),
      };
    }
    
    // Additional validations
    validateConfiguration(config);
    
    return config;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.error('Configuration Error:', error.message);
      console.error('\nRequired environment variables:');
      console.error('- FROM_EMAIL (sender email address)');
      console.error('\nOptional environment variables:');
      console.error('- NODE_ENV (development|staging|production)');
      console.error('- PORT (default: 3001)');
      console.error('- AWS_REGION (default: us-east-1)');
      console.error('- SES_REGION (defaults to AWS_REGION)');
      console.error('- FROM_NAME (default: Fluxion)');
      console.error('- LOG_LEVEL (debug|info|warn|error)');
      console.error('\nSMTP Configuration (alternative to SES):');
      console.error('- SMTP_HOST');
      console.error('- SMTP_PORT (default: 587)');
      console.error('- SMTP_USER');
      console.error('- SMTP_PASS');
      console.error('\nAWS Credentials (optional, use IAM role in Lambda):');
      console.error('- AWS_ACCESS_KEY_ID');
      console.error('- AWS_SECRET_ACCESS_KEY');
      
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validate configuration values
 */
function validateConfiguration(config: Config): void {
  // Validate email format
  if (!isValidEmail(config.aws.ses.fromEmail)) {
    throw new ConfigValidationError(`FROM_EMAIL must be a valid email address, got: ${config.aws.ses.fromEmail}`);
  }
  
  // Validate logging level
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (!validLogLevels.includes(config.logging.level)) {
    throw new ConfigValidationError(`LOG_LEVEL must be one of: ${validLogLevels.join(', ')}. Got: ${config.logging.level}`);
  }
  
  // Validate SMTP configuration if provided
  if (config.smtp) {
    if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
      throw new ConfigValidationError('SMTP configuration requires SMTP_HOST, SMTP_USER, and SMTP_PASS');
    }
    
    if (config.smtp.port < 1 || config.smtp.port > 65535) {
      throw new ConfigValidationError(`SMTP_PORT must be between 1 and 65535, got: ${config.smtp.port}`);
    }
    
    if (!isValidEmail(config.smtp.user)) {
      console.warn(`Warning: SMTP_USER should typically be an email address, got: ${config.smtp.user}`);
    }
  }
  
  // Validate AWS region format
  if (!/^[a-z0-9-]+$/.test(config.aws.region)) {
    throw new ConfigValidationError(`AWS_REGION must be a valid AWS region format, got: ${config.aws.region}`);
  }
  
  // Validate sender name (no special characters that could break email headers)
  if (!/^[a-zA-Z0-9\s.-]+$/.test(config.aws.ses.fromName)) {
    throw new ConfigValidationError(`FROM_NAME contains invalid characters. Use only letters, numbers, spaces, dots, and hyphens. Got: ${config.aws.ses.fromName}`);
  }
}

/**
 * Check if string is a valid email address
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Create and export singleton configuration
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = createConfig();
  }
  return configInstance;
}

// Export configuration for immediate use
export const config = getConfig();

// Export for testing
export { ConfigValidationError };

// Log configuration summary (non-sensitive info only)
if (process.env.NODE_ENV !== 'test') {
  console.log('Fluxion Notification Lambda Configuration Loaded:', {
    environment: config.environment,
    port: config.port,
    region: config.aws.region,
    sesRegion: config.aws.ses.region,
    fromName: config.aws.ses.fromName,
    fromEmail: config.aws.ses.fromEmail.replace(/(.{3}).*@/, '$1***@'), // Mask email for privacy
    logLevel: config.logging.level,
    smtpConfigured: !!config.smtp,
  });
}