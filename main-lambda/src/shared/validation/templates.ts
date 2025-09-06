import { z } from 'zod';
import { CONSTANTS } from '../../types/common';

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

// Template creation schema
export const CreateTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name too long')
    .trim(),
  description: z.string()
    .max(500, 'Description too long')
    .trim()
    .optional(),
  defaultTitle: z.string()
    .max(255, 'Default title too long')
    .trim()
    .optional(),
  defaultDescription: z.string()
    .max(500, 'Default description too long')
    .trim()
    .optional(),
  defaultDueDays: z.number()
    .min(1, 'Due days must be at least 1')
    .max(365, 'Due days cannot exceed 365')
    .optional(),
  defaultNetworkId: idSchema.optional(),
  defaultTokenId: idSchema.optional(),
  configuration: z.object({
    autoSend: z.boolean().optional(),
    reminderDays: z.array(z.number().min(1).max(365)).optional(),
    customFields: z.array(z.object({
      name: z.string().min(1).max(100),
      required: z.boolean().optional().default(false),
      type: z.enum(['text', 'number', 'date', 'email']).optional().default('text')
    })).optional(),
    emailTemplate: z.object({
      subject: z.string().max(200).optional(),
      body: z.string().max(2000).optional()
    }).optional()
  }).optional()
});

// Template update schema
export const UpdateTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name too long')
    .trim()
    .optional(),
  description: z.string()
    .max(500, 'Description too long')
    .trim()
    .optional(),
  defaultTitle: z.string()
    .max(255, 'Default title too long')
    .trim()
    .optional(),
  defaultDescription: z.string()
    .max(500, 'Default description too long')
    .trim()
    .optional(),
  defaultDueDays: z.number()
    .min(1, 'Due days must be at least 1')
    .max(365, 'Due days cannot exceed 365')
    .optional(),
  defaultNetworkId: idSchema.optional(),
  defaultTokenId: idSchema.optional(),
  configuration: z.object({
    autoSend: z.boolean().optional(),
    reminderDays: z.array(z.number().min(1).max(365)).optional(),
    customFields: z.array(z.object({
      name: z.string().min(1).max(100),
      required: z.boolean().optional().default(false),
      type: z.enum(['text', 'number', 'date', 'email']).optional().default('text')
    })).optional(),
    emailTemplate: z.object({
      subject: z.string().max(200).optional(),
      body: z.string().max(2000).optional()
    }).optional()
  }).optional(),
  isActive: z.boolean().optional()
});

// Template filter schema for searching/listing
export const TemplateFilterSchema = z.object({
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .pipe(z.number().min(1).max(CONSTANTS.MAX_PAGE_SIZE))
    .optional()
    .default(CONSTANTS.DEFAULT_PAGE_SIZE.toString()),
  nextToken: z.string().optional(),
  name: z.string()
    .max(255, 'Name filter too long')
    .trim()
    .optional(),
  isActive: z.string()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    })
    .optional(),
  createdBy: z.string()
    .min(1, 'Creator filter cannot be empty')
    .optional(),
  hasCustomFields: z.string()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    })
    .optional(),
  hasDefaultNetwork: z.string()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    })
    .optional()
});

// Template ID parameter schema
export const TemplateIdSchema = z.object({
  id: idSchema
});

// Duplicate template schema
export const DuplicateTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name too long')
    .trim()
});

// Create invoice from template schema
export const CreateInvoiceFromTemplateSchema = z.object({
  templateId: idSchema,
  clientName: z.string()
    .min(1, 'Client name is required')
    .max(255, 'Client name too long')
    .trim(),
  clientEmail: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long'),
  clientWallet: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address format')
    .optional(),
  amount: z.number()
    .min(CONSTANTS.MIN_INVOICE_AMOUNT, `Amount must be at least ${CONSTANTS.MIN_INVOICE_AMOUNT}`)
    .max(CONSTANTS.MAX_INVOICE_AMOUNT, `Amount cannot exceed ${CONSTANTS.MAX_INVOICE_AMOUNT}`),
  dueDate: z.string()
    .datetime('Invalid due date format')
    .optional(),
  customData: z.record(z.any()).optional()
});

// Template statistics response schema
export const TemplateStatsSchema = z.object({
  total: z.number(),
  active: z.number(),
  inactive: z.number(),
  totalUsage: z.number(),
  mostUsed: z.object({
    id: idSchema,
    name: z.string(),
    usageCount: z.number()
  }).nullable().optional()
});

// Template preview request schema
export const TemplatePreviewSchema = z.object({
  customData: z.record(z.any()).optional()
});

// Export types
export type CreateTemplateRequest = z.infer<typeof CreateTemplateSchema>;
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateSchema>;
export type TemplateFilterRequest = z.infer<typeof TemplateFilterSchema>;
export type DuplicateTemplateRequest = z.infer<typeof DuplicateTemplateSchema>;
export type CreateInvoiceFromTemplateRequest = z.infer<typeof CreateInvoiceFromTemplateSchema>;
export type TemplatePreviewRequest = z.infer<typeof TemplatePreviewSchema>;