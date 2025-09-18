"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetPaymentsQuerySchema = exports.VerifyPaymentSchema = void 0;
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
exports.VerifyPaymentSchema = zod_1.z.object({
    invoice_id: idSchema,
    tx_hash: zod_1.z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
    from_address: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid from address')
});
exports.GetPaymentsQuerySchema = zod_1.z.object({
    invoice_id: idSchema.optional(),
    limit: zod_1.z.string().transform(val => parseInt(val)).refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100').optional(),
    nextToken: zod_1.z.string().optional()
});
//# sourceMappingURL=payment.js.map