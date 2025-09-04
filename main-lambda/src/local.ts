/**
 * Local development server
 * This file is used to run the Lambda function locally for development
 */

// Load configuration first
import { config } from '@/config';
import { app } from './index';
import { Logger } from '@/shared/utils/logger';

const logger = new Logger('LocalServer');

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