import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { 
  Logger, 
  requestLogger, 
  corsHandler, 
  rateLimit, 
  errorHandler, 
  notFoundHandler,
  responseHelpers,
  asyncHandler,
  APIResponse,
  createJWTAuth,
  createServiceRouter,
  createRoute
} from '@fluxion/shared-lib';
import { setupSwagger } from './config/swagger';

// Import route handlers for main service
import { invoiceRoutes } from './modules/invoices/handlers';
import { paymentRoutes } from './modules/payments/handlers';
import { userRoutes } from './modules/users/handlers';
import { organizationRoutes } from './modules/organizations/handlers';
import { templateRoutes } from './modules/templates/handlers';
import { publicRoutes } from './modules-legacy/public/handlers';
import { dashboardRoutes } from './modules/dashboard/handlers';
import { configRoutes } from './modules/config/handlers';
import { reminderRoutes } from './modules/reminders/handlers';

// Admin routes removed - admin functionality moved to admin-service

// Initialize audit event system
import { auditConsumerRegistry } from './shared/services/audit-consumers';

const logger = new Logger('MainService');

// Initialize audit system on startup
let auditInitialized = false;
const initializeAuditSystem = async () => {
  if (!auditInitialized) {
    try {
      await auditConsumerRegistry.initialize();
      auditInitialized = true;
      logger.info('Audit event system initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize audit event system', {
        error: error.message
      });
      // Don't fail startup for audit system issues
    }
  }
};

// Initialize on module load
initializeAuditSystem().catch(error => {
  logger.error('Background audit system initialization failed', { error: error.message });
});

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

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: process.env.NODE_ENV === 'production' ? 100 : 1000,
  skipSuccessfulRequests: false
}));

// Create service router - automatically handles SERVICE_BASE_PATH
const serviceRouter = createServiceRouter({
  serviceName: 'main',
  app,
  logger
});

// Authentication - configure public paths using the service router's base path
const auth = createJWTAuth({
  secret: process.env.JWT_SECRET,
  publicPaths: [
    serviceRouter.getFullPath('/health'),
    serviceRouter.getFullPath('/docs'),
    serviceRouter.getFullPath('/swagger'),
    serviceRouter.getFullPath('/users/auth/message'),
    serviceRouter.getFullPath('/users/auth/verify'),
    serviceRouter.getFullPath('/public/*'),
    '/api' // Service info endpoint at base path
  ],
  skipInDevelopment: false
});

app.use(auth);

// Setup Swagger documentation (only in non-production environments)
if (process.env.NODE_ENV !== 'production') {
  setupSwagger(app, serviceRouter.getBasePath() + '/docs');
}

// Initialize database connection on startup
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

