// Essential exports for microservices

// Core types
export * from './types/common';
export * from './types/config';
export * from './types/payment';
export * from './types/user';
export * from './types/invoice';
// Express types are global declarations only

// Database entities
export { User } from './database/entities/User';
export { Organization } from './database/entities/Organization';
export { Invoice } from './database/entities/Invoice';
export { Payment } from './database/entities/Payment';
export { BlockchainNetwork } from './database/entities/BlockchainNetwork';
export { Token } from './database/entities/Token';
export { AuditLog } from './database/entities/AuditLog';
export { Template } from './database/entities/Template';
export { Role } from './database/entities/Role';
export { Permission } from './database/entities/Permission';
export { UserRole } from './database/entities/UserRole';
export { RolePermission } from './database/entities/RolePermission';

// More entities
export { TemplateCategory } from './database/entities/TemplateCategory';
export { NotificationQueue } from './database/entities/NotificationQueue';
export { NotificationSettings } from './database/entities/NotificationSettings';
export { OrganizationSetting } from './database/entities/OrganizationSetting';
export { PaymentVerificationJob } from './database/entities/PaymentVerificationJob';
export { PayrollBatch } from './database/entities/PayrollBatch';
export { PayrollRecipient } from './database/entities/PayrollRecipient';
export { ReminderJob } from './database/entities/ReminderJob';
export { SmartContract } from './database/entities/SmartContract';
export { SystemSettings } from './database/entities/SystemSettings';
export { InvoiceAccessToken } from './database/entities/InvoiceAccessToken';

// Database connection
export { AppDataSource } from './database/data-source';

// Repositories
export * from './database/repositories';

// Error handling
export { FluxionError } from './errors/index';

// Utilities
export { Logger } from './utils/logger';
export * from './utils/response';

// Middleware
export * from './middleware';

// Simple Authentication utilities
export { 
  createJWTAuth,
  requireRoles,
  requireSystemAdmin,
  SimpleAuthContext,
  SimpleAuthOptions
} from './middleware/simple-auth';

// Legacy authentication for backward compatibility
export { 
  AuthJWTPayload, 
  authenticateJWT, 
  optionalAuth, 
  generateJWT
} from './middleware';

// Enhanced authentication types and context
export { 
  AuthContext,
  EnhancedJWTPayload,
  RouteAuthConfig,
  ServiceAuthConfig
} from './auth/types';

// Config
export { config } from './config/index';

// Service Router - automatic base path handling
export { 
  createServiceRouter, 
  createRoute, 
  ServiceRouter,
  ServiceConfig,
  RouteConfig 
} from './config/service-router';

// Lambda utilities
export * from './lambda/adapter';
export * from './lambda/types';
export * from './lambda/utils';

// Validation (specific exports to avoid conflicts)
export { 
  CreateInvoiceSchema, 
  UpdateUserProfileSchema, 
  AuthenticateWalletSchema,
  VerifyPaymentSchema,
  CompleteOnboardingSchema,
  LineItemSchema 
} from './validation/index';