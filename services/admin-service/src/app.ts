import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Logger } from './shared/utils/logger';
import { asyncHandler } from './shared/middleware';
import { APIResponse } from './types/common';
import { setupSwagger } from './config/swagger';

// Import route modules for admin service
import { adminRoutes } from './modules/admin/handlers';
import { organizationRoutes } from './modules/organizations/handlers';
import { analyticsRoutes } from './modules/analytics/handlers';
import { jobRoutes } from './modules/jobs/handlers';
import { notificationRoutes } from './modules/notifications/handlers';

// Initialize audit event system
// import { auditConsumerRegistry } from './shared/services/audit-consumers';
import {
  requestLogger,
  corsHandler,
  rateLimit,
  errorHandler,
  notFoundHandler,
  responseHelpers,
  authenticateJWT
} from './shared/middleware';

const logger = new Logger('AdminService');

// Create Express app with proper typing
const app: express.Application = express();

// Initialize audit system on startup - DISABLED TEMPORARILY
// let auditInitialized = false;
// const initializeAuditSystem = async () => {
//   if (!auditInitialized) {
//     try {
//       await auditConsumerRegistry.initialize();
//       auditInitialized = true;
//       logger.info('Audit event system initialized successfully');
//     } catch (error: any) {
//       logger.error('Failed to initialize audit event system', {
//         error: error.message
//       });
//       // Don't fail startup for audit system issues
//     }
//   }
// };
// 
// // Initialize on module load
// initializeAuditSystem().catch(error => {
//   logger.error('Background audit system initialization failed', { error: error.message });
// });

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow for API usage
  crossOriginEmbedderPolicy: false
}));

// Configure CORS
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:3002',
    'http://localhost:3003',
    'https://app.fluxion.pay',
    'https://admin.fluxion.pay'
  ],
  credentials: true
}));

// Global middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(responseHelpers);

// Rate limiting - stricter for admin service
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // Stricter limit for admin endpoints
  skipSuccessfulRequests: false
}));

// Setup Swagger documentation under /admin/docs (only in non-production environments)
if (process.env.NODE_ENV !== 'production') {
  setupSwagger(app as any, '/admin/docs');
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
      // Don't throw in development to allow fallback auth
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  })();
  
  return dbInitPromise;
};

// Initialize database immediately
initializeDatabase().catch(error => {
  logger.error('Startup database initialization failed', { error: error.message });
});

// Basic health endpoint under /admin
app.get('/admin/health', asyncHandler(async (_req: Request, res: Response) => {
  await initializeDatabase();
  
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    service_name: 'admin-service',
    memory_usage: process.memoryUsage(),
    uptime: process.uptime()
  };

  logger.info('Health check completed', { status: 'healthy' });
  res.status(200).json({ success: true, data: healthStatus });
}));
  
// Basic metrics endpoint under /admin
app.get('/admin/metrics', (_req: Request, res: Response) => {
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

// Root endpoint for API info
app.get('/', (_req, res) => {
  const apiInfo = {
    service: 'Fluxion Admin Service',
    version: process.env.VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    description: 'Admin API service for system administration',
    endpoints: {
      health: '/admin/health',
      metrics: '/admin/metrics',
      documentation: '/admin/docs',
      admin: {
        base: '/admin/api',
        description: 'System administration operations',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    },
    port: process.env.PORT || 3001
  };

  res.json(apiInfo);
});

// Service info endpoint at base path
app.get('/admin', (_req: Request, res: Response) => {
  const serviceInfo = {
    service: 'admin-service',
    version: process.env.VERSION || '1.0.0',
    endpoints: {
      health: '/admin/health',
      metrics: '/admin/metrics',
      docs: '/admin/docs',
      auth: '/admin/auth',
      system: {
        stats: '/admin/system/stats',
        health: '/admin/system/health'
      },
      users: '/admin/users',
      organizations: '/admin/organizations',
      'activity-logs': '/admin/activity-logs',
      templates: '/admin/templates',
      settings: '/admin/settings'
    }
  };
  res.json(serviceInfo);
});


// Mount all route modules with proper prefixes
app.use('/admin', adminRoutes);  // Includes auth routes internally
app.use('/organizations', organizationRoutes);
app.use('/admin/analytics', analyticsRoutes);
app.use('/admin/jobs', jobRoutes);
app.use('/admin/notifications', notificationRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  // try {
  //   await auditConsumerRegistry.shutdown();
  //   logger.info('Audit system shut down successfully');
  // } catch (error: any) {
  //   logger.error('Failed to shutdown audit system', { error: error.message });
  // }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  // try {
  //   await auditConsumerRegistry.shutdown();
  //   logger.info('Audit system shut down successfully');
  // } catch (error: any) {
  //   logger.error('Failed to shutdown audit system', { error: error.message });
  // }
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason, service: 'admin-service' });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { 
    error: error.message, 
    stack: error.stack,
    service: 'admin-service'
  });
  process.exit(1);
});

export { app };