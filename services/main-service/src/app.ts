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

// Import route handlers for main service
import { invoiceRoutes } from './modules/invoices/handlers';
import { paymentRoutes } from './modules/payments/handlers';
import { userRoutes } from './modules/users/handlers';
import { organizationRoutes } from './modules/organizations/handlers';
import { templateRoutes } from './modules/templates/handlers';
import { publicRoutes } from './modules/public/handlers';
import { dashboardRoutes } from './modules/dashboard/handlers';
import { configRoutes } from './modules/config/handlers';
import { reminderRoutes } from './modules/reminders/handlers';

// Import admin route handlers
import { adminRoutes } from './modules/admin/handlers';

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

// Setup Swagger documentation (only in non-production environments)
if (process.env.NODE_ENV !== 'production') {
  setupSwagger(app);
}

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: process.env.NODE_ENV === 'production' ? 100 : 1000,
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
}));

// Get configurable base paths from environment
const API_BASE_PATH = process.env.API_BASE_PATH || '/api';
const ADMIN_BASE_PATH = process.env.ADMIN_BASE_PATH || '/admin';
logger.info('Configuring API routes', { 
  mainBasePath: API_BASE_PATH,
  adminBasePath: ADMIN_BASE_PATH 
});

// API routes for main service with configurable base path
app.use(`${API_BASE_PATH}/invoices`, invoiceRoutes);
app.use(`${API_BASE_PATH}/payments`, paymentRoutes);
app.use(`${API_BASE_PATH}/users`, userRoutes); // Authentication endpoints
app.use(`${API_BASE_PATH}/user`, userRoutes);  // Authenticated user endpoints
app.use(`${API_BASE_PATH}/organizations`, organizationRoutes); // Organization management endpoints
app.use(`${API_BASE_PATH}/templates`, templateRoutes);
app.use(`${API_BASE_PATH}/public`, publicRoutes);
app.use(`${API_BASE_PATH}/dashboard`, dashboardRoutes);
app.use(`${API_BASE_PATH}/config`, configRoutes);
app.use(`${API_BASE_PATH}/reminders`, reminderRoutes);

// Admin routes with configurable base path
app.use(ADMIN_BASE_PATH, adminRoutes);

// API info endpoint
app.get('/', (req, res) => {
  const apiInfo = {
    service: 'Fluxion Main Service',
    version: process.env.VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    description: 'Main API service for user-facing operations',
    base_path: API_BASE_PATH,
    endpoints: {
      invoices: {
        base: `${API_BASE_PATH}/invoices`,
        description: 'Invoice management operations for authenticated users',
        methods: ['GET', 'POST', 'PUT']
      },
      payments: {
        base: `${API_BASE_PATH}/payments`,
        description: 'Payment verification and tracking',
        methods: ['GET', 'POST']
      },
      authentication: {
        base: `${API_BASE_PATH}/users`,
        description: 'User authentication (signup, login)',
        methods: ['POST']
      },
      user: {
        base: `${API_BASE_PATH}/user`,
        description: 'Authenticated user profile and data',
        methods: ['GET', 'PUT', 'DELETE']
      },
      organizations: {
        base: `${API_BASE_PATH}/organizations`,
        description: 'Organization management and user permissions',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      templates: {
        base: `${API_BASE_PATH}/templates`,
        description: 'Invoice templates management',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      public: {
        base: `${API_BASE_PATH}/public`,
        description: 'Public access endpoints',
        methods: ['GET']
      },
      dashboard: {
        base: `${API_BASE_PATH}/dashboard`,
        description: 'User dashboard data and statistics',
        methods: ['GET']
      },
      reminders: {
        base: `${API_BASE_PATH}/reminders`,
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
      port: process.env.PORT || 3000
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