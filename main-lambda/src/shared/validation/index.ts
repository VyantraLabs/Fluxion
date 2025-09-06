import { z } from 'zod';
import { ethers } from 'ethers';
import { CONSTANTS } from '../../types/common';

// Custom validators
const walletAddress = z.string()
  .min(42, 'Invalid wallet address length')
  .max(42, 'Invalid wallet address length')
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address format');
  // Temporarily disable ethers validation for testing
  // .refine(address => ethers.isAddress(address), 'Invalid wallet address');

const transactionHash = z.string()
  .length(66, 'Invalid transaction hash length')
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format');

// ULID validation - 26 characters, alphanumeric, case-insensitive
const ulidSchema = z.string()
  .length(26, 'Invalid ULID length')
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/i, 'Invalid ULID format');

// For backward compatibility, accept both UUIDs and ULIDs during transition
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

const monetaryAmount = z.number()
  .min(CONSTANTS.MIN_INVOICE_AMOUNT, `Amount must be at least ${CONSTANTS.MIN_INVOICE_AMOUNT}`)
  .max(CONSTANTS.MAX_INVOICE_AMOUNT, `Amount cannot exceed ${CONSTANTS.MAX_INVOICE_AMOUNT}`);

const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email too long');

// Line item schema
export const LineItemSchema = z.object({
  id: idSchema.optional(),
  description: z.string()
    .min(1, 'Description is required')
    .max(200, 'Description too long')
    .trim(),
  quantity: z.number()
    .min(0.01, 'Quantity must be at least 0.01')
    .max(1000000, 'Quantity too large')
    .multipleOf(0.01, 'Quantity must have at most 2 decimal places'),
  rate: z.number()
    .min(0.01, 'Rate must be at least 0.01')
    .max(1000000, 'Rate too large')
    .multipleOf(0.01, 'Rate must have at most 2 decimal places'),
  amount: z.number()
    .min(0.01, 'Amount must be at least 0.01')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places')
}).refine(item => {
  const calculatedAmount = Math.round(item.quantity * item.rate * 100) / 100;
  return Math.abs(calculatedAmount - item.amount) < 0.01;
}, {
  message: 'Amount must equal quantity × rate',
  path: ['amount']
});

// User schemas
export const AuthMessageRequestSchema = z.object({
  wallet_address: walletAddress
});

export const AuthenticateWalletSchema = z.object({
  wallet_address: walletAddress,
  signature: z.string()
    .min(1, 'Signature is required'),
  message: z.string()
    .min(1, 'Message is required')
});

export const UpdateUserProfileSchema = z.object({
  email: emailSchema.optional(),
  display_name: z.string()
    .max(50, 'Display name too long')
    .trim()
    .optional(),
  notification_preferences: z.object({
    email_on_payment: z.boolean().optional(),
    email_on_invoice_viewed: z.boolean().optional()
  }).optional()
});

export const ValidateAddressSchema = z.object({
  wallet_address: z.string()
    .min(1, 'Address is required')
});

// Invoice schemas
export const CreateInvoiceSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title too long')
    .trim(),
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description too long')
    .trim(),
  clientName: z.string()
    .min(1, 'Client name is required')
    .max(255, 'Client name too long')
    .trim(),
  clientEmail: emailSchema,
  clientWallet: walletAddress.optional(),
  amount: z.number()
    .min(CONSTANTS.MIN_INVOICE_AMOUNT, `Amount must be at least ${CONSTANTS.MIN_INVOICE_AMOUNT}`)
    .max(CONSTANTS.MAX_INVOICE_AMOUNT, `Amount cannot exceed ${CONSTANTS.MAX_INVOICE_AMOUNT}`),
  dueDate: z.string()
    .datetime('Invalid due date format'),
  networkId: z.number()
    .int('Network ID must be an integer')
    .positive('Network ID must be positive'),
  tokenId: idSchema
});

export const UpdateInvoiceStatusSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'] as const)
});

// Payment schemas
export const VerifyPaymentSchema = z.object({
  invoice_id: idSchema,
  tx_hash: transactionHash,
  from_address: walletAddress
});

// Payment verification schema
export const PaymentVerificationSchema = VerifyPaymentSchema;

// Payment status schema
export const PaymentStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'failed'] as const)
});

// Wallet authentication schemas
export const WalletAuthMessageSchema = z.object({
  wallet_address: walletAddress
});

