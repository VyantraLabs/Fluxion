/**
 * Comprehensive types for notification-lambda SQS message processing
 * Aligns with main-lambda notification system
 */

// Base notification types matching main-lambda validation schema
export type NotificationType = 
  | 'invoice_sent'
  | 'payment_received' 
  | 'payment_failed'
  | 'payment_reminder'
  | 'payment_overdue'
  | 'invoice_viewed';

export type NotificationChannel = 'email' | 'webhook' | 'sms';
export type NotificationPriority = 'high' | 'medium' | 'low';
export type NotificationStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'retrying';

// Core SQS notification message interface
export interface SQSNotificationMessage {
  type: NotificationType;
  recipientEmail: string;
  templateData: TemplateDataUnion;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  scheduleAt?: string;
  metadata: NotificationMetadata;
}

// Metadata for tracking and correlation
export interface NotificationMetadata {
  organizationId: string;
  userId: string;
  correlationId: string;
  requestId: string;
  timestamp: string;
  retryAttempt?: number;
  sourceService: 'main-lambda' | 'background-job';
  environment: 'development' | 'staging' | 'production';
}

// Template data interfaces for each notification type
export interface InvoiceSentTemplateData {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  creatorName: string;
  organizationName: string;
  amount: string;
  currency: string; // e.g., 'USDC', 'ETH'
  dueDate: string;
  description: string;
  paymentUrl: string;
  networkName: string; // e.g., 'Ethereum', 'Polygon'
  invoiceViewUrl: string;
  currentYear: number;
}

export interface PaymentReceivedTemplateData {
  invoiceId: string;
  invoiceNumber: string;
  paymentId: string;
  clientName: string;
  creatorEmail: string;
  organizationName: string;
  amount: string;
  currency: string;
  transactionHash: string;
  transactionUrl: string; // blockchain explorer URL
  paymentDate: string;
  networkName: string;
  currentYear: number;
}

export interface PaymentFailedTemplateData {
  invoiceId: string;
  invoiceNumber: string;
  paymentId: string;
  clientName: string;
  creatorEmail: string;
  organizationName: string;
  amount: string;
  currency: string;
  transactionHash?: string;
  errorReason: string;
  errorCode?: string;
  paymentUrl: string;
  supportEmail: string;
  currentYear: number;
}

export interface PaymentReminderTemplateData {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  creatorName: string;
  organizationName: string;
  amount: string;
  currency: string;
  dueDate: string;
  daysPastDue: number;
  paymentUrl: string;
  urgencyLevel: 'gentle' | 'firm' | 'urgent';
  currentYear: number;
}

export interface PaymentOverdueTemplateData {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  creatorName: string;
  organizationName: string;
  amount: string;
  currency: string;
  dueDate: string;
  daysPastDue: number;
  paymentUrl: string;
  lateFee?: string;
  escalationLevel: number; // 1, 2, 3 for progressive urgency
  currentYear: number;
}

export interface InvoiceViewedTemplateData {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  creatorEmail: string;
  organizationName: string;
  amount: string;
  currency: string;
  viewedAt: string;
  ipAddress?: string;
  userAgent?: string;
  currentYear: number;
}

// Union type for all template data
export type TemplateDataUnion = 
  | InvoiceSentTemplateData
  | PaymentReceivedTemplateData
  | PaymentFailedTemplateData
  | PaymentReminderTemplateData
  | PaymentOverdueTemplateData
  | InvoiceViewedTemplateData;

// Email delivery interfaces
export interface EmailDeliveryRequest {
  notificationId: string;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  attachments?: EmailAttachment[];
  priority: NotificationPriority;
  metadata: NotificationMetadata;
}

export interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  contentType: string;
  size: number;
}

export interface EmailDeliveryResult {
  messageId: string;
  status: 'sent' | 'failed';
  provider: 'ses' | 'sendgrid' | 'smtp';
  error?: string;
  deliveredAt: string;
}

// Webhook delivery interfaces
export interface WebhookDeliveryRequest {
  notificationId: string;
  webhookUrl: string;
  payload: WebhookPayload;
  signature: string;
  retryAttempt: number;
  metadata: NotificationMetadata;
}

export interface WebhookPayload {
  event: NotificationType;
  timestamp: string;
  data: {
    invoice: InvoiceWebhookData;
    payment?: PaymentWebhookData;
    organization: OrganizationWebhookData;
  };
  metadata: {
    notificationId: string;
    correlationId: string;
    version: '1.0';
  };
}

