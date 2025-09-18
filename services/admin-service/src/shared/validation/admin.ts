import { z } from 'zod';

// ID validation - accepts both UUIDs and ULIDs for backward compatibility
const idSchema = z.string()
  .refine(
    (val) => {
      // Check if it's a valid UUID (36 chars with hyphens)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
      // Check if it's a valid ULID (26 chars alphanumeric)
      const isUlid = /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(val);
      return isUuid || isUlid;
    },
    'Invalid ID format - must be either UUID or ULID'
  );

// Ethereum address validation
const ethereumAddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format');

// Network creation schema
export const CreateNetworkSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .trim(),
  chainId: z.number()
    .int('Chain ID must be an integer')
    .positive('Chain ID must be positive')
    .min(1, 'Chain ID must be at least 1')
    .max(2147483647, 'Chain ID too large'), // Max 32-bit signed integer
  rpcUrl: z.string()
    .url('Invalid RPC URL format')
    .max(500, 'RPC URL too long'),
  explorerUrl: z.string()
    .url('Invalid explorer URL format')
    .max(500, 'Explorer URL too long'),
  symbol: z.string()
    .min(1, 'Symbol is required')
    .max(10, 'Symbol too long')
    .regex(/^[A-Z]+$/, 'Symbol must be uppercase letters only')
    .trim(),
  logoUrl: z.string()
    .url('Invalid logo URL format')
    .max(500, 'Logo URL too long')
    .optional(),
  isTestnet: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  gasSettings: z.object({
    gasPrice: z.string()
      .regex(/^\d+$/, 'Gas price must be a numeric string')
      .optional(),
    gasLimit: z.string()
      .regex(/^\d+$/, 'Gas limit must be a numeric string')
      .optional()
  }).optional(),
  multicallAddress: ethereumAddressSchema.optional()
});

// Network update schema
export const UpdateNetworkSchema = z.object({
  name: z.string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name too long')
    .trim()
    .optional(),
  rpcUrl: z.string()
    .url('Invalid RPC URL format')
    .max(500, 'RPC URL too long')
    .optional(),
  explorerUrl: z.string()
    .url('Invalid explorer URL format')
    .max(500, 'Explorer URL too long')
    .optional(),
  logoUrl: z.string()
    .url('Invalid logo URL format')
    .max(500, 'Logo URL too long')
    .optional(),
  isActive: z.boolean().optional(),
  gasSettings: z.object({
    gasPrice: z.string()
      .regex(/^\d+$/, 'Gas price must be a numeric string')
      .optional(),
    gasLimit: z.string()
      .regex(/^\d+$/, 'Gas limit must be a numeric string')
      .optional()
  }).optional(),
  multicallAddress: ethereumAddressSchema.optional()
});

// Token creation schema
export const CreateTokenSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .trim(),
  symbol: z.string()
    .min(1, 'Symbol is required')
    .max(10, 'Symbol too long')
    .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase alphanumeric')
    .trim(),
  decimals: z.number()
    .int('Decimals must be an integer')
    .min(0, 'Decimals cannot be negative')
    .max(18, 'Decimals cannot exceed 18'),
  contractAddress: ethereumAddressSchema
    .optional()
    .or(z.literal('')), // Allow empty string for native tokens
  networkId: idSchema,
  isNative: z.boolean().optional().default(false),
  isStablecoin: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  logoUrl: z.string()
    .url('Invalid logo URL format')
    .max(500, 'Logo URL too long')
    .optional(),
  coingeckoId: z.string()
    .max(100, 'CoinGecko ID too long')
    .regex(/^[a-z0-9-]+$/, 'CoinGecko ID must be lowercase alphanumeric with dashes')
    .optional()
}).refine(data => {
  // If it's a native token, contract address should be empty or undefined
  if (data.isNative && data.contractAddress && data.contractAddress.trim() !== '') {
    return false;
  }
  // If it's not a native token, contract address should be provided
  if (!data.isNative && (!data.contractAddress || data.contractAddress.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Native tokens should not have contract address, non-native tokens must have contract address',
  path: ['contractAddress']
});

// Token update schema
export const UpdateTokenSchema = z.object({
  name: z.string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name too long')
    .trim()
    .optional(),
  logoUrl: z.string()
    .url('Invalid logo URL format')
    .max(500, 'Logo URL too long')
    .optional(),
  isActive: z.boolean().optional(),
  isStablecoin: z.boolean().optional(),
  coingeckoId: z.string()
    .max(100, 'CoinGecko ID too long')
    .regex(/^[a-z0-9-]+$/, 'CoinGecko ID must be lowercase alphanumeric with dashes')
    .optional()
});

// Parameter schemas
export const NetworkIdSchema = z.object({
  id: idSchema
});

export const TokenIdSchema = z.object({
  id: idSchema
});

export const ChainIdParamSchema = z.object({
  chainId: z.string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().positive())
});

// Admin access validation schema
export const AdminAccessSchema = z.object({
  adminKey: z.string()
    .min(1, 'Admin key is required')
    .optional() // Optional for JWT-based admin access
});

// Bulk operations schemas
export const BulkUpdateNetworksSchema = z.object({
  networkIds: z.array(idSchema)
    .min(1, 'At least one network ID is required')
    .max(50, 'Too many networks selected'),
  updates: UpdateNetworkSchema
});

export const BulkUpdateTokensSchema = z.object({
  tokenIds: z.array(idSchema)
    .min(1, 'At least one token ID is required')
    .max(100, 'Too many tokens selected'),
  updates: UpdateTokenSchema
});

// Admin statistics query schema
export const AdminStatsQuerySchema = z.object({
  includeInactive: z.string()
    .transform(val => val === 'true')
    .optional()
    .default('false'),
  dateFrom: z.string()
    .datetime()
    .optional(),
  dateTo: z.string()
    .datetime()
    .optional()
});

// System configuration schema
export const SystemConfigSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  allowRegistrations: z.boolean().optional(),
  maxInvoicesPerUser: z.number()
    .int()
    .positive()
    .max(10000)
    .optional(),
  defaultNetworkChainId: z.number()
    .int()
    .positive()
    .optional(),
  enableTestnets: z.boolean().optional(),
  notificationSettings: z.object({
    emailEnabled: z.boolean().optional(),
    slackWebhook: z.string().url().optional(),
    discordWebhook: z.string().url().optional()
  }).optional()
});

