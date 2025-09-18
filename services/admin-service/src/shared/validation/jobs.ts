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

// Trigger job schema
export const TriggerJobSchema = z.object({
  jobType: z.enum([
    'payment_verification',
    'email_delivery',
    'reminder_processing',
    'scheduled_notifications'
  ], {
    errorMap: () => ({ message: 'Invalid job type' })
  }),
  parameters: z.record(z.any())
    .optional()
    .refine(params => {
      if (!params) return true;
      // Validate based on job type if needed
      return true;
    }, {
      message: 'Invalid job parameters'
    })
});

// Job filter schema
export const JobFilterSchema = z.object({
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .pipe(z.number().min(1).max(CONSTANTS.MAX_PAGE_SIZE))
    .optional()
    .default(CONSTANTS.DEFAULT_PAGE_SIZE.toString()),
  nextToken: z.string().optional(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']).optional(),
  jobType: z.enum([
    'payment_verification',
    'email_delivery',
    'reminder_processing',
    'scheduled_notifications'
  ]).optional()
});

// Job ID parameter schema
export const JobIdSchema = z.object({
  id: idSchema
});

// Payment verification job parameters schema
export const PaymentVerificationJobSchema = z.object({
  invoiceId: idSchema.optional(),
  paymentId: idSchema.optional(),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  maxRetries: z.number().min(0).max(10).optional().default(3)
}).refine(data => {
  return data.invoiceId || data.paymentId;
}, {
  message: 'Either invoiceId or paymentId is required',
  path: ['invoiceId']
});

// Email delivery job parameters schema
export const EmailDeliveryJobSchema = z.object({
  notificationId: idSchema.optional(),
  invoiceId: idSchema.optional(),
  type: z.enum(['invoice_sent', 'payment_reminder', 'payment_overdue']).optional(),
  customMessage: z.string().max(500).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium')
}).refine(data => {
  return data.notificationId || data.invoiceId;
}, {
  message: 'Either notificationId or invoiceId is required',
  path: ['notificationId']
});

// Reminder processing job parameters schema
export const ReminderProcessingJobSchema = z.object({
  organizationId: idSchema.optional(),
  reminderType: z.enum(['due_soon', 'overdue', 'all']).optional().default('all'),
  daysBeforeDue: z.array(z.number().min(1).max(90)).optional(),
  maxReminders: z.number().min(1).max(1000).optional().default(100)
});

// Scheduled notifications job parameters schema
export const ScheduledNotificationsJobSchema = z.object({
  organizationId: idSchema.optional(),
  notificationType: z.enum([
    'invoice_sent',
    'payment_received', 
    'payment_failed',
    'payment_reminder',
    'payment_overdue',
    'invoice_viewed'
  ]).optional(),
  maxNotifications: z.number().min(1).max(1000).optional().default(100)
});

// Job status update schema
export const UpdateJobStatusSchema = z.object({
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  errorMessage: z.string().max(1000).optional(),
  result: z.record(z.any()).optional(),
  completedAt: z.string().datetime().optional()
});

// Job configuration schema
export const JobConfigurationSchema = z.object({
  enabled: z.boolean().default(true),
  maxConcurrentJobs: z.number().min(1).max(100).default(10),
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(1000).max(300000).default(5000), // 1s to 5min in milliseconds
  jobTimeout: z.number().min(5000).max(3600000).default(30000), // 5s to 1hr in milliseconds
  cleanupInterval: z.number().min(3600).max(604800).default(86400), // 1hr to 1week in seconds
  retentionPeriod: z.number().min(86400).max(31536000).default(2592000) // 1day to 1year in seconds
});

// Bulk job operation schema
export const BulkJobOperationSchema = z.object({
  jobIds: z.array(idSchema)
    .min(1, 'At least one job ID is required')
    .max(50, 'Maximum 50 jobs can be processed at once'),
  operation: z.enum(['retry', 'cancel', 'delete']),
  force: z.boolean().optional().default(false)
});

// Job statistics query schema
export const JobStatsQuerySchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
  jobType: z.enum([
    'payment_verification',
    'email_delivery',
    'reminder_processing',
    'scheduled_notifications'
  ]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// Job scheduling schema
export const ScheduleJobSchema = z.object({
  jobType: z.enum([
    'payment_verification',
    'email_delivery',
    'reminder_processing',
    'scheduled_notifications'
  ]),
  parameters: z.record(z.any()).optional(),
  scheduleAt: z.string().datetime('Invalid schedule date format'),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  maxRetries: z.number().min(0).max(10).optional().default(3)
}).refine(data => {
  const scheduleDate = new Date(data.scheduleAt);
  const now = new Date();
  return scheduleDate > now;
}, {
  message: 'Schedule date must be in the future',
  path: ['scheduleAt']
});

// Cron job configuration schema
export const CronJobConfigSchema = z.object({
  name: z.string().min(1).max(100),
  jobType: z.enum([
    'payment_verification',
    'email_delivery',
    'reminder_processing',
    'scheduled_notifications'
  ]),
  cronExpression: z.string()
    .regex(/^(\*|[0-5]?\d) (\*|1?\d|2[0-3]) (\*|[0-2]?\d|3[01]) (\*|1[012]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC) (\*|[0-6]|SUN|MON|TUE|WED|THU|FRI|SAT)$/, 
      'Invalid cron expression'),
  parameters: z.record(z.any()).optional(),
  enabled: z.boolean().default(true),
  timezone: z.string().optional().default('UTC'),
  description: z.string().max(500).optional()
});

// Export types
export type TriggerJobRequest = z.infer<typeof TriggerJobSchema>;
export type JobFilterRequest = z.infer<typeof JobFilterSchema>;
export type PaymentVerificationJobRequest = z.infer<typeof PaymentVerificationJobSchema>;
export type EmailDeliveryJobRequest = z.infer<typeof EmailDeliveryJobSchema>;
export type ReminderProcessingJobRequest = z.infer<typeof ReminderProcessingJobSchema>;
export type ScheduledNotificationsJobRequest = z.infer<typeof ScheduledNotificationsJobSchema>;
export type UpdateJobStatusRequest = z.infer<typeof UpdateJobStatusSchema>;
export type JobConfigurationRequest = z.infer<typeof JobConfigurationSchema>;
export type BulkJobOperationRequest = z.infer<typeof BulkJobOperationSchema>;
export type JobStatsQuery = z.infer<typeof JobStatsQuerySchema>;
export type ScheduleJobRequest = z.infer<typeof ScheduleJobSchema>;
export type CronJobConfigRequest = z.infer<typeof CronJobConfigSchema>;