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

// Email validation
const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email too long');

// Send notification schema
export const SendNotificationSchema = z.object({
  type: z.enum([
    'invoice_sent',
    'payment_received', 
    'payment_failed',
    'payment_reminder',
    'payment_overdue',
    'invoice_viewed'
  ], {
    errorMap: () => ({ message: 'Invalid notification type' })
  }),
  recipientEmail: emailSchema,
  templateData: z.record(z.any())
    .refine(data => Object.keys(data).length > 0, {
      message: 'Template data cannot be empty'
    }),
  channels: z.array(z.enum(['email', 'webhook', 'sms']))
    .optional()
    .default(['email'])
    .refine(channels => channels.length > 0, {
      message: 'At least one notification channel is required'
    }),
  priority: z.enum(['high', 'medium', 'low'])
    .optional()
    .default('medium'),
  scheduleAt: z.string()
    .datetime('Invalid schedule date format')
    .optional()
    .refine(dateStr => {
      if (!dateStr) return true;
      const scheduleDate = new Date(dateStr);
      const now = new Date();
      return scheduleDate > now;
    }, {
      message: 'Schedule date must be in the future'
    })
});

// Notification filter schema
export const NotificationFilterSchema = z.object({
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .pipe(z.number().min(1).max(CONSTANTS.MAX_PAGE_SIZE))
    .optional()
    .default(CONSTANTS.DEFAULT_PAGE_SIZE.toString()),
  nextToken: z.string().optional(),
  type: z.enum([
    'invoice_sent',
    'payment_received', 
    'payment_failed',
    'payment_reminder',
    'payment_overdue',
    'invoice_viewed'
  ]).optional(),
  status: z.enum(['pending', 'sent', 'failed', 'cancelled']).optional(),
  startDate: z.string()
    .datetime('Invalid start date format')
    .optional(),
  endDate: z.string()
    .datetime('Invalid end date format')
    .optional()
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'Start date must be before or equal to end date',
  path: ['endDate']
});

// Notification ID parameter schema
export const NotificationIdSchema = z.object({
  id: idSchema
});

// Bulk notification schema
export const BulkNotificationSchema = z.object({
  type: z.enum([
    'invoice_sent',
    'payment_received', 
    'payment_failed',
    'payment_reminder',
    'payment_overdue',
    'invoice_viewed'
  ]),
  recipients: z.array(z.object({
    email: emailSchema,
    templateData: z.record(z.any())
  }))
    .min(1, 'At least one recipient is required')
    .max(100, 'Maximum 100 recipients allowed per bulk notification'),
  channels: z.array(z.enum(['email', 'webhook', 'sms']))
    .optional()
    .default(['email']),
  priority: z.enum(['high', 'medium', 'low'])
    .optional()
    .default('medium'),
  scheduleAt: z.string()
    .datetime('Invalid schedule date format')
    .optional()
});

// Notification template schema
export const NotificationTemplateSchema = z.object({
  type: z.enum([
    'invoice_sent',
    'payment_received', 
    'payment_failed',
    'payment_reminder',
    'payment_overdue',
    'invoice_viewed'
  ]),
  subject: z.string()
    .min(1, 'Subject is required')
    .max(200, 'Subject too long'),
  bodyHtml: z.string()
    .min(1, 'HTML body is required')
    .max(10000, 'HTML body too long'),
  bodyText: z.string()
    .min(1, 'Text body is required')
    .max(5000, 'Text body too long'),
  variables: z.array(z.string())
    .optional()
    .describe('List of template variables (e.g., {{clientName}}, {{amount}})'),
  isActive: z.boolean()
    .optional()
    .default(true)
});

// Notification settings schema
export const NotificationSettingsSchema = z.object({
  emailNotifications: z.object({
    invoiceSent: z.boolean().default(true),
    paymentReceived: z.boolean().default(true),
    paymentFailed: z.boolean().default(true),
    paymentReminder: z.boolean().default(true),
    paymentOverdue: z.boolean().default(true)
  }).optional(),
  webhookNotifications: z.object({
    enabled: z.boolean().default(false),
    url: z.string().url('Invalid webhook URL').optional(),
    events: z.array(z.enum([
      'invoice_sent',
      'payment_received', 
      'payment_failed',
      'payment_reminder',
      'payment_overdue'
    ])).optional()
  }).optional(),
  reminderSettings: z.object({
    enabled: z.boolean().default(true),
    daysBeforeDue: z.array(z.number().min(1).max(90))
      .default([7, 3, 1])
      .refine(days => days.length <= 5, {
        message: 'Maximum 5 reminder days allowed'
      }),
    overdueReminders: z.boolean().default(true),
    maxOverdueReminders: z.number().min(1).max(10).default(3)
  }).optional()
});

// Notification statistics query schema
export const NotificationStatsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year'])
    .optional()
    .default('month'),
  type: z.enum([
    'invoice_sent',
    'payment_received', 
    'payment_failed',
    'payment_reminder',
    'payment_overdue',
    'invoice_viewed'
  ]).optional(),
  startDate: z.string()
    .datetime('Invalid start date format')
    .optional(),
  endDate: z.string()
    .datetime('Invalid end date format')
    .optional()
});

// Webhook delivery schema
export const WebhookDeliverySchema = z.object({
  notificationId: idSchema,
  webhookUrl: z.string().url('Invalid webhook URL'),
  payload: z.record(z.any()),
  signature: z.string().optional(),
  retryAttempt: z.number().min(0).max(5).default(0)
});

// Email delivery schema
export const EmailDeliverySchema = z.object({
  notificationId: idSchema,
  recipientEmail: emailSchema,
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1),
  bodyText: z.string().min(1),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // base64 encoded
    contentType: z.string()
  })).optional()
});

// Export types
export type SendNotificationRequest = z.infer<typeof SendNotificationSchema>;
export type NotificationFilterRequest = z.infer<typeof NotificationFilterSchema>;
export type BulkNotificationRequest = z.infer<typeof BulkNotificationSchema>;
export type NotificationTemplateRequest = z.infer<typeof NotificationTemplateSchema>;
export type NotificationSettingsRequest = z.infer<typeof NotificationSettingsSchema>;
export type NotificationStatsQuery = z.infer<typeof NotificationStatsQuerySchema>;
export type WebhookDeliveryRequest = z.infer<typeof WebhookDeliverySchema>;
export type EmailDeliveryRequest = z.infer<typeof EmailDeliverySchema>;