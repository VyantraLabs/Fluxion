import { z } from 'zod';

// Base schemas for reusable types
const ReminderTypeSchema = z.enum(['due_date', 'overdue', 'payment_pending', 'custom']);
const ReminderStatusSchema = z.enum(['scheduled', 'pending', 'processing', 'sent', 'failed', 'cancelled', 'skipped']);
const ReminderPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

// Time pattern for HH:MM format
const TimePatternSchema = z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
  message: 'Time must be in HH:MM format (24-hour)',
});

// Reminder configuration schema
const ReminderConfigurationSchema = z.object({
  intervalDays: z.number().int().min(0).max(365).describe('Days before/after due date'),
  isOverdueReminder: z.boolean().describe('Whether this is an overdue reminder'),
  businessDaysOnly: z.boolean().default(false).describe('Only send on business days'),
  excludeWeekends: z.boolean().default(false).describe('Exclude weekends'),
  reminderTime: TimePatternSchema.default('09:00').describe('Time of day to send reminder'),
  timezone: z.string().default('UTC').describe('Timezone for reminder scheduling'),
  customMessage: z.string().optional().describe('Custom message for the reminder'),
  emailTemplate: z.string().optional().describe('Override default email template'),
  webhookEnabled: z.boolean().default(false).describe('Enable webhook notifications'),
  smsEnabled: z.boolean().default(false).describe('Enable SMS notifications'),
  maxOccurrences: z.number().int().min(1).optional().describe('Maximum number of times to send'),
  conditions: z.object({
    minAmount: z.string().optional().describe('Minimum invoice amount'),
    maxAmount: z.string().optional().describe('Maximum invoice amount'),
    statuses: z.array(z.string()).optional().describe('Required invoice statuses'),
    excludeStatuses: z.array(z.string()).optional().describe('Excluded invoice statuses'),
  }).optional().describe('Conditions for when to send reminder'),
});

// Create reminder schema
export const CreateReminderSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required').describe('ID of the invoice'),
  type: ReminderTypeSchema.describe('Type of reminder'),
  configuration: ReminderConfigurationSchema.describe('Reminder configuration'),
  priority: ReminderPrioritySchema.default('normal').describe('Reminder priority'),
  maxOccurrences: z.number().int().min(1).optional().describe('Maximum occurrences'),
  scheduledFor: z.string().datetime().optional().describe('When to send the reminder (ISO datetime)'),
}).strict();

// Update reminder schema
export const UpdateReminderSchema = z.object({
  configuration: ReminderConfigurationSchema.partial().optional().describe('Updated configuration'),
  priority: ReminderPrioritySchema.optional().describe('Updated priority'),
  scheduledFor: z.string().datetime().optional().describe('Reschedule reminder (ISO datetime)'),
  maxOccurrences: z.number().int().min(1).optional().describe('Updated max occurrences'),
}).strict();

// Reminder filter schema for search/list operations
export const ReminderFilterSchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
  nextToken: z.string().optional(),
  status: ReminderStatusSchema.optional().describe('Filter by status'),
  type: ReminderTypeSchema.optional().describe('Filter by type'),
  invoiceId: z.string().optional().describe('Filter by invoice ID'),
  priority: ReminderPrioritySchema.optional().describe('Filter by priority'),
  scheduledFrom: z.string().datetime().optional().describe('Filter reminders scheduled after this date'),
  scheduledTo: z.string().datetime().optional().describe('Filter reminders scheduled before this date'),
  isOverdue: z.string().transform(val => val === 'true').optional().describe('Filter overdue reminders'),
}).strict();

// Reminder ID parameter schema
export const ReminderIdSchema = z.object({
  id: z.string().min(1, 'Reminder ID is required').describe('Reminder ID'),
}).strict();

// Bulk reminder creation schema
export const BulkReminderSchema = z.object({
  invoiceIds: z.array(z.string().min(1))
    .min(1, 'At least one invoice ID is required')
    .max(100, 'Maximum 100 invoices allowed per bulk operation')
    .describe('Array of invoice IDs'),
  reminderType: ReminderTypeSchema.describe('Type of reminders to create'),
  configuration: ReminderConfigurationSchema.describe('Configuration for all reminders'),
  replaceExisting: z.boolean().default(false).describe('Replace existing reminders'),
}).strict();

