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

// Export types
export type CreateNetworkRequest = z.infer<typeof CreateNetworkSchema>;
export type UpdateNetworkRequest = z.infer<typeof UpdateNetworkSchema>;
export type CreateTokenRequest = z.infer<typeof CreateTokenSchema>;
export type UpdateTokenRequest = z.infer<typeof UpdateTokenSchema>;
export type BulkUpdateNetworksRequest = z.infer<typeof BulkUpdateNetworksSchema>;
export type BulkUpdateTokensRequest = z.infer<typeof BulkUpdateTokensSchema>;
export type AdminStatsQuery = z.infer<typeof AdminStatsQuerySchema>;
export type SystemConfigRequest = z.infer<typeof SystemConfigSchema>;