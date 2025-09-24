import { ServiceAuthConfig, RouteAuthConfig, AuthMiddlewareOptions } from './types';

/**
 * Default authentication configuration for services
 */
export const DEFAULT_AUTH_CONFIG: ServiceAuthConfig = {
  defaultAuth: {
    requireAuth: true,
    optional: false
  },
  publicRoutes: [
    '/health',
    '/docs',
    '/swagger',
    '/api-docs',
    '/favicon.ico',
    '/robots.txt'
  ],
  routeConfigs: {},
  options: {
    jwtExpiresIn: '24h',
    developmentMode: process.env.NODE_ENV === 'development',
    skipSignatureValidation: false,
    corsOrigins: ['http://localhost:3000', 'http://localhost:3001'],
    enableSessions: false,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    globalRateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  }
};

/**
 * Pre-configured route patterns for common authentication scenarios
 */
export const ROUTE_PATTERNS = {
  // Public routes (no authentication)
  PUBLIC: {
    requireAuth: false
  } as RouteAuthConfig,

  // Optional authentication (populate auth if present)
  OPTIONAL_AUTH: {
    requireAuth: false,
    optional: true
  } as RouteAuthConfig,

  // Standard authentication required
  AUTHENTICATED: {
    requireAuth: true
  } as RouteAuthConfig,

  // Admin-level access
  ADMIN_ONLY: {
    requireAuth: true,
    roles: {
      roles: ['admin', 'owner'],
      organizationSpecific: true
    }
  } as RouteAuthConfig,

  // Owner-level access
  OWNER_ONLY: {
    requireAuth: true,
    roles: {
      roles: ['owner'],
      organizationSpecific: true
    }
  } as RouteAuthConfig,

  // System admin access
  SYSTEM_ADMIN: {
    requireAuth: true,
    systemAdminOnly: true
  } as RouteAuthConfig,

  // Cross-organization access
  CROSS_ORG_ACCESS: {
    requireAuth: true,
    crossOrgAccess: true,
    systemAdminOnly: true
  } as RouteAuthConfig,

  // Invoice management permissions
  INVOICE_READ: {
    requireAuth: true,
    permissions: {
      permissions: ['invoice:read'],
      organizationSpecific: true
    }
  } as RouteAuthConfig,

  INVOICE_WRITE: {
    requireAuth: true,
    permissions: {
      permissions: ['invoice:write'],
      organizationSpecific: true
    }
  } as RouteAuthConfig,

  INVOICE_DELETE: {
    requireAuth: true,
    permissions: {
      permissions: ['invoice:delete'],
      organizationSpecific: true
    }
  } as RouteAuthConfig,

  // Payment management permissions
  PAYMENT_READ: {
    requireAuth: true,
    permissions: {
      permissions: ['payment:read'],
      organizationSpecific: true
    }
  } as RouteAuthConfig,

  PAYMENT_PROCESS: {
    requireAuth: true,
    permissions: {
      permissions: ['payment:process'],
      organizationSpecific: true
    }
  } as RouteAuthConfig,

  // User management permissions
  USER_READ: {
    requireAuth: true,
    permissions: {
      permissions: ['user:read'],
      organizationSpecific: true
    }
  } as RouteAuthConfig,

  USER_MANAGE: {
    requireAuth: true,
    permissions: {
      permissions: ['user:manage'],
      organizationSpecific: true
    }
  } as RouteAuthConfig,

  // Analytics and reporting
  ANALYTICS_READ: {
    requireAuth: true,
    permissions: {
      permissions: ['analytics:read'],
      organizationSpecific: true
    }
  } as RouteAuthConfig,

  // Template management
  TEMPLATE_READ: {
    requireAuth: true,
    permissions: {
      permissions: ['template:read'],
      organizationSpecific: true
    }
  } as RouteAuthConfig,

  TEMPLATE_WRITE: {
    requireAuth: true,
    permissions: {
      permissions: ['template:write'],
      organizationSpecific: true
    }
  } as RouteAuthConfig
};

