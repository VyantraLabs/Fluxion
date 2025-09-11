/**
 * Local development server
 * This file is used to run the Lambda function locally for development
 */

// Load configuration first
import { config } from '@/config';
import { app } from './index';
import { Logger } from '@/shared/utils/logger';

const logger = new Logger('LocalServer');

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

logger.info('Starting Fluxion API in local development mode', {
  port: config.port,
  environment: config.environment,
  database: config.database.database,
  frontend_url: config.frontend.url,
  log_level: config.logging.level
});

app.listen(config.port, () => {
  logger.info(`🚀 Fluxion API server is running!`, {
    port: config.port,
    environment: config.environment,
    health_check: `http://localhost:${config.port}/health`,
    api_docs: `http://localhost:${config.port}/`,
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handling for development
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { error: error.message, stack: error.stack });
  process.exit(1);
});