// Invoice reminder setup schema
export const InvoiceReminderSetupSchema = z.object({
  reminderType: z.enum(['standard', 'aggressive', 'minimal', 'custom'])
    .default('standard')
    .describe('Predefined reminder schedule type'),
  customSchedule: z.object({
    dueDateReminders: z.array(z.number().int().min(0).max(365)).optional()
      .describe('Days before due date to send reminders'),
    overdueReminders: z.array(z.number().int().min(0).max(365)).optional()
      .describe('Days after due date to send reminders'),
  }).optional().describe('Custom reminder schedule (required if type is custom)'),
  replaceExisting: z.boolean().default(false).describe('Replace existing reminders'),
}).strict();

// Reminder execution result schema
export const ReminderExecutionResultSchema = z.object({
  executed: z.boolean().describe('Whether the reminder was executed'),
  notificationId: z.string().optional().describe('ID of created notification'),
  message: z.string().describe('Result message'),
});

// Type exports
export type CreateReminderRequest = z.infer<typeof CreateReminderSchema>;
export type UpdateReminderRequest = z.infer<typeof UpdateReminderSchema>;
export type ReminderFilterRequest = z.infer<typeof ReminderFilterSchema>;
export type BulkReminderRequest = z.infer<typeof BulkReminderSchema>;
export type InvoiceReminderSetupRequest = z.infer<typeof InvoiceReminderSetupSchema>;
export type ReminderConfiguration = z.infer<typeof ReminderConfigurationSchema>;

// Validation helper functions
export const validateReminderTime = (time: string): boolean => {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
};

export const validateReminderSchedule = (
  dueDateReminders: number[],
  overdueReminders: number[]
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check for duplicate intervals
  const allReminders = [...dueDateReminders, ...overdueReminders];
  const uniqueReminders = new Set(allReminders);
  if (uniqueReminders.size !== allReminders.length) {
    errors.push('Duplicate reminder intervals are not allowed');
  }

  // Check for reasonable limits
  if (dueDateReminders.length + overdueReminders.length > 10) {
    errors.push('Maximum 10 reminders allowed per invoice');
  }

  // Check for reasonable intervals
  const maxInterval = Math.max(...allReminders);
  if (maxInterval > 365) {
    errors.push('Reminder intervals cannot exceed 365 days');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const getReminderScheduleDefaults = (type: string): {
  dueDateReminders: number[];
  overdueReminders: number[];
} => {
  switch (type) {
    case 'minimal':
      return {
        dueDateReminders: [3], // 3 days before
        overdueReminders: [7], // 7 days after
      };
    case 'standard':
      return {
        dueDateReminders: [7, 3, 1], // 7, 3, 1 days before
        overdueReminders: [1, 7, 14], // 1, 7, 14 days after
      };
    case 'aggressive':
      return {
        dueDateReminders: [14, 7, 3, 1], // 14, 7, 3, 1 days before
        overdueReminders: [1, 3, 7, 14, 30], // 1, 3, 7, 14, 30 days after
      };
    default:
      return {
        dueDateReminders: [7, 3, 1],
        overdueReminders: [1, 7, 14],
      };
  }
};

// Reminder condition validation
export const validateReminderConditions = (conditions: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (conditions.minAmount && conditions.maxAmount) {
    const min = parseFloat(conditions.minAmount);
    const max = parseFloat(conditions.maxAmount);
    if (min >= max) {
      errors.push('Minimum amount must be less than maximum amount');
    }
  }

  if (conditions.statuses && conditions.excludeStatuses) {
    const overlap = conditions.statuses.filter((status: string) =>
      conditions.excludeStatuses.includes(status)
    );
    if (overlap.length > 0) {
      errors.push(`Status overlap detected: ${overlap.join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Export validation schemas for external use
export {
  ReminderTypeSchema,
  ReminderStatusSchema,
  ReminderPrioritySchema,
  ReminderConfigurationSchema,
  TimePatternSchema,
};