/**
 * Service-specific authentication configurations
 */
export const SERVICE_CONFIGS = {
  /**
   * Main API service configuration
   */
  MAIN_SERVICE: {
    ...DEFAULT_AUTH_CONFIG,
    publicRoutes: [
      ...DEFAULT_AUTH_CONFIG.publicRoutes,
      '/users/auth/message',
      '/users/auth/verify',
      '/invoice/public/*',
      '/health/check'
    ],
    routeConfigs: {
      // Authentication endpoints
      'POST /users/auth/message': ROUTE_PATTERNS.PUBLIC,
      'POST /users/auth/verify': ROUTE_PATTERNS.PUBLIC,
      'POST /users/auth/refresh': ROUTE_PATTERNS.AUTHENTICATED,

      // Public invoice access
      'GET /invoice/public/:token': ROUTE_PATTERNS.PUBLIC,
      'POST /invoice/public/:token/pay': ROUTE_PATTERNS.PUBLIC,

      // Invoice management
      'GET /invoices': ROUTE_PATTERNS.INVOICE_READ,
      'POST /invoices': ROUTE_PATTERNS.INVOICE_WRITE,
      'GET /invoices/:id': ROUTE_PATTERNS.INVOICE_READ,
      'PUT /invoices/:id': ROUTE_PATTERNS.INVOICE_WRITE,
      'DELETE /invoices/:id': ROUTE_PATTERNS.INVOICE_DELETE,

      // Payment endpoints
      'GET /payments': ROUTE_PATTERNS.PAYMENT_READ,
      'POST /invoices/:id/pay': ROUTE_PATTERNS.PAYMENT_PROCESS,

      // User management
      'GET /users': ROUTE_PATTERNS.USER_READ,
      'GET /users/:id': ROUTE_PATTERNS.USER_READ,
      'PUT /users/:id': ROUTE_PATTERNS.USER_MANAGE,

      // Dashboard and analytics
      'GET /dashboard/stats': ROUTE_PATTERNS.ANALYTICS_READ,
      'GET /dashboard/activity': ROUTE_PATTERNS.ANALYTICS_READ,

      // Templates
      'GET /templates': ROUTE_PATTERNS.TEMPLATE_READ,
      'POST /templates': ROUTE_PATTERNS.TEMPLATE_WRITE,
      'PUT /templates/:id': ROUTE_PATTERNS.TEMPLATE_WRITE,
      'DELETE /templates/:id': ROUTE_PATTERNS.TEMPLATE_WRITE
    }
  } as ServiceAuthConfig,

  /**
   * Admin service configuration
   */
  ADMIN_SERVICE: {
    ...DEFAULT_AUTH_CONFIG,
    defaultAuth: {
      requireAuth: true,
      optional: false
    },
    publicRoutes: [
      ...DEFAULT_AUTH_CONFIG.publicRoutes,
      '/admin/auth/login',
      '/admin/health'
    ],
    routeConfigs: {
      // Admin authentication
      'POST /admin/auth/login': ROUTE_PATTERNS.PUBLIC,
      'POST /admin/auth/logout': ROUTE_PATTERNS.AUTHENTICATED,

      // System administration
      'GET /admin/system/stats': ROUTE_PATTERNS.SYSTEM_ADMIN,
      'GET /admin/users': ROUTE_PATTERNS.SYSTEM_ADMIN,
      'POST /admin/users': ROUTE_PATTERNS.SYSTEM_ADMIN,
      'PUT /admin/users/:id': ROUTE_PATTERNS.SYSTEM_ADMIN,

      // Organization management
      'GET /admin/organizations': ROUTE_PATTERNS.CROSS_ORG_ACCESS,
      'POST /admin/organizations': ROUTE_PATTERNS.SYSTEM_ADMIN,
      'PUT /admin/organizations/:id': ROUTE_PATTERNS.CROSS_ORG_ACCESS,

      // Audit logs
      'GET /admin/audit-logs': ROUTE_PATTERNS.SYSTEM_ADMIN,

      // System configuration
      'GET /admin/config': ROUTE_PATTERNS.SYSTEM_ADMIN,
      'PUT /admin/config': ROUTE_PATTERNS.SYSTEM_ADMIN
    }
  } as ServiceAuthConfig,

  /**
   * Notification service configuration
   */
  NOTIFICATION_SERVICE: {
    ...DEFAULT_AUTH_CONFIG,
    defaultAuth: {
      requireAuth: true,
      optional: false
    },
    publicRoutes: [
      ...DEFAULT_AUTH_CONFIG.publicRoutes,
      '/webhooks/*'
    ],
    routeConfigs: {
      // Webhook endpoints (external services)
      'POST /webhooks/stripe': ROUTE_PATTERNS.PUBLIC,
      'POST /webhooks/sendgrid': ROUTE_PATTERNS.PUBLIC,

      // Notification management
      'GET /notifications': ROUTE_PATTERNS.AUTHENTICATED,
      'POST /notifications/send': ROUTE_PATTERNS.AUTHENTICATED,
      'PUT /notifications/:id/read': ROUTE_PATTERNS.AUTHENTICATED,

      // Admin notification management
      'GET /admin/notifications': ROUTE_PATTERNS.SYSTEM_ADMIN,
      'POST /admin/notifications/broadcast': ROUTE_PATTERNS.SYSTEM_ADMIN
    }
  } as ServiceAuthConfig
};

