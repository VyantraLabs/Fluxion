/**
 * Main Service Entry Point
 * Fluxion Main Service - User-facing API operations
 */

// Load configuration first
import { config } from './config';
import { app } from './app';
import { Logger } from '@fluxion/shared-lib/utils/logger';

const logger = new Logger('MainService');

// Validate critical environment variables at startup
function validateEnvironment() {
  const requiredEnvVars = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_PORT', 
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_DATABASE'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error('Missing required environment variables', {
      missingVariables: missingVars,
      nodeEnv: process.env.NODE_ENV
    });
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  logger.info('Environment validation passed', {
    jwtSecretLength: process.env.JWT_SECRET?.length || 0,
    dbHost: process.env.DB_HOST,
    dbPort: process.env.DB_PORT,
    dbDatabase: process.env.DB_DATABASE,
    nodeEnv: process.env.NODE_ENV
  });
}

// Validate environment before starting server
validateEnvironment();

const port = process.env.PORT || 3000;

logger.info('Starting Fluxion Main Service', {
  port,
  environment: config.environment,
  database: config.database.database,
  frontend_url: config.frontend.url,
  log_level: config.logging.level,
  service: 'main-service'
});

app.listen(port, () => {
  logger.info(`🚀 Fluxion Main Service is running!`, {
    port,
    environment: config.environment,
    health_check: `http://localhost:${port}/health`,
    api_docs: `http://localhost:${port}/api-docs`,
    service: 'main-service',
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handling for development
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason, service: 'main-service' });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { 
    error: error.message, 
    stack: error.stack,
    service: 'main-service'
  });
  process.exit(1);
});