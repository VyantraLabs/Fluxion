"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompleteOnboardingSchema = exports.UpdateUserSchema = exports.InvoiceFilterSchema = exports.WalletAddressParamSchema = exports.WalletAddressSchema = exports.InvoiceIdSchema = exports.AnalyticsQuerySchema = exports.TransactionParamsSchema = exports.PaymentParamsSchema = exports.UserParamsSchema = exports.InvoiceParamsSchema = exports.validate = exports.ErrorResponseSchema = exports.SuccessResponseSchema = exports.HealthCheckResponseSchema = exports.UserInvoicesQuerySchema = exports.PaginationSchema = exports.WalletAuthVerifySchema = exports.WalletAuthMessageSchema = exports.PaymentStatusSchema = exports.PaymentVerificationSchema = exports.VerifyPaymentSchema = exports.UpdateInvoiceStatusSchema = exports.CreateDraftInvoiceSchema = exports.CreateInvoiceSchema = exports.ValidateAddressSchema = exports.UpdateUserProfileSchema = exports.AuthenticateWalletSchema = exports.AuthMessageRequestSchema = exports.LineItemSchema = void 0;
const zod_1 = require("zod");
const common_1 = require("../types/common");
// Custom validators
const walletAddress = zod_1.z.string()
    .min(42, 'Invalid wallet address length')
    .max(42, 'Invalid wallet address length')
    .regex(/^0[xX][a-fA-F0-9]{40}$/, 'Invalid wallet address format');
// Temporarily disable ethers validation for testing
// .refine(address => ethers.isAddress(address), 'Invalid wallet address');
const transactionHash = zod_1.z.string()
    .length(66, 'Invalid transaction hash length')
    .regex(/^0[xX][a-fA-F0-9]{64}$/, 'Invalid transaction hash format');
// ULID validation - 26 characters, alphanumeric, case-insensitive
const ulidSchema = zod_1.z.string()
    .length(26, 'Invalid ULID length')
    .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/i, 'Invalid ULID format');
// For backward compatibility, accept both UUIDs and ULIDs during transition
const idSchema = zod_1.z.string()
    .refine((val) => {
    // Check if it's a valid UUID (36 chars with hyphens)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
    // Check if it's a valid ULID (26 chars alphanumeric)
    const isUlid = /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(val);
    return isUuid || isUlid;
}, 'Invalid ID format - must be either UUID or ULID');
const monetaryAmount = zod_1.z.number()
    .min(common_1.CONSTANTS.MIN_INVOICE_AMOUNT, `Amount must be at least ${common_1.CONSTANTS.MIN_INVOICE_AMOUNT}`)
    .max(common_1.CONSTANTS.MAX_INVOICE_AMOUNT, `Amount cannot exceed ${common_1.CONSTANTS.MAX_INVOICE_AMOUNT}`);
const emailSchema = zod_1.z.string()
    .email('Invalid email format')
    .max(255, 'Email too long');