/**
 * Create a custom service configuration by merging with defaults
 */
export function createServiceConfig(
  serviceName: string,
  customConfig: Partial<ServiceAuthConfig>
): ServiceAuthConfig {
  const baseConfig = SERVICE_CONFIGS[serviceName as keyof typeof SERVICE_CONFIGS] || DEFAULT_AUTH_CONFIG;
  
  return {
    ...baseConfig,
    ...customConfig,
    defaultAuth: {
      ...baseConfig.defaultAuth,
      ...customConfig.defaultAuth
    },
    publicRoutes: [
      ...baseConfig.publicRoutes,
      ...(customConfig.publicRoutes || [])
    ],
    routeConfigs: {
      ...baseConfig.routeConfigs,
      ...customConfig.routeConfigs
    },
    options: {
      ...baseConfig.options,
      ...customConfig.options
    }
  };
}

/**
 * Utility function to check if a route should be public
 */
export function isPublicRoute(path: string, method: string, config: ServiceAuthConfig): boolean {
  // Check exact route match
  const routeKey = `${method.toUpperCase()} ${path}`;
  const routeConfig = config.routeConfigs[routeKey];
  
  if (routeConfig) {
    return !routeConfig.requireAuth;
  }

  // Check if path matches any public route pattern
  return config.publicRoutes.some(publicRoute => {
    if (publicRoute.includes('*')) {
      const pattern = publicRoute.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(path);
    }
    return path === publicRoute || path.startsWith(publicRoute);
  });
}

/**
 * Get route-specific authentication configuration
 */
export function getRouteAuthConfig(
  path: string,
  method: string,
  config: ServiceAuthConfig
): RouteAuthConfig | null {
  const routeKey = `${method.toUpperCase()} ${path}`;
  return config.routeConfigs[routeKey] || null;
}

/**
 * Create middleware options from service configuration
 */
export function createMiddlewareOptions(
  path: string,
  method: string,
  config: ServiceAuthConfig
): AuthMiddlewareOptions {
  const routeConfig = getRouteAuthConfig(path, method, config);
  const isPublic = isPublicRoute(path, method, config);

  return {
    optional: isPublic || config.defaultAuth.optional,
    developmentMode: config.options.developmentMode,
    skipSignatureValidation: config.options.skipSignatureValidation,
    serviceConfig: config,
    routeAuth: routeConfig || undefined,
    enableAuditLog: true,
    logFailedAttempts: true
  };
}