// =============================================================================
// COMPREHENSIVE ADMIN VALIDATION SCHEMAS
// =============================================================================

// Maintenance mode schema
export const MaintenanceModeSchema = z.object({
  enabled: z.boolean(),
  message: z.string()
    .max(500, 'Maintenance message too long')
    .optional(),
  estimatedDuration: z.number()
    .int('Duration must be an integer')
    .min(1, 'Duration must be at least 1 minute')
    .max(43200, 'Duration cannot exceed 30 days (43200 minutes)')
    .optional()
});

// User admin status update schema
export const UpdateUserAdminStatusSchema = z.object({
  isAdmin: z.boolean(),
  isSuperAdmin: z.boolean().optional().default(false),
  reason: z.string()
    .max(500, 'Reason too long')
    .optional()
}).refine(data => {
  // If isSuperAdmin is true, isAdmin must also be true
  if (data.isSuperAdmin && !data.isAdmin) {
    return false;
  }
  return true;
}, {
  message: 'Super admin must also be a regular admin',
  path: ['isSuperAdmin']
});

// System setting update schema
export const UpdateSystemSettingSchema = z.object({
  value: z.any(), // Can be any JSON-serializable value
  description: z.string()
    .max(1000, 'Description too long')
    .optional()
});

// Bulk template operation schema
export const BulkTemplateOperationSchema = z.object({
  templateIds: z.array(idSchema)
    .min(1, 'At least one template ID is required')
    .max(50, 'Too many templates selected'),
  operation: z.enum(['activate', 'deactivate', 'delete'], {
    errorMap: () => ({ message: 'Operation must be activate, deactivate, or delete' })
  })
});

// Template activation schema
export const TemplateActivationSchema = z.object({
  isActive: z.boolean()
});

// Pagination query schema
export const PaginationQuerySchema = z.object({
  limit: z.string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(200))
    .optional()
    .default('50'),
  offset: z.string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(0))
    .optional()
    .default('0')
});

// Search and filter query schema
export const SearchQuerySchema = z.object({
  search: z.string()
    .max(100, 'Search term too long')
    .optional(),
  organizationId: idSchema.optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional()
}).merge(PaginationQuerySchema);

// User filter query schema
export const UserFilterQuerySchema = z.object({
  search: z.string()
    .max(100, 'Search term too long')
    .optional(),
  organizationId: idSchema.optional(),
  adminOnly: z.string()
    .transform(val => val === 'true')
    .optional()
    .default('false')
}).merge(PaginationQuerySchema);

// Activity log filter schema
export const ActivityLogFilterSchema = z.object({
  adminOnly: z.string()
    .transform(val => val === 'true')
    .optional()
    .default('false'),
  highRiskOnly: z.string()
    .transform(val => val === 'true')
    .optional()
    .default('false'),
  userId: idSchema.optional(),
  organizationId: idSchema.optional(),
  action: z.string()
    .max(50)
    .optional(),
  tableName: z.string()
    .max(100)
    .optional(),
  severityLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  startDate: z.string()
    .datetime('Invalid start date format')
    .optional(),
  endDate: z.string()
    .datetime('Invalid end date format')
    .optional()
}).merge(z.object({
  limit: z.string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(200))
    .optional()
    .default('100'),
  offset: z.string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(0))
    .optional()
    .default('0')
})).refine(data => {
  // Validate date range
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start < end;
  }
  return true;
}, {
  message: 'Start date must be before end date',
  path: ['endDate']
});

