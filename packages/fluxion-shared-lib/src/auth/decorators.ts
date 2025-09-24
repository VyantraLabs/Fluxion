import 'reflect-metadata';
import { RouteAuthConfig, PermissionRequirement, RoleRequirement, CustomAuthHandler } from './types';

// Metadata keys for storing auth configuration
const AUTH_METADATA_KEY = Symbol('auth:config');
const PUBLIC_METADATA_KEY = Symbol('auth:public');
const PERMISSIONS_METADATA_KEY = Symbol('auth:permissions');
const ROLES_METADATA_KEY = Symbol('auth:roles');
const SYSTEM_ADMIN_METADATA_KEY = Symbol('auth:system-admin');

/**
 * Mark a route as public (no authentication required)
 * @param optional - If true, auth will be attempted but not required
 */
export function Public(optional = false) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const authConfig: RouteAuthConfig = {
      requireAuth: false,
      optional
    };
    
    Reflect.defineMetadata(AUTH_METADATA_KEY, authConfig, target, propertyKey);
    Reflect.defineMetadata(PUBLIC_METADATA_KEY, true, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Require authentication for this route
 * @param config - Optional authentication configuration
 */
export function RequireAuth(config: Partial<RouteAuthConfig> = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const authConfig: RouteAuthConfig = {
      requireAuth: true,
      ...config
    };
    
    Reflect.defineMetadata(AUTH_METADATA_KEY, authConfig, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Require specific permissions for this route
 * @param permissions - Single permission or array of permissions
 * @param options - Permission requirement options
 */
export function RequirePermissions(
  permissions: string | string[],
  options: Omit<PermissionRequirement, 'permissions'> = {}
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const permissionReq: PermissionRequirement = {
      permissions,
      requireAll: options.requireAll || false,
      allowSystemOverride: options.allowSystemOverride !== false,
      organizationSpecific: options.organizationSpecific !== false
    };
    
    const authConfig: RouteAuthConfig = {
      requireAuth: true,
      permissions: permissionReq
    };
    
    Reflect.defineMetadata(AUTH_METADATA_KEY, authConfig, target, propertyKey);
    Reflect.defineMetadata(PERMISSIONS_METADATA_KEY, permissionReq, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Require specific roles for this route
 * @param roles - Single role or array of roles
 * @param options - Role requirement options
 */
export function RequireRoles(
  roles: string | string[],
  options: Omit<RoleRequirement, 'roles'> = {}
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const roleReq: RoleRequirement = {
      roles,
      requireAll: options.requireAll || false,
      organizationSpecific: options.organizationSpecific !== false,
      allowSystemOverride: options.allowSystemOverride !== false
    };
    
    const authConfig: RouteAuthConfig = {
      requireAuth: true,
      roles: roleReq
    };
    
    Reflect.defineMetadata(AUTH_METADATA_KEY, authConfig, target, propertyKey);
    Reflect.defineMetadata(ROLES_METADATA_KEY, roleReq, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Require system admin privileges for this route
 */
export function RequireSystemAdmin() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const authConfig: RouteAuthConfig = {
      requireAuth: true,
      systemAdminOnly: true
    };
    
    Reflect.defineMetadata(AUTH_METADATA_KEY, authConfig, target, propertyKey);
    Reflect.defineMetadata(SYSTEM_ADMIN_METADATA_KEY, true, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Require cross-organization access privileges
 */
export function RequireCrossOrgAccess() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const authConfig: RouteAuthConfig = {
      requireAuth: true,
      crossOrgAccess: true
    };
    
    Reflect.defineMetadata(AUTH_METADATA_KEY, authConfig, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Use a custom authorization function for this route
 * @param authHandler - Custom authorization function
 */
export function CustomAuth(authHandler: CustomAuthHandler) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const authConfig: RouteAuthConfig = {
      requireAuth: true,
      customAuth: authHandler
    };
    
    Reflect.defineMetadata(AUTH_METADATA_KEY, authConfig, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Apply rate limiting to this route
 * @param windowMs - Time window in milliseconds
 * @param max - Maximum requests per window
 * @param options - Additional rate limit options
 */
export function RateLimit(
  windowMs: number,
  max: number,
  options: { skipSuccessfulRequests?: boolean } = {}
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existingConfig = Reflect.getMetadata(AUTH_METADATA_KEY, target, propertyKey) || {};
    
    const authConfig: RouteAuthConfig = {
      ...existingConfig,
      rateLimit: {
        windowMs,
        max,
        ...options
      }
    };
    
    Reflect.defineMetadata(AUTH_METADATA_KEY, authConfig, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Combine multiple auth decorators
 * @param configs - Array of partial auth configurations to merge
 */
export function CombineAuth(...configs: Partial<RouteAuthConfig>[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const authConfig: RouteAuthConfig = configs.reduce(
      (merged, config) => ({ ...merged, ...config }),
      { requireAuth: true }
    );
    
    Reflect.defineMetadata(AUTH_METADATA_KEY, authConfig, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Utility functions to read metadata
 */
export const AuthMetadataReader = {
  /**
   * Get the authentication configuration for a method
   */
  getAuthConfig(target: any, propertyKey: string): RouteAuthConfig | undefined {
    return Reflect.getMetadata(AUTH_METADATA_KEY, target, propertyKey);
  },

  /**
   * Check if a method is marked as public
   */
  isPublic(target: any, propertyKey: string): boolean {
    return Reflect.getMetadata(PUBLIC_METADATA_KEY, target, propertyKey) === true;
  },

  /**
   * Get permission requirements for a method
   */
  getPermissionRequirements(target: any, propertyKey: string): PermissionRequirement | undefined {
    return Reflect.getMetadata(PERMISSIONS_METADATA_KEY, target, propertyKey);
  },

  /**
   * Get role requirements for a method
   */
  getRoleRequirements(target: any, propertyKey: string): RoleRequirement | undefined {
    return Reflect.getMetadata(ROLES_METADATA_KEY, target, propertyKey);
  },

  /**
   * Check if a method requires system admin privileges
   */
  requiresSystemAdmin(target: any, propertyKey: string): boolean {
    return Reflect.getMetadata(SYSTEM_ADMIN_METADATA_KEY, target, propertyKey) === true;
  },

  /**
   * Get all authentication metadata for a class
   */
  getClassAuthMetadata(target: any): Map<string, RouteAuthConfig> {
    const metadata = new Map<string, RouteAuthConfig>();
    const prototype = target.prototype || target;
    
    // Get all method names
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      name => name !== 'constructor' && typeof prototype[name] === 'function'
    );
    
    methodNames.forEach(methodName => {
      const authConfig = this.getAuthConfig(prototype, methodName);
      if (authConfig) {
        metadata.set(methodName, authConfig);
      }
    });
    
    return metadata;
  }
};

/**
 * Class decorator to apply default auth configuration to all methods
 * @param defaultConfig - Default authentication configuration
 */
export function DefaultAuth(defaultConfig: RouteAuthConfig) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const prototype = constructor.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      name => name !== 'constructor' && typeof prototype[name] === 'function'
    );
    
    methodNames.forEach(methodName => {
      // Only apply default config if no specific config exists
      const existingConfig = Reflect.getMetadata(AUTH_METADATA_KEY, prototype, methodName);
      if (!existingConfig) {
        Reflect.defineMetadata(AUTH_METADATA_KEY, defaultConfig, prototype, methodName);
      }
    });
    
    return constructor;
  };
}

/**
 * Higher-order decorator factory for creating custom auth decorators
 * @param name - Decorator name (for debugging)
 * @param configFactory - Function that creates auth config
 */
export function createAuthDecorator(
  name: string,
  configFactory: (...args: any[]) => RouteAuthConfig
) {
  return function (...args: any[]) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const authConfig = configFactory(...args);
      
      Reflect.defineMetadata(AUTH_METADATA_KEY, authConfig, target, propertyKey);
      
      return descriptor;
    };
  };
}

// Example usage of custom decorator factory:
// export const RequireInvoiceAccess = createAuthDecorator(
//   'RequireInvoiceAccess',
//   (action: 'read' | 'write' | 'delete') => ({
//     requireAuth: true,
//     permissions: {
//       permissions: [`invoice:${action}`],
//       organizationSpecific: true
//     }
//   })
// );