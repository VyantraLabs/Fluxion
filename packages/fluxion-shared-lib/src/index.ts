// Essential exports for microservices

// Core types
export * from './types/common';
export * from './types/config';
export * from './types/payment';
export * from './types/user';
export * from './types/invoice';
export * from './types/express';

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

// Authentication
export { AuthJWTPayload, authenticateJWT, optionalAuth, generateJWT } from './auth';

// Config
export { config } from './config/index';

// Validation (specific exports to avoid conflicts)
export { 
  CreateInvoiceSchema, 
  UpdateUserProfileSchema, 
  AuthenticateWalletSchema,
  VerifyPaymentSchema,
  CompleteOnboardingSchema,
  LineItemSchema 
} from './validation/index';