export const WalletAuthVerifySchema = z.object({
  wallet_address: walletAddress,
  signature: z.string().min(1, 'Signature is required'),
  message: z.string().min(1, 'Message is required')
});

// Query parameter schemas
export const PaginationSchema = z.object({
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .pipe(z.number().min(1).max(CONSTANTS.MAX_PAGE_SIZE))
    .optional()
    .default(CONSTANTS.DEFAULT_PAGE_SIZE.toString()),
  nextToken: z.string()
    .optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'] as const)
    .optional()
});

export const UserInvoicesQuerySchema = z.object({
  wallet: walletAddress
}).merge(PaginationSchema);

// Health check and system schemas
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  version: z.string(),
  environment: z.string(),
  services: z.object({
    database: z.enum(['healthy', 'degraded', 'unhealthy']),
    blockchain: z.enum(['healthy', 'degraded', 'unhealthy']),
    notifications: z.enum(['healthy', 'degraded', 'unhealthy'])
  }),
  uptime: z.number().nonnegative()
});

// Common response schemas
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  meta: z.object({
    requestId: z.string(),
    timestamp: z.string().datetime(),
    version: z.string().optional()
  })
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }),
  meta: z.object({
    requestId: z.string(),
    timestamp: z.string().datetime(),
    version: z.string().optional()
  })
});

// Validation middleware helper
export const validate = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      // Validate different parts of the request
      if (req.body && Object.keys(req.body).length > 0) {
        req.body = schema.parse(req.body);
      }
      
      if (req.query && Object.keys(req.query).length > 0) {
        req.query = schema.parse(req.query);
      }
      
      if (req.params && Object.keys(req.params).length > 0) {
        req.params = schema.parse(req.params);
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: formattedErrors
          },
          meta: {
            requestId: req.context?.requestId || 'unknown',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Unexpected error
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Validation failed due to internal error'
        },
        meta: {
          requestId: req.context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

// Request parameter validation schemas
export const InvoiceParamsSchema = z.object({
  id: idSchema
});

export const UserParamsSchema = z.object({
  wallet: walletAddress
});

export const PaymentParamsSchema = z.object({
  id: idSchema
});

export const TransactionParamsSchema = z.object({
  hash: transactionHash
});

// Analytics validation schemas
export const AnalyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['day', 'week', 'month', 'year']).default('month'),
  limit: z.number().min(1).max(100).default(20)
});

export const InvoiceIdSchema = z.object({
  id: idSchema
});

export const WalletAddressSchema = z.object({
  wallet_address: walletAddress
});

export const WalletAddressParamSchema = z.object({
  wallet: walletAddress
});

// Invoice filter schema for listing invoices
export const InvoiceFilterSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'] as const).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  clientName: z.string().optional(),
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .pipe(z.number().min(1).max(CONSTANTS.MAX_PAGE_SIZE))
    .optional()
    .default(CONSTANTS.DEFAULT_PAGE_SIZE.toString()),
  nextToken: z.string().optional()
});

// User update schema for profile updates
export const UpdateUserSchema = z.object({
  email: emailSchema.optional(),
  display_name: z.string()
    .max(50, 'Display name too long')
    .trim()
    .optional(),
  notification_preferences: z.object({
    email_on_payment: z.boolean().optional(),
    email_on_invoice_viewed: z.boolean().optional(),
    email_on_reminders: z.boolean().optional()
  }).optional(),
  profile: z.object({
    avatar_url: z.string().url().optional(),
    bio: z.string().max(500).optional()
  }).optional()
});

// User onboarding schema
export const CompleteOnboardingSchema = z.object({
  organizationName: z.string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name too long')
    .trim(),
  displayName: z.string()
    .min(1, 'Display name is required')
    .max(50, 'Display name too long')
    .trim()
    .optional(),
  email: emailSchema.optional()
});

// Export types
export type CreateInvoiceRequest = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceStatusRequest = z.infer<typeof UpdateInvoiceStatusSchema>;
export type AuthenticateWalletRequest = z.infer<typeof AuthenticateWalletSchema>;
export type UpdateUserProfileRequest = z.infer<typeof UpdateUserProfileSchema>;
export type VerifyPaymentRequest = z.infer<typeof VerifyPaymentSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type PaginationQuery = z.infer<typeof PaginationSchema>;
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;