const initializeDatabase = async () => {
  if (dbInitialized) return;
  if (dbInitPromise) return dbInitPromise;
  
  dbInitPromise = (async () => {
    try {
      const { dbManager } = await import('./database/data-source');
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

// Mount standard service endpoints (health, metrics, info) - automatically prefixed with base path
serviceRouter.mountStandardEndpoints({
  healthHandler: asyncHandler(async (_req: Request, res: Response) => {
    await initializeDatabase();
    
    const { getDatabase } = await import('./shared/database/client');
    const { getBlockchainService } = await import('./shared/blockchain/client');
    const { getNotificationService } = await import('./shared/notifications/client');

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
      service_name: 'main-service',
      memory_usage: process.memoryUsage(),
      uptime: process.uptime()
    };

    logger.info('Health check completed', { status: overallStatus, services });
    res.success(healthStatus, overallStatus === 'healthy' ? 200 : 503);
  }),
  
  metricsHandler: (_req: Request, res: Response) => {
    const metrics = {
      timestamp: new Date().toISOString(),
      service: 'main-service',
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
        port: process.env.PORT
      }
    };

    res.json(metrics);
  }
});

// Mount all business logic routes - automatically prefixed with SERVICE_BASE_PATH
serviceRouter.mountRoutes([
  createRoute('/invoices', invoiceRoutes, 'Invoice management operations'),
  createRoute('/payments', paymentRoutes, 'Payment verification and tracking'),
  createRoute('/users', userRoutes, 'User authentication and management'),
  createRoute('/user', userRoutes, 'Authenticated user profile operations'),
  createRoute('/organizations', organizationRoutes, 'Organization management'),
  createRoute('/templates', templateRoutes, 'Invoice template management'),
  createRoute('/public', publicRoutes, 'Public access endpoints'),
  createRoute('/dashboard', dashboardRoutes, 'Dashboard data and analytics'),
  createRoute('/config', configRoutes, 'Service configuration endpoints'),
  createRoute('/reminders', reminderRoutes, 'Invoice reminder management'),
  // Admin routes removed - functionality moved to admin-service on port 3001
]);

// Log all mounted routes for verification
serviceRouter.logRoutes();

// Service info endpoint at /api base path
app.get('/api', (_req: Request, res: Response) => {
  const serviceInfo = {
    service: 'main-service',
    version: process.env.VERSION || '1.0.0',
    endpoints: {
      health: '/api/health',
      metrics: '/api/metrics',
      docs: '/api/docs',
      users: '/api/users',
      invoices: '/api/invoices',
      payments: '/api/payments',
      templates: '/api/templates',
      organizations: '/api/organizations'
    }
  };
  res.json(serviceInfo);
});

// Legacy root endpoint for backward compatibility (DEPRECATED - will be removed)
app.get('/', (req, res) => {
  const basePath = serviceRouter.getBasePath();
  const apiInfo = {
    service: 'Fluxion Main Service',
    version: process.env.VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    description: 'Main API service for user-facing operations',
    base_path: basePath,
    endpoints: {
      service_info: serviceRouter.getFullPath('/info'),
      health: serviceRouter.getFullPath('/health'),
      metrics: serviceRouter.getFullPath('/metrics'),
      documentation: serviceRouter.getFullPath('/docs'),
      invoices: {
        base: serviceRouter.getFullPath('/invoices'),
        description: 'Invoice management operations for authenticated users',
        methods: ['GET', 'POST', 'PUT']
      },
      payments: {
        base: serviceRouter.getFullPath('/payments'),
        description: 'Payment verification and tracking',
        methods: ['GET', 'POST']
      },
      authentication: {
        base: serviceRouter.getFullPath('/users'),
        description: 'User authentication (signup, login)',
        methods: ['POST']
      },
      user: {
        base: serviceRouter.getFullPath('/user'),
        description: 'Authenticated user profile and data',
        methods: ['GET', 'PUT', 'DELETE']
      },
      organizations: {
        base: serviceRouter.getFullPath('/organizations'),
        description: 'Organization management and user permissions',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      templates: {
        base: serviceRouter.getFullPath('/templates'),
        description: 'Invoice templates management',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      public: {
        base: serviceRouter.getFullPath('/public'),
        description: 'Public access endpoints',
        methods: ['GET']
      },
      dashboard: {
        base: serviceRouter.getFullPath('/dashboard'),
        description: 'User dashboard data and statistics',
        methods: ['GET']
      },
      reminders: {
        base: serviceRouter.getFullPath('/reminders'),
        description: 'Invoice reminder management and scheduling',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    },
    port: process.env.PORT || 3000
  };

  const response: APIResponse = {
    success: true,
    data: apiInfo,
    meta: {
      requestId: (req as any).context?.requestId || 'unknown',
      timestamp: new Date().toISOString()
    }
  };

  logger.info('Legacy API info requested');
  res.json(response);
});

// Legacy metrics endpoint for backward compatibility
app.get('/metrics', (req: Request, res: Response) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    service: 'main-service',
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
      port: process.env.PORT
    }
  };

  res.json(metrics);
});

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  try {
    await auditConsumerRegistry.shutdown();
    logger.info('Audit system shut down successfully');
  } catch (error: any) {
    logger.error('Failed to shutdown audit system', { error: error.message });
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  try {
    await auditConsumerRegistry.shutdown();
    logger.info('Audit system shut down successfully');
  } catch (error: any) {
    logger.error('Failed to shutdown audit system', { error: error.message });
  }
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