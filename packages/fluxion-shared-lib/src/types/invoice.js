"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetInvoicesQuerySchema = exports.UpdateInvoiceSchema = exports.CreateInvoiceSchema = exports.LineItemSchema = void 0;
const zod_1 = require("zod");
// ID validation - accepts both UUIDs and ULIDs for backward compatibility
const idSchema = zod_1.z.string()
    .refine((val) => {
    // Check if it's a valid UUID (36 chars with hyphens)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
    // Check if it's a valid ULID (26 chars alphanumeric)
    const isUlid = /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(val);
    return isUuid || isUlid;
}, 'Invalid ID format - must be either UUID or ULID');
exports.LineItemSchema = zod_1.z.object({
    id: idSchema.optional(),
    description: zod_1.z.string().min(1, 'Description is required').max(200),
    quantity: zod_1.z.number().min(0.01, 'Quantity must be greater than 0').max(1000000),
    rate: zod_1.z.number().min(0.01, 'Rate must be greater than 0').max(1000000),
    amount: zod_1.z.number().min(0.01, 'Amount must be greater than 0')
});
exports.CreateInvoiceSchema = zod_1.z.object({
    creator_wallet: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
    client_email: zod_1.z.string().email('Invalid email address'),
    client_name: zod_1.z.string().min(1, 'Client name is required').max(100),
    amount: zod_1.z.number().min(0.01, 'Amount must be greater than 0').max(1000000),
    description: zod_1.z.string().min(1, 'Description is required').max(500),
    line_items: zod_1.z.array(exports.LineItemSchema).optional(),
    due_date: zod_1.z.string().datetime('Invalid due date format')
});
exports.UpdateInvoiceSchema = zod_1.z.object({
    client_email: zod_1.z.string().email('Invalid email address').optional(),
    client_name: zod_1.z.string().min(1, 'Client name is required').max(100).optional(),
    description: zod_1.z.string().min(1, 'Description is required').max(500).optional(),
    line_items: zod_1.z.array(exports.LineItemSchema).optional(),
    due_date: zod_1.z.string().datetime('Invalid due date format').optional(),
    status: zod_1.z.enum(['draft', 'pending', 'paid', 'expired', 'cancelled']).optional()
});
exports.GetInvoicesQuerySchema = zod_1.z.object({
    limit: zod_1.z.string().transform(val => parseInt(val)).refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100').optional(),
    nextToken: zod_1.z.string().optional(),
    status: zod_1.z.enum(['draft', 'pending', 'paid', 'expired', 'cancelled']).optional()
});
//# sourceMappingURL=invoice.js.map