// System settings filter schema
export const SystemSettingsFilterSchema = z.object({
  category: z.string()
    .max(100)
    .optional(),
  publicOnly: z.string()
    .transform(val => val === 'true')
    .optional()
    .default('false')
});

// Organization status update schema (for future use)
export const UpdateOrganizationStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']),
  reason: z.string()
    .max(500, 'Reason too long')
    .optional(),
  suspendedUntil: z.string()
    .datetime('Invalid suspension end date')
    .optional()
}).refine(data => {
  // If status is suspended, suspendedUntil should be provided
  if (data.status === 'suspended' && !data.suspendedUntil) {
    return false;
  }
  // If suspendedUntil is provided, it should be in the future
  if (data.suspendedUntil) {
    const suspendedUntil = new Date(data.suspendedUntil);
    const now = new Date();
    return suspendedUntil > now;
  }
  return true;
}, {
  message: 'Suspended organizations must have a valid future suspension end date',
  path: ['suspendedUntil']
});

// Template update schema (comprehensive)
export const UpdateTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .optional(),
  description: z.string()
    .max(500, 'Description too long')
    .optional(),
  content: z.string()
    .max(50000, 'Template content too long')
    .optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  category: z.string()
    .max(50, 'Category name too long')
    .optional(),
  tags: z.array(z.string().max(30, 'Tag too long'))
    .max(20, 'Too many tags')
    .optional(),
  metadata: z.record(z.any()).optional()
});

// Admin dashboard stats query schema
export const AdminDashboardStatsSchema = z.object({
  dateRange: z.enum(['7d', '30d', '90d', '1y', 'all']).optional().default('30d'),
  includeInactive: z.string()
    .transform(val => val === 'true')
    .optional()
    .default('false'),
  breakdown: z.enum(['daily', 'weekly', 'monthly']).optional().default('daily')
});

// Base activity log filter schema (without refine) for omit operations
const BaseActivityLogFilterSchema = z.object({
  adminOnly: z.string()
    .transform(val => val === 'true')
    .optional()
    .default('false'),
  highRiskOnly: z.string()
    .transform(val => val === 'true')
    .optional()
    .default('false'),
  userId: idSchema.optional(),
  organizationId: idSchema.optional(),
  action: z.string()
    .max(50)
    .optional(),
  tableName: z.string()
    .max(100)
    .optional(),
  severityLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  startDate: z.string()
    .datetime('Invalid start date format')
    .optional(),
  endDate: z.string()
    .datetime('Invalid end date format')
    .optional(),
  limit: z.string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(200))
    .optional()
    .default('100'),
  offset: z.string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(0))
    .optional()
    .default('0')
});

// Audit log export schema
export const AuditLogExportSchema = z.object({
  format: z.enum(['csv', 'json', 'xlsx']).optional().default('csv'),
  startDate: z.string()
    .datetime('Invalid start date format'),
  endDate: z.string()
    .datetime('Invalid end date format'),
  filters: BaseActivityLogFilterSchema.omit({ 
    limit: true, 
    offset: true, 
    startDate: true, 
    endDate: true 
  }).optional()
}).refine(data => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  
  // Limit export range to 90 days for performance
  return daysDiff <= 90;
}, {
  message: 'Export date range cannot exceed 90 days',
  path: ['endDate']
});

// System backup and restore schemas
export const SystemBackupSchema = z.object({
  includeUserData: z.boolean().optional().default(true),
  includeSystemSettings: z.boolean().optional().default(true),
  includeAuditLogs: z.boolean().optional().default(false),
  compression: z.enum(['none', 'gzip', 'brotli']).optional().default('gzip'),
  encryption: z.boolean().optional().default(true)
});

export const SystemRestoreSchema = z.object({
  backupId: idSchema,
  restoreUserData: z.boolean().optional().default(true),
  restoreSystemSettings: z.boolean().optional().default(true),
  restoreAuditLogs: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false) // Test restore without applying changes
});

// Performance monitoring query schema
export const PerformanceMonitoringSchema = z.object({
  metric: z.enum([
    'response_time',
    'error_rate',
    'throughput',
    'database_connections',
    'memory_usage',
    'cpu_usage'
  ]),
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).optional().default('24h'),
  aggregation: z.enum(['avg', 'min', 'max', 'sum', '95th']).optional().default('avg'),
  groupBy: z.enum(['endpoint', 'user', 'organization', 'none']).optional().default('none')
});