export interface InvoiceWebhookData {
  id: string;
  number: string;
  amount: string;
  currency: string;
  status: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentWebhookData {
  id: string;
  amount: string;
  currency: string;
  transactionHash: string;
  network: string;
  status: string;
  processedAt: string;
}

export interface OrganizationWebhookData {
  id: string;
  name: string;
  email: string;
}

export interface WebhookDeliveryResult {
  status: 'sent' | 'failed';
  httpStatus?: number;
  responseBody?: string;
  error?: string;
  deliveredAt: string;
  nextRetryAt?: string;
}

// Background job interfaces
export interface PaymentVerificationJob {
  jobId: string;
  type: 'payment_verification';
  invoiceId: string;
  transactionHash: string;
  networkId: number;
  expectedAmount: string;
  expectedRecipient: string;
  tokenAddress: string;
  retryAttempt: number;
  metadata: NotificationMetadata;
}

export interface ScheduledNotificationJob {
  jobId: string;
  type: 'scheduled_notification';
  notificationType: NotificationType;
  recipientEmail: string;
  templateData: TemplateDataUnion;
  scheduleAt: string;
  channels: NotificationChannel[];
  metadata: NotificationMetadata;
}

export interface ReminderEscalationJob {
  jobId: string;
  type: 'reminder_escalation';
  invoiceId: string;
  escalationLevel: number; // 1, 2, 3
  daysPastDue: number;
  lastReminderSent: string;
  metadata: NotificationMetadata;
}

export type BackgroundJob = 
  | PaymentVerificationJob
  | ScheduledNotificationJob
  | ReminderEscalationJob;

// Processing result interfaces
export interface NotificationProcessingResult {
  notificationId: string;
  type: NotificationType;
  status: NotificationStatus;
  channels: NotificationChannel[];
  results: {
    email?: EmailDeliveryResult;
    webhook?: WebhookDeliveryResult;
    sms?: any; // Future implementation
  };
  processingTimeMs: number;
  error?: string;
  processedAt: string;
}

// Service configuration interfaces
export interface EmailServiceConfig {
  provider: 'ses' | 'sendgrid' | 'smtp';
  ses?: {
    region: string;
    fromEmail: string;
    fromName: string;
  };
  sendgrid?: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
}

export interface WebhookServiceConfig {
  maxRetryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
  signatureSecret: string;
}

export interface BlockchainServiceConfig {
  networks: {
    [networkId: number]: {
      name: string;
      rpcUrl: string;
      explorerUrl: string;
      currency: string;
    };
  };
  confirmationBlocks: number;
  timeoutMs: number;
}

// Error handling interfaces
export interface NotificationError {
  code: string;
  message: string;
  type: 'validation' | 'provider' | 'network' | 'timeout' | 'system';
  retryable: boolean;
  details?: Record<string, any>;
  timestamp: string;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// Monitoring and metrics interfaces
export interface NotificationMetrics {
  totalProcessed: number;
  successful: number;
  failed: number;
  retries: number;
  averageProcessingTimeMs: number;
  channelBreakdown: {
    email: { sent: number; failed: number };
    webhook: { sent: number; failed: number };
    sms: { sent: number; failed: number };
  };
  typeBreakdown: {
    [key in NotificationType]: { sent: number; failed: number };
  };
  providerBreakdown: {
    ses: { sent: number; failed: number };
    sendgrid: { sent: number; failed: number };
    smtp: { sent: number; failed: number };
  };
}

// Template validation interfaces
export interface TemplateValidationResult {
  valid: boolean;
  missingVariables: string[];
  invalidVariables: string[];
  errors: string[];
}

export interface CompiledTemplate {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
}

// Export utility type guards
export const isInvoiceSentTemplate = (data: TemplateDataUnion): data is InvoiceSentTemplateData => {
  return 'invoiceNumber' in data && 'clientName' in data && 'paymentUrl' in data;
};

export const isPaymentReceivedTemplate = (data: TemplateDataUnion): data is PaymentReceivedTemplateData => {
  return 'paymentId' in data && 'transactionHash' in data;
};

export const isPaymentFailedTemplate = (data: TemplateDataUnion): data is PaymentFailedTemplateData => {
  return 'paymentId' in data && 'errorReason' in data;
};

export const isPaymentReminderTemplate = (data: TemplateDataUnion): data is PaymentReminderTemplateData => {
  return 'daysPastDue' in data && 'urgencyLevel' in data;
};

export const isPaymentOverdueTemplate = (data: TemplateDataUnion): data is PaymentOverdueTemplateData => {
  return 'daysPastDue' in data && 'escalationLevel' in data;
};

export const isInvoiceViewedTemplate = (data: TemplateDataUnion): data is InvoiceViewedTemplateData => {
  return 'viewedAt' in data && 'creatorEmail' in data;
};