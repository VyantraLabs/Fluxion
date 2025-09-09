import express, { Request, Response } from 'express';
import serverless from 'serverless-http';
import helmet from 'helmet';
import { Logger } from '@/shared/utils/logger';
import { 
  requestLogger, 
  corsHandler, 
  rateLimit, 
  errorHandler, 
  notFoundHandler,
  responseHelpers,
  asyncHandler
} from '@/shared/middleware';
import { APIResponse } from '@/types/common';
import { setupSwagger } from '@/config/swagger';

// Import route handlers
import { invoiceRoutes } from '@/modules/invoices/handlers';
import { paymentRoutes } from '@/modules/payments/handlers';
import { userRoutes } from '@/modules/users/handlers';
import { analyticsRoutes } from '@/modules/analytics/handlers';
import { configRoutes } from '@/modules/config/handlers';
import { templateRoutes } from '@/modules/templates/handlers';
import { publicRoutes } from '@/modules/public/handlers';
import { adminRoutes } from '@/modules/admin/handlers';
import { notificationRoutes } from '@/modules/notifications/handlers';
import { jobRoutes } from '@/modules/jobs/handlers';
import { reminderRoutes } from '@/modules/reminders/handlers';

const logger = new Logger('MainLambda');

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow for API usage
  crossOriginEmbedderPolicy: false
}));

// Global middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(corsHandler);
app.use(requestLogger);
app.use(responseHelpers);

// Setup Swagger documentation (only in non-production environments)
if (process.env.NODE_ENV !== 'production') {
  setupSwagger(app);
}

// Rate limiting - more restrictive for production
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: process.env.NODE_ENV === 'production' ? 100 : 1000, // 100 requests per 15 minutes in prod
  skipSuccessfulRequests: false
}));

// Initialize database connection on startup
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

const initializeDatabase = async () => {
  if (dbInitialized) return;
  if (dbInitPromise) return dbInitPromise;
  
  dbInitPromise = (async () => {
    try {
      const { dbManager } = await import('@/database/data-source');
      await dbManager.connect();
      dbInitialized = true;
      logger.info('Database connection initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize database connection', { error: error.message });
      throw error;
    }
  })();
  
  return dbInitPromise;
};

// Initialize database immediately
initializeDatabase().catch(error => {
  logger.error('Startup database initialization failed', { error: error.message });
});

// Health check endpoint (must be before other routes)
app.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  // Ensure database is initialized
  await initializeDatabase();
  
  // Import services dynamically to avoid circular dependencies
  const { getDatabase } = await import('@/shared/database/client');
  const { getBlockchainService } = await import('@/shared/blockchain/client');
  const { getNotificationService } = await import('@/shared/notifications/client');

  // Test all services in parallel
  const [dbHealth, blockchainHealth, notificationHealth] = await Promise.allSettled([
    getDatabase().healthCheck(),
    getBlockchainService().healthCheck(),
    getNotificationService().healthCheck()
  ]);

  const services = {
    database: dbHealth.status === 'fulfilled' ? dbHealth.value.status : 'unhealthy',
    blockchain: blockchainHealth.status === 'fulfilled' ? blockchainHealth.value.status : 'unhealthy',
    notifications: notificationHealth.status === 'fulfilled' ? notificationHealth.value.status : 'unhealthy'
  };

  const overallStatus = Object.values(services).every(s => s === 'healthy') ? 'healthy' : 'unhealthy';

  const healthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services,
    service_details: {
      database: dbHealth.status === 'fulfilled' ? { 
        latency: dbHealth.value.latency,
        error: dbHealth.value.error 
      } : { error: 'Service check failed' },
      blockchain: blockchainHealth.status === 'fulfilled' ? { 
        latency: blockchainHealth.value.latency,
        error: blockchainHealth.value.error 
      } : { error: 'Service check failed' },
      notifications: notificationHealth.status === 'fulfilled' ? { 
        latency: notificationHealth.value.latency,
        error: notificationHealth.value.error 
      } : { error: 'Service check failed' }
    },
    memory_usage: process.memoryUsage(),
    uptime: process.uptime()
  };

  logger.info('Health check completed', { status: overallStatus, services });
  res.success(healthStatus, overallStatus === 'healthy' ? 200 : 503);
}));