// System health check configuration schema
export const SystemHealthConfigSchema = z.object({
  checkDatabase: z.boolean().optional().default(true),
  checkRedis: z.boolean().optional().default(true),
  checkExternalAPIs: z.boolean().optional().default(true),
  checkStorage: z.boolean().optional().default(true),
  checkBlockchainRPCs: z.boolean().optional().default(true),
  timeout: z.number()
    .int('Timeout must be an integer')
    .min(1000, 'Timeout must be at least 1 second')
    .max(30000, 'Timeout cannot exceed 30 seconds')
    .optional()
    .default(10000)
});

// Parameter validation schemas
export const UserIdParamSchema = z.object({
  id: idSchema
});

export const OrganizationIdParamSchema = z.object({
  id: idSchema
});

export const TemplateIdParamSchema = z.object({
  id: idSchema
});

export const SettingKeyParamSchema = z.object({
  key: z.string()
    .min(1, 'Setting key is required')
    .max(255, 'Setting key too long')
    .regex(/^[a-z0-9_]+$/, 'Setting key must be lowercase alphanumeric with underscores')
});

// Complex validation schemas for advanced operations
export const BulkUserOperationSchema = z.object({
  userIds: z.array(idSchema)
    .min(1, 'At least one user ID is required')
    .max(100, 'Too many users selected'),
  operation: z.enum(['activate', 'deactivate', 'delete', 'export']),
  options: z.object({
    sendNotification: z.boolean().optional().default(false),
    reason: z.string().max(500).optional(),
    effectiveDate: z.string().datetime().optional()
  }).optional()
}).refine(data => {
  // Validate that dangerous operations have a reason
  if (['deactivate', 'delete'].includes(data.operation) && !data.options?.reason) {
    return false;
  }
  return true;
}, {
  message: 'Deactivate and delete operations require a reason',
  path: ['options', 'reason']
});

export const SystemMetricsQuerySchema = z.object({
  metrics: z.array(z.enum([
    'active_users',
    'total_invoices',
    'payment_volume',
    'error_rate',
    'response_time',
    'database_size',
    'storage_usage'
  ])).min(1, 'At least one metric is required'),
  timeRange: z.enum(['1h', '24h', '7d', '30d', '90d']).optional().default('24h'),
  resolution: z.enum(['minute', 'hour', 'day']).optional().default('hour'),
  organizationId: idSchema.optional()
});

// Export all types
export type CreateNetworkRequest = z.infer<typeof CreateNetworkSchema>;
export type UpdateNetworkRequest = z.infer<typeof UpdateNetworkSchema>;
export type CreateTokenRequest = z.infer<typeof CreateTokenSchema>;
export type UpdateTokenRequest = z.infer<typeof UpdateTokenSchema>;
export type BulkUpdateNetworksRequest = z.infer<typeof BulkUpdateNetworksSchema>;
export type BulkUpdateTokensRequest = z.infer<typeof BulkUpdateTokensSchema>;
export type AdminStatsQuery = z.infer<typeof AdminStatsQuerySchema>;
export type SystemConfigRequest = z.infer<typeof SystemConfigSchema>;

// New comprehensive types
export type MaintenanceModeRequest = z.infer<typeof MaintenanceModeSchema>;
export type UpdateUserAdminStatusRequest = z.infer<typeof UpdateUserAdminStatusSchema>;
export type UpdateSystemSettingRequest = z.infer<typeof UpdateSystemSettingSchema>;
export type BulkTemplateOperationRequest = z.infer<typeof BulkTemplateOperationSchema>;
export type TemplateActivationRequest = z.infer<typeof TemplateActivationSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type UserFilterQuery = z.infer<typeof UserFilterQuerySchema>;
export type ActivityLogFilter = z.infer<typeof ActivityLogFilterSchema>;
export type SystemSettingsFilter = z.infer<typeof SystemSettingsFilterSchema>;
export type UpdateOrganizationStatusRequest = z.infer<typeof UpdateOrganizationStatusSchema>;
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateSchema>;
export type AdminDashboardStatsQuery = z.infer<typeof AdminDashboardStatsSchema>;
export type AuditLogExportRequest = z.infer<typeof AuditLogExportSchema>;
export type SystemBackupRequest = z.infer<typeof SystemBackupSchema>;
export type SystemRestoreRequest = z.infer<typeof SystemRestoreSchema>;
export type PerformanceMonitoringQuery = z.infer<typeof PerformanceMonitoringSchema>;
export type SystemHealthConfig = z.infer<typeof SystemHealthConfigSchema>;
export type BulkUserOperationRequest = z.infer<typeof BulkUserOperationSchema>;
export type SystemMetricsQuery = z.infer<typeof SystemMetricsQuerySchema>;