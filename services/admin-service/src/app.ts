import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from '@fluxion/shared-lib/utils/logger';
import { 
  requestLogger, 
  corsHandler, 
  rateLimit, 
  errorHandler, 
  notFoundHandler,
  responseHelpers,
  asyncHandler
} from '@fluxion/shared-lib/middleware';
import { APIResponse } from '@fluxion/shared-lib/types/common';
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

// Setup Swagger documentation (only in non-production environments)
if (process.env.NODE_ENV !== 'production') {
  setupSwagger(app);
}

// Rate limiting - stricter for admin service
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // Stricter limit for admin endpoints
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

// Health check endpoint
app.get('/health', asyncHandler(async (_req: Request, res: Response) => {
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
}));

// Get configurable base path from environment
const ADMIN_BASE_PATH = process.env.ADMIN_BASE_PATH || '/admin';
logger.info('Configuring admin routes', { basePath: ADMIN_BASE_PATH });

// API routes for admin service with configurable base path
app.use(ADMIN_BASE_PATH, adminRoutes);
app.use(`${ADMIN_BASE_PATH}/organizations`, organizationRoutes); 
app.use(`${ADMIN_BASE_PATH}/analytics`, analyticsRoutes);
app.use(`${ADMIN_BASE_PATH}/jobs`, jobRoutes);
app.use(`${ADMIN_BASE_PATH}/notifications`, notificationRoutes);

// API info endpoint
app.get('/', (req, res) => {
  const apiInfo = {
    service: 'Fluxion Admin Service',
    version: process.env.VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    description: 'Admin API service for system administration',
    base_path: ADMIN_BASE_PATH,
    endpoints: {
      admin: {
        base: ADMIN_BASE_PATH,
        description: 'System administration operations',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      organizations: {
        base: `${ADMIN_BASE_PATH}/organizations`,
        description: 'Multi-organization management',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      analytics: {
        base: `${ADMIN_BASE_PATH}/analytics`,
        description: 'System-wide analytics and reporting',
        methods: ['GET', 'POST']
      },
      jobs: {
        base: `${ADMIN_BASE_PATH}/jobs`,
        description: 'Background job management',
        methods: ['GET', 'POST', 'PUT']
      },
      notifications: {
        base: `${ADMIN_BASE_PATH}/notifications`,
        description: 'Notification system management',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    },
    port: process.env.PORT || 3001
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

// Metrics endpoint
app.get('/metrics', (_req, res) => {
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
      port: process.env.PORT || 3001
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