// API routes
app.use('/invoices', invoiceRoutes);
app.use('/payments', paymentRoutes);
app.use('/users', userRoutes); // Authentication endpoints (login, register)
app.use('/user', userRoutes);  // Authenticated user endpoints (profile, stats)
app.use('/templates', templateRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/config', configRoutes);
app.use('/public', publicRoutes);
app.use('/admin', adminRoutes);
app.use('/notifications', notificationRoutes);
app.use('/jobs', jobRoutes);
app.use('/reminders', reminderRoutes);

// API info endpoint
app.get('/', (req, res) => {
  const apiInfo = {
    service: 'Fluxion API',
    version: process.env.VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      invoices: {
        base: '/invoices',
        description: 'Invoice management operations for authenticated users',
        methods: ['GET', 'POST', 'PUT'],
        routes: [
          'GET /invoices - List user invoices',
          'POST /invoices - Create new invoice', 
          'GET /invoices/{id} - Get invoice details',
          'PUT /invoices/{id}/status - Update invoice status',
          'GET /invoices/{id}/share - Generate shareable link',
          'GET /invoices/{id}/public - Public invoice view (no auth)',
          'GET /invoices/stats - Invoice statistics'
        ]
      },
      payments: {
        base: '/payments',
        description: 'Payment verification and tracking',
        methods: ['GET', 'POST']
      },
      authentication: {
        base: '/users',
        description: 'User authentication (signup, login)',
        methods: ['POST'],
        routes: [
          'POST /users/auth/message - Generate auth challenge',
          'POST /users/auth/verify - Verify wallet signature',
          'POST /users/validate-address - Validate wallet format',
          'GET /users/platform/stats - Public platform statistics',
          'GET /users/exists/{wallet} - Check user existence'
        ]
      },
      user: {
        base: '/user',
        description: 'Authenticated user profile and data',
        methods: ['GET', 'PUT', 'DELETE'],
        routes: [
          'GET /user/profile - Get authenticated user profile',
          'PUT /user/profile - Update user profile',  
          'DELETE /user/profile - Delete user account',
          'GET /user/stats - Get user statistics'
        ]
      },
      analytics: {
        base: '/analytics', 
        description: 'Analytics and reporting',
        methods: ['GET', 'POST']
      },
      config: {
        base: '/config',
        description: 'Blockchain networks and tokens configuration',
        methods: ['GET'],
        subRoutes: [
          '/config/networks',
          '/config/networks/{chainId}',
          '/config/tokens', 
          '/config/tokens/{chainId}',
          '/config/app-config',
          '/config/summary'
        ]
      },
      reminders: {
        base: '/reminders',
        description: 'Invoice reminder scheduling and management',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        routes: [
          'GET /reminders - List reminders',
          'POST /reminders - Create reminder',
          'GET /reminders/{id} - Get reminder details',
          'PUT /reminders/{id} - Update reminder',
          'DELETE /reminders/{id} - Cancel reminder',
          'POST /reminders/{id}/execute - Manually execute reminder',
          'GET /reminders/invoice/{invoiceId} - Get invoice reminders',
          'POST /reminders/invoice/{invoiceId}/setup - Setup default reminders',
          'POST /reminders/bulk/create - Create bulk reminders',
          'GET /reminders/stats - Get reminder statistics'
        ]
      }
    },
    supported_networks: ['Polygon'],
    supported_tokens: ['USDC'],
    documentation: {
      api_docs: '/api-docs',
      openapi_spec: '/api-docs.json',
      external_docs: process.env.DOCS_URL || 'https://docs.fluxion.pay'
    }
  };

  const response: APIResponse = {
    success: true,
    data: apiInfo,
    meta: {
      requestId: req.context?.requestId || 'unknown',
      timestamp: new Date().toISOString()
    }
  };

  logger.info('API info requested');
  res.json(response);
});

// Metrics endpoint for monitoring
app.get('/metrics', (_req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    process: {
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage(),
      node_version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    environment: {
      node_env: process.env.NODE_ENV,
      aws_region: process.env.AWS_REGION,
      lambda_runtime: process.env.AWS_EXECUTION_ENV
    },
    lambda: {
      function_name: process.env.AWS_LAMBDA_FUNCTION_NAME,
      function_version: process.env.AWS_LAMBDA_FUNCTION_VERSION,
      memory_size: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
      timeout: process.env.AWS_LAMBDA_FUNCTION_TIMEOUT
    }
  };

  res.json(metrics);
});

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Export Lambda handler
export const handler = serverless(app, {
  // Configure serverless-http options
  binary: ['image/*', 'application/pdf'],
  request: (request: any, event: any, context: any) => {
    // Add Lambda context to request
    request.lambda = {
      event,
      context
    };
    
    // Set request ID from Lambda context
    if (context.awsRequestId) {
      process.env.AWS_REQUEST_ID = context.awsRequestId;
    }

    logger.info('Lambda request received', {
      path: request.path,
      method: request.method,
      requestId: context.awsRequestId,
      functionName: context.functionName,
      functionVersion: context.functionVersion
    });
  }
});

// Export app for local development (local.ts will handle starting the server)

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise: promise.toString() });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

export { app };