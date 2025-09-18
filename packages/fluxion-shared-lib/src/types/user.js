"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetUserStatsQuerySchema = exports.CompleteOnboardingSchema = exports.UpdateUserProfileSchema = exports.AuthenticateWalletSchema = void 0;
const zod_1 = require("zod");
exports.AuthenticateWalletSchema = zod_1.z.object({
    wallet_address: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
    signature: zod_1.z.string().min(1, 'Signature is required'),
    message: zod_1.z.string().min(1, 'Message is required')
});
exports.UpdateUserProfileSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').optional(),
    display_name: zod_1.z.string().min(1, 'Display name is required').max(50).optional(),
    notification_preferences: zod_1.z.object({
        email_on_payment: zod_1.z.boolean(),
        email_on_invoice_viewed: zod_1.z.boolean(),
        email_on_reminders: zod_1.z.boolean()
    }).optional()
});
exports.CompleteOnboardingSchema = zod_1.z.object({
    organizationName: zod_1.z.string().min(2, 'Organization name must be at least 2 characters').max(100, 'Organization name too long'),
    displayName: zod_1.z.string().min(1, 'Display name is required').max(50).optional(),
    email: zod_1.z.string().email('Invalid email address').optional()
});
exports.GetUserStatsQuerySchema = zod_1.z.object({
    wallet_address: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address')
});
//# sourceMappingURL=user.js.map