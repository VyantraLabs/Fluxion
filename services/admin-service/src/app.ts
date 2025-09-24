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
  requireSystemAdmin,
  createServiceRouter,
  createRoute
} from '@fluxion/shared-lib';
import { setupSwagger } from './config/swagger';

// Import route modules for admin service
import { adminRoutes } from './modules/admin/handlers';
import { organizationRoutes } from './modules/organizations/handlers';
import { analyticsRoutes } from './modules/analytics/handlers';
import { jobRoutes } from './modules/jobs/handlers';
import { notificationRoutes } from './modules/notifications/handlers';

// Initialize audit event system
import { auditConsumerRegistry } from './shared/services/audit-consumers';

const logger = new Logger('AdminService');

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

// Rate limiting - stricter for admin service
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // Stricter limit for admin endpoints
  skipSuccessfulRequests: false
}));

// Create service router - automatically handles SERVICE_BASE_PATH
const serviceRouter = createServiceRouter({
  serviceName: 'admin',
  app,
  logger
});

// Authentication - admin service requires stricter auth by default
const auth = createJWTAuth({
  secret: process.env.JWT_SECRET,
  publicPaths: [
    serviceRouter.getFullPath('/health'),
    serviceRouter.getFullPath('/docs'),
    serviceRouter.getFullPath('/swagger'),
    serviceRouter.getFullPath('/admin/auth/login'),
    '/', // Legacy root endpoint
    '/health', // Legacy health endpoint
    '/metrics' // Legacy metrics endpoint
  ],
  skipInDevelopment: false
});

app.use(auth);

// Setup Swagger documentation (only in non-production environments)
if (process.env.NODE_ENV !== 'production') {
  setupSwagger(app, serviceRouter.getBasePath());
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
    const { getNotificationService } = await import('./shared/notifications/client');

    const [dbHealth, notificationHealth] = await Promise.allSettled([
      getDatabase().healthCheck(),
      getNotificationService().healthCheck()
    ]);

    const services = {
      database: dbHealth.status === 'fulfilled' ? dbHealth.value.status : 'unhealthy',
      notifications: notificationHealth.status === 'fulfilled' ? notificationHealth.value.status : 'unhealthy'
    };

    const overallStatus = Object.values(services).every(s => s === 'healthy') ? 'healthy' : 'unhealthy';

    const healthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      service_name: 'admin-service',
      memory_usage: process.memoryUsage(),
      uptime: process.uptime()
    };

    logger.info('Health check completed', { status: overallStatus, services });
    res.success(healthStatus, overallStatus === 'healthy' ? 200 : 503);
  }),
  
  metricsHandler: (_req: Request, res: Response) => {
    const metrics = {
      timestamp: new Date().toISOString(),
      service: 'admin-service',
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

// Create admin-only middleware wrapper for routes that need system admin access
const adminOnlyRouter = (router: any) => {
  const wrappedRouter = express.Router();
  wrappedRouter.use(requireSystemAdmin());
  wrappedRouter.use(router);
  return wrappedRouter;
};

// Mount all business logic routes - automatically prefixed with SERVICE_BASE_PATH
serviceRouter.mountRoutes([
  createRoute('/admin', adminOnlyRouter(adminRoutes), 'System administration operations (admin only)'),
  createRoute('/organizations', organizationRoutes, 'Multi-organization management'),
  createRoute('/analytics', adminOnlyRouter(analyticsRoutes), 'System-wide analytics and reporting (admin only)'),
  createRoute('/jobs', adminOnlyRouter(jobRoutes), 'Background job management (admin only)'),
  createRoute('/notifications', adminOnlyRouter(notificationRoutes), 'Notification system management (admin only)')
]);

// Log all mounted routes for verification
serviceRouter.logRoutes();

// Legacy root endpoint for backward compatibility
app.get('/', (req, res) => {
  const basePath = serviceRouter.getBasePath();
  const apiInfo = {
    service: 'Fluxion Admin Service',
    version: process.env.VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    description: 'Admin API service for system administration',
    base_path: basePath,
    endpoints: {
      service_info: serviceRouter.getFullPath('/info'),
      health: serviceRouter.getFullPath('/health'),
      metrics: serviceRouter.getFullPath('/metrics'),
      documentation: serviceRouter.getFullPath('/docs'),
      admin: {
        base: serviceRouter.getFullPath('/admin'),
        description: 'System administration operations (requires system admin)',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      organizations: {
        base: serviceRouter.getFullPath('/organizations'),
        description: 'Multi-organization management',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      analytics: {
        base: serviceRouter.getFullPath('/analytics'),
        description: 'System-wide analytics and reporting (requires system admin)',
        methods: ['GET', 'POST']
      },
      jobs: {
        base: serviceRouter.getFullPath('/jobs'),
        description: 'Background job management (requires system admin)',
        methods: ['GET', 'POST', 'PUT']
      },
      notifications: {
        base: serviceRouter.getFullPath('/notifications'),
        description: 'Notification system management (requires system admin)',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    },
    port: process.env.PORT || 3001
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
    service: 'admin-service',
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