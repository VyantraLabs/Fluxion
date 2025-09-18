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

// Template Variable Schema
const TemplateVariableSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['text', 'number', 'date', 'select', 'boolean', 'email', 'url']),
  label: z.string().min(1).max(200),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  defaultValue: z.any().optional(),
  placeholder: z.string().optional(),
  validation: z.object({
    minLength: z.number().min(0).optional(),
    maxLength: z.number().min(0).optional(),
    pattern: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
});

// Template Schema
const TemplateSchemaSchema = z.object({
  requiredFields: z.array(z.string()).default([]),
  optionalFields: z.array(z.string()).default([]),
  customFields: z.array(TemplateVariableSchema).optional(),
});

// Branding Configuration Schema
const BrandingConfigSchema = z.object({
  logo: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  companyName: z.string().max(255).optional(),
  companyAddress: z.string().max(500).optional(),
  companyPhone: z.string().max(50).optional(),
  companyEmail: z.string().email().optional(),
  website: z.string().url().optional(),
  footerText: z.string().max(1000).optional(),
});

// Category-specific configurations
const InvoiceConfigSchema = z.object({
  autoReminders: z.boolean().optional(),
  reminderIntervals: z.array(z.number().min(1).max(365)).optional(),
  requireClientEmail: z.boolean().optional(),
  allowPartialPayments: z.boolean().optional(),
  showPaymentProgress: z.boolean().optional(),
  paymentInstructions: z.string().max(1000).optional(),
  terms: z.string().max(2000).optional(),
});

const PayrollConfigSchema = z.object({
  payPeriod: z.enum(['weekly', 'bi-weekly', 'monthly', 'quarterly']).optional(),
  includeDeductions: z.boolean().optional(),
  showGrossPay: z.boolean().optional(),
  showNetPay: z.boolean().optional(),
  taxCalculation: z.boolean().optional(),
});

const ContractConfigSchema = z.object({
  requireSignature: z.boolean().optional(),
  signatureFields: z.array(z.string()).optional(),
  autoExpiry: z.boolean().optional(),
  expiryDays: z.number().min(1).max(1095).optional(),
  notificationDays: z.array(z.number().min(1).max(365)).optional(),
});

// Template Configuration Schema
const TemplateConfigurationSchema = z.object({
  branding: BrandingConfigSchema.optional(),
  invoice: InvoiceConfigSchema.optional(),
  payroll: PayrollConfigSchema.optional(),
  contract: ContractConfigSchema.optional(),
  customCss: z.string().optional(),
  headerTemplate: z.string().optional(),
  footerTemplate: z.string().optional(),
  pageFormat: z.enum(['A4', 'Letter', 'Legal']).optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
});

// Create Template Schema
export const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(255, 'Template name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  categoryId: idSchema,
  content: z.record(z.any(), { message: 'Template content must be a valid object' }),
  isSystemTemplate: z.boolean().default(false).optional(), // For admin use only
});

// Update Template Schema
export const UpdateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(255, 'Template name too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  categoryId: idSchema.optional(),
  content: z.record(z.any(), { message: 'Template content must be a valid object' }).optional(),
  isActive: z.boolean().optional(),
});

// Template Upload Schema
export const TemplateUploadSchema = z.object({
  templateId: idSchema,
  file: z.any(), // Buffer or Readable stream
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  fileSize: z.number().min(1).max(10 * 1024 * 1024), // 10MB max
});

// Template Preview Schema
export const TemplatePreviewSchema = z.object({
  previewType: z.enum(['sample', 'real']),
  data: z.record(z.any()).optional(),
  format: z.enum(['html', 'pdf', 'json']).default('html'),
});

// Template Search Schema
export const TemplateSearchSchema = z.object({
  categoryId: idSchema.optional(),
  name: z.string().max(255).optional(),
  isSystemTemplate: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// Template Filter Schema (for backward compatibility with existing endpoints)
export const TemplateFilterSchema = z.object({
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .pipe(z.number().min(1).max(CONSTANTS?.MAX_PAGE_SIZE || 100))
    .optional()
    .default((CONSTANTS?.DEFAULT_PAGE_SIZE || 20).toString()),
  nextToken: z.string().optional(),
  page: z.number().min(1).optional(),
  name: z.string()
    .max(255, 'Name filter too long')
    .trim()
    .optional(),
  search: z.string()
    .max(255, 'Search term too long')
    .trim()
    .optional(),
  categoryId: idSchema.optional(),
  categoryIds: z.string()
    .transform((val) => val.split(',').map(id => id.trim()).filter(Boolean))
    .optional(),
  categories: z.string()
    .transform((val) => val.split(',').map(id => id.trim()).filter(Boolean))
    .optional(),
  isSystemTemplate: z.string()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    })
    .optional(),
  isActive: z.string()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    })
    .optional(),
  createdBy: idSchema.optional(),
  tags: z.string()
    .transform((val) => val.split(',').map(tag => tag.trim()).filter(Boolean))
    .optional(),
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

// Validation functions
export const validateTemplateCreate = (data: any) => {
  return CreateTemplateSchema.safeParse(data);
};

export const validateTemplateUpdate = (data: any) => {
  return UpdateTemplateSchema.safeParse(data);
};

export const validateTemplateUpload = (data: any) => {
  return TemplateUploadSchema.safeParse(data);
};

export const validateTemplatePreview = (data: any) => {
  return TemplatePreviewSchema.safeParse(data);
};

export const validateTemplateSearch = (data: any) => {
  return TemplateSearchSchema.safeParse(data);
};

export const validateTemplateFilter = (data: any) => {
  return TemplateFilterSchema.safeParse(data);
};

export const validateTemplateId = (data: any) => {
  return TemplateIdSchema.safeParse(data);
};

export const validateDuplicateTemplate = (data: any) => {
  return DuplicateTemplateSchema.safeParse(data);
};

// Type exports
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
export type TemplateUploadInput = z.infer<typeof TemplateUploadSchema>;
export type TemplatePreviewInput = z.infer<typeof TemplatePreviewSchema>;
export type TemplateSearchInput = z.infer<typeof TemplateSearchSchema>;
export type TemplateFilterInput = z.infer<typeof TemplateFilterSchema>;
export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;
export type TemplateSchemaType = z.infer<typeof TemplateSchemaSchema>;
export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
export type TemplateConfiguration = z.infer<typeof TemplateConfigurationSchema>;

// Legacy exports for backward compatibility
export type CreateTemplateRequest = CreateTemplateInput;
export type UpdateTemplateRequest = UpdateTemplateInput;
export type TemplateFilterRequest = TemplateFilterInput;
export type DuplicateTemplateRequest = z.infer<typeof DuplicateTemplateSchema>;
export type TemplatePreviewRequest = TemplatePreviewInput;