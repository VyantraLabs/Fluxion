/**
 * Service Router Configuration
 * 
 * Provides a simple router that automatically adds SERVICE_BASE_PATH to all routes.
 * This ensures no route is accidentally unreachable due to missing base path.
 */

import { Express, Router } from 'express';
import { Logger } from '../utils/logger';

export interface ServiceConfig {
  /** Service name for logging */
  serviceName: string;
  /** Express app instance */
  app: Express;
  /** Base path from environment or default */
  basePath?: string;
  /** Logger instance */
  logger?: Logger;
}

export interface RouteConfig {
  /** Route path (will be prefixed with base path automatically) */
  path: string;
  /** Express router for this route */
  router: Router;
  /** Description for logging */
  description?: string;
}

/**
 * Service Router that automatically adds base path to all routes
 */
export class ServiceRouter {
  private app: Express;
  private basePath: string;
  private logger: Logger;
  private serviceName: string;

  constructor(config: ServiceConfig) {
    this.app = config.app;
    this.serviceName = config.serviceName;
    this.basePath = config.basePath || process.env.SERVICE_BASE_PATH || `/api/v1/${config.serviceName}-service`;
    this.logger = config.logger || new Logger(`${config.serviceName}-router`);

    this.logger.info(`Service router initialized`, {
      serviceName: this.serviceName,
      basePath: this.basePath,
      configuredViaEnv: !!process.env.SERVICE_BASE_PATH
    });
  }

  /**
   * Mount routes under the service base path
   * All routes are automatically prefixed with SERVICE_BASE_PATH
   */
  mountRoutes(routes: RouteConfig[]): void {
    routes.forEach(route => {
      const fullPath = `${this.basePath}${route.path}`;
      this.app.use(fullPath, route.router);
      
      this.logger.info(`Route mounted`, {
        originalPath: route.path,
        fullPath: fullPath,
        description: route.description || 'No description provided'
      });
    });
  }

  /**
   * Mount a single route under the service base path
   */
  mountRoute(path: string, router: Router, description?: string): void {
    this.mountRoutes([{ path, router, description }]);
  }

  /**
   * Get the configured base path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Get full path for a route (base path + route path)
   */
  getFullPath(routePath: string): string {
    return `${this.basePath}${routePath}`;
  }

  /**
   * Mount standard service endpoints (health, metrics, info)
   * These are automatically made available and prefixed with base path
   */
  mountStandardEndpoints(options: {
    healthHandler?: (req: any, res: any) => void | Promise<void>;
    metricsHandler?: (req: any, res: any) => void;
    infoHandler?: (req: any, res: any) => void;
  } = {}): void {
    
    // Health endpoint
    if (options.healthHandler) {
      this.app.get(this.getFullPath('/health'), options.healthHandler);
      this.logger.info('Standard endpoint mounted', { 
        endpoint: 'health', 
        path: this.getFullPath('/health') 
      });
    }

    // Metrics endpoint
    if (options.metricsHandler) {
      this.app.get(this.getFullPath('/metrics'), options.metricsHandler);
      this.logger.info('Standard endpoint mounted', { 
        endpoint: 'metrics', 
        path: this.getFullPath('/metrics') 
      });
    }

    // Info endpoint
    if (options.infoHandler) {
      this.app.get(this.getFullPath('/info'), options.infoHandler);
    } else {
      // Default info handler
      this.app.get(this.getFullPath('/info'), this.createDefaultInfoHandler());
    }
    this.logger.info('Standard endpoint mounted', { 
      endpoint: 'info', 
      path: this.getFullPath('/info') 
    });
  }

  /**
   * Create default info handler
   */
  private createDefaultInfoHandler() {
    return (req: any, res: any) => {
      const serviceInfo = {
        service: `${this.serviceName} Service`,
        basePath: this.basePath,
        timestamp: new Date().toISOString(),
        version: process.env.VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
          health: this.getFullPath('/health'),
          metrics: this.getFullPath('/metrics'),
          info: this.getFullPath('/info')
        }
      };

      res.json({
        success: true,
        data: serviceInfo,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    };
  }

  /**
   * Log all mounted routes (useful for debugging)
   */
  logRoutes(): void {
    this.logger.info('Service routes summary', {
      serviceName: this.serviceName,
      basePath: this.basePath,
      note: 'All business logic routes are mounted under this base path'
    });
  }
}

/**
 * Factory function to create a service router
 */
export function createServiceRouter(config: ServiceConfig): ServiceRouter {
  return new ServiceRouter(config);
}

/**
 * Helper function to create route config
 */
export function createRoute(path: string, router: Router, description?: string): RouteConfig {
  return { path, router, description };
}