// Line item schema
exports.LineItemSchema = zod_1.z.object({
    id: idSchema.optional(),
    description: zod_1.z.string()
        .min(1, 'Description is required')
        .max(200, 'Description too long')
        .trim(),
    quantity: zod_1.z.number()
        .min(0.01, 'Quantity must be at least 0.01')
        .max(1000000, 'Quantity too large')
        .multipleOf(0.01, 'Quantity must have at most 2 decimal places'),
    rate: zod_1.z.number()
        .min(0.01, 'Rate must be at least 0.01')
        .max(1000000, 'Rate too large')
        .multipleOf(0.01, 'Rate must have at most 2 decimal places'),
    amount: zod_1.z.number()
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
exports.AuthMessageRequestSchema = zod_1.z.object({
    wallet_address: walletAddress
});
exports.AuthenticateWalletSchema = zod_1.z.object({
    wallet_address: walletAddress,
    signature: zod_1.z.string()
        .min(1, 'Signature is required'),
    message: zod_1.z.string()
        .min(1, 'Message is required')
});
exports.UpdateUserProfileSchema = zod_1.z.object({
    email: emailSchema.optional(),
    display_name: zod_1.z.string()
        .max(50, 'Display name too long')
        .trim()
        .optional(),
    notification_preferences: zod_1.z.object({
        email_on_payment: zod_1.z.boolean().optional(),
        email_on_invoice_viewed: zod_1.z.boolean().optional()
    }).optional()
});
exports.ValidateAddressSchema = zod_1.z.object({
    wallet_address: zod_1.z.string()
        .min(1, 'Address is required')
});
// Base invoice schema - all fields optional for flexibility
const BaseInvoiceSchema = zod_1.z.object({
    title: zod_1.z.string()
        .max(255, 'Title too long')
        .trim()
        .optional(),
    description: zod_1.z.string()
        .max(500, 'Description too long')
        .trim()
        .optional(),
    clientName: zod_1.z.string()
        .max(255, 'Client name too long')
        .trim()
        .optional(),
    clientEmail: zod_1.z.string()
        .email('Invalid email format')
        .max(255, 'Email too long')
        .optional(),
    clientWallet: walletAddress.optional(),
    amount: zod_1.z.union([zod_1.z.number(), zod_1.z.string()])
        .optional()
        .transform((val) => {
        if (val === undefined || val === null || val === '')
            return undefined;
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? undefined : num;
    }),
    dueDate: zod_1.z.string()
        .datetime('Invalid due date format')
        .optional(),
    networkId: zod_1.z.union([zod_1.z.number(), zod_1.z.string()])
        .optional()
        .transform((val) => {
        if (val === undefined || val === null || val === '')
            return undefined;
        const num = typeof val === 'string' ? parseInt(val, 10) : val;
        return isNaN(num) ? undefined : num;
    }),
    tokenId: zod_1.z.union([idSchema, zod_1.z.string().length(0)]).optional().transform((val) => {
        if (val === undefined || val === null || val === '')
            return undefined;
        return val;
    }),
    status: zod_1.z.enum(['draft', 'created', 'initiated', 'sent']).optional().default('draft')
});
// Dynamic validation based on status
exports.CreateInvoiceSchema = BaseInvoiceSchema.superRefine((data, ctx) => {
    const status = data.status || 'draft';
    // Draft status - NO validation whatsoever
    // Users can save with any combination of fields
    if (status === 'draft') {
        return; // Skip all validation for drafts
    }
    // For created, initiated, or sent status - require all fields
    if (status === 'created' || status === 'initiated' || status === 'sent') {
        if (!data.title || data.title.trim().length === 0) {
            ctx.addIssue({ code: 'custom', message: 'Title is required for non-draft invoices', path: ['title'] });
        }
        if (!data.description || data.description.trim().length === 0) {
            ctx.addIssue({ code: 'custom', message: 'Description is required for non-draft invoices', path: ['description'] });
        }
        if (!data.clientName || data.clientName.trim().length === 0) {
            ctx.addIssue({ code: 'custom', message: 'Client name is required for non-draft invoices', path: ['clientName'] });
        }
        if (!data.clientEmail) {
            ctx.addIssue({ code: 'custom', message: 'Client email is required for non-draft invoices', path: ['clientEmail'] });
        }
        if (data.amount === undefined || data.amount < common_1.CONSTANTS.MIN_INVOICE_AMOUNT) {
            ctx.addIssue({ code: 'custom', message: `Amount must be at least ${common_1.CONSTANTS.MIN_INVOICE_AMOUNT} for non-draft invoices`, path: ['amount'] });
        }
        if (!data.dueDate) {
            ctx.addIssue({ code: 'custom', message: 'Due date is required for non-draft invoices', path: ['dueDate'] });
        }
        if (data.networkId === undefined || data.networkId <= 0) {
            ctx.addIssue({ code: 'custom', message: 'Network ID is required for non-draft invoices', path: ['networkId'] });
        }
        if (!data.tokenId) {
            ctx.addIssue({ code: 'custom', message: 'Token ID is required for non-draft invoices', path: ['tokenId'] });
        }
    }
});
// For backward compatibility - now using unified CreateInvoiceSchema
exports.CreateDraftInvoiceSchema = exports.CreateInvoiceSchema;
exports.UpdateInvoiceStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'])
});
// Payment schemas
exports.VerifyPaymentSchema = zod_1.z.object({
    invoice_id: idSchema,
    tx_hash: transactionHash,
    from_address: walletAddress
});
// Payment verification schema
exports.PaymentVerificationSchema = exports.VerifyPaymentSchema;
// Payment status schema
exports.PaymentStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'confirmed', 'failed'])
});
// Wallet authentication schemas
exports.WalletAuthMessageSchema = zod_1.z.object({
    wallet_address: walletAddress
});
exports.WalletAuthVerifySchema = zod_1.z.object({
    wallet_address: walletAddress,
    signature: zod_1.z.string().min(1, 'Signature is required'),
    message: zod_1.z.string().min(1, 'Message is required')
});
// Query parameter schemas
exports.PaginationSchema = zod_1.z.object({
    limit: zod_1.z.string()
        .regex(/^\d+$/, 'Limit must be a number')
        .transform(Number)
        .pipe(zod_1.z.number().min(1).max(common_1.CONSTANTS.MAX_PAGE_SIZE))
        .optional()
        .default(common_1.CONSTANTS.DEFAULT_PAGE_SIZE.toString()),
    nextToken: zod_1.z.string()
        .optional(),
    status: zod_1.z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'])
        .optional()
});
exports.UserInvoicesQuerySchema = zod_1.z.object({
    wallet: walletAddress
}).merge(exports.PaginationSchema);
// Health check and system schemas
exports.HealthCheckResponseSchema = zod_1.z.object({
    status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
    timestamp: zod_1.z.string().datetime(),
    version: zod_1.z.string(),
    environment: zod_1.z.string(),
    services: zod_1.z.object({
        database: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
        blockchain: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
        notifications: zod_1.z.enum(['healthy', 'degraded', 'unhealthy'])
    }),
    uptime: zod_1.z.number().nonnegative()
});
// Common response schemas
exports.SuccessResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.any(),
    meta: zod_1.z.object({
        requestId: zod_1.z.string(),
        timestamp: zod_1.z.string().datetime(),
        version: zod_1.z.string().optional()
    })
});
exports.ErrorResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(false),
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        details: zod_1.z.any().optional()
    }),
    meta: zod_1.z.object({
        requestId: zod_1.z.string(),
        timestamp: zod_1.z.string().datetime(),
        version: zod_1.z.string().optional()
    })
});
// Validation middleware helper
const validate = (schema) => {
    return (req, res, next) => {
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
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
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
exports.validate = validate;
// Request parameter validation schemas
exports.InvoiceParamsSchema = zod_1.z.object({
    id: idSchema
});
exports.UserParamsSchema = zod_1.z.object({
    wallet: walletAddress
});
exports.PaymentParamsSchema = zod_1.z.object({
    id: idSchema
});
exports.TransactionParamsSchema = zod_1.z.object({
    hash: transactionHash
});
// Analytics validation schemas
exports.AnalyticsQuerySchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    period: zod_1.z.enum(['day', 'week', 'month', 'year']).default('month'),
    limit: zod_1.z.number().min(1).max(100).default(20)
});
exports.InvoiceIdSchema = zod_1.z.object({
    id: idSchema
});
exports.WalletAddressSchema = zod_1.z.object({
    wallet_address: walletAddress
});
exports.WalletAddressParamSchema = zod_1.z.object({
    wallet: walletAddress
});
// Invoice filter schema for listing invoices
exports.InvoiceFilterSchema = zod_1.z.object({
    status: zod_1.z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial']).optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    clientName: zod_1.z.string().optional(),
    limit: zod_1.z.string()
        .regex(/^\d+$/, 'Limit must be a number')
        .transform(Number)
        .pipe(zod_1.z.number().min(1).max(common_1.CONSTANTS.MAX_PAGE_SIZE))
        .optional()
        .default(common_1.CONSTANTS.DEFAULT_PAGE_SIZE.toString()),
    nextToken: zod_1.z.string().optional()
});
// User update schema for profile updates
exports.UpdateUserSchema = zod_1.z.object({
    email: emailSchema.optional(),
    display_name: zod_1.z.string()
        .max(50, 'Display name too long')
        .trim()
        .optional(),
    notification_preferences: zod_1.z.object({
        email_on_payment: zod_1.z.boolean().optional(),
        email_on_invoice_viewed: zod_1.z.boolean().optional(),
        email_on_reminders: zod_1.z.boolean().optional()
    }).optional(),
    profile: zod_1.z.object({
        avatar_url: zod_1.z.string().url().optional(),
        bio: zod_1.z.string().max(500).optional()
    }).optional()
});
// User onboarding schema
exports.CompleteOnboardingSchema = zod_1.z.object({
    organizationName: zod_1.z.string()
        .min(2, 'Organization name must be at least 2 characters')
        .max(100, 'Organization name too long')
        .trim(),
    displayName: zod_1.z.string()
        .min(1, 'Display name is required')
        .max(50, 'Display name too long')
        .trim()
        .optional(),
    email: emailSchema.optional()
});
//# sourceMappingURL=index.js.map