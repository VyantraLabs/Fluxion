import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Logger } from '@/shared/utils/logger';
import { config } from '@/config';
import { Invoice } from '@/types/invoice';
import { Payment } from '@/types/payment';

export interface NotificationMessage {
  type: 'INVOICE_CREATED' | 'PAYMENT_RECEIVED' | 'INVOICE_REMINDER' | 'PAYMENT_FAILED';
  data: any;
  recipient: string;
  priority: 'high' | 'normal' | 'low';
}

export interface InvoiceCreatedNotification {
  invoice_id: string;
  client_email: string;
  client_name: string;
  creator_name: string;
  amount: number;
  payment_url: string;
  due_date: string;
  description: string;
}

export interface PaymentReceivedNotification {
  invoice_id: string;
  payment_id: string;
  creator_email?: string;
  client_name: string;
  amount: number;
  tx_hash: string;
  payment_date: string;
}

export interface InvoiceReminderNotification {
  invoice_id: string;
  client_email: string;
  client_name: string;
  creator_name: string;
  amount: number;
  payment_url: string;
  due_date: string;
  days_overdue: number;
}

export interface PaymentFailedNotification {
  invoice_id: string;
  payment_id: string;
  creator_email?: string;
  client_name: string;
  amount: number;
  tx_hash: string;
  error_reason: string;
}

export class NotificationService {
  private sqs: SQSClient;
  private queueUrl: string;
  private logger: Logger;

  constructor() {
    this.sqs = new SQSClient({ region: config.aws.region });
    this.queueUrl = config.aws.sqs.notificationQueueUrl;
    this.logger = new Logger('NotificationService');

    if (!this.queueUrl) {
      this.logger.warn('Notification queue URL not configured');
    }
  }

  /**
   * Send invoice created notification
   */
  async sendInvoiceCreated(invoice: Invoice, creatorName?: string): Promise<void> {
    const notificationData: InvoiceCreatedNotification = {
      invoice_id: invoice.invoice_id,
      client_email: invoice.client_email,
      client_name: invoice.client_name,
      creator_name: creatorName || this.formatWalletAddress(invoice.creator_wallet),
      amount: invoice.amount,
      payment_url: invoice.payment_url,
      due_date: invoice.due_date,
      description: invoice.description
    };

    await this.sendNotification({
      type: 'INVOICE_CREATED',
      data: notificationData,
      recipient: invoice.client_email,
      priority: 'normal'
    });

    this.logger.info('Invoice created notification sent', { 
      invoice_id: invoice.invoice_id,
      recipient: invoice.client_email 
    });
  }

  /**
   * Send payment received notification
   */
  async sendPaymentReceived(
    invoice: Invoice, 
    payment: Payment,
    creatorEmail?: string
  ): Promise<void> {
    if (!creatorEmail) {
      this.logger.warn('Creator email not available for payment notification', {
        invoice_id: invoice.invoice_id,
        payment_id: payment.payment_id
      });
      return;
    }

    const notificationData: PaymentReceivedNotification = {
      invoice_id: invoice.invoice_id,
      payment_id: payment.payment_id,
      creator_email: creatorEmail,
      client_name: invoice.client_name,
      amount: payment.amount,
      tx_hash: payment.tx_hash,
      payment_date: payment.created_at
    };

    await this.sendNotification({
      type: 'PAYMENT_RECEIVED',
      data: notificationData,
      recipient: creatorEmail,
      priority: 'high'
    });

    this.logger.info('Payment received notification sent', { 
      invoice_id: invoice.invoice_id,
      payment_id: payment.payment_id,
      recipient: creatorEmail
    });
  }

  /**
   * Send invoice reminder notification
   */
  async sendInvoiceReminder(
    invoice: Invoice, 
    daysOverdue: number,
    creatorName?: string
  ): Promise<void> {
    const notificationData: InvoiceReminderNotification = {
      invoice_id: invoice.invoice_id,
      client_email: invoice.client_email,
      client_name: invoice.client_name,
      creator_name: creatorName || this.formatWalletAddress(invoice.creator_wallet),
      amount: invoice.amount,
      payment_url: invoice.payment_url,
      due_date: invoice.due_date,
      days_overdue: daysOverdue
    };

    await this.sendNotification({
      type: 'INVOICE_REMINDER',
      data: notificationData,
      recipient: invoice.client_email,
      priority: 'normal'
    });

    this.logger.info('Invoice reminder notification sent', { 
      invoice_id: invoice.invoice_id,
      recipient: invoice.client_email,
      days_overdue: daysOverdue
    });
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailed(
    invoice: Invoice,
    payment: Payment,
    errorReason: string,
    creatorEmail?: string
  ): Promise<void> {
    if (!creatorEmail) {
      this.logger.warn('Creator email not available for payment failed notification', {
        invoice_id: invoice.invoice_id,
        payment_id: payment.payment_id
      });
      return;
    }

    const notificationData: PaymentFailedNotification = {
      invoice_id: invoice.invoice_id,
      payment_id: payment.payment_id,
      creator_email: creatorEmail,
      client_name: invoice.client_name,
      amount: payment.amount,
      tx_hash: payment.tx_hash,
      error_reason: errorReason
    };

    await this.sendNotification({
      type: 'PAYMENT_FAILED',
      data: notificationData,
      recipient: creatorEmail,
      priority: 'high'
    });

    this.logger.info('Payment failed notification sent', { 
      invoice_id: invoice.invoice_id,
      payment_id: payment.payment_id,
      recipient: creatorEmail,
      error_reason: errorReason
    });
  }

  /**
   * Send notification to SQS queue
   */
  private async sendNotification(notification: NotificationMessage): Promise<void> {
    if (!this.queueUrl) {
      this.logger.error('Cannot send notification: queue URL not configured', {
        type: notification.type,
        recipient: notification.recipient
      });
      return;
    }

    try {
      const messageBody = JSON.stringify({
        ...notification,
        timestamp: new Date().toISOString(),
        requestId: process.env.AWS_REQUEST_ID || 'unknown'
      });

      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: messageBody,
        MessageAttributes: {
          NotificationType: {
            DataType: 'String',
            StringValue: notification.type
          },
          Priority: {
            DataType: 'String',
            StringValue: notification.priority
          },
          Recipient: {
            DataType: 'String',
            StringValue: notification.recipient
          }
        },
        // Set delay for low priority messages
        DelaySeconds: notification.priority === 'low' ? 60 : 0
      });

      await this.sqs.send(command);

      this.logger.info('Notification queued successfully', {
        type: notification.type,
        recipient: notification.recipient,
        priority: notification.priority
      });
    } catch (error) {
      this.logger.error('Failed to queue notification', {
        error,
        type: notification.type,
        recipient: notification.recipient
      });
      throw error;
    }
  }

  /**
   * Format wallet address for display
   */
  private formatWalletAddress(walletAddress: string): string {
    if (walletAddress.length < 10) return walletAddress;
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }

  /**
   * Validate email address format
   * @unused Currently not used but kept for future email validation needs
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-ignore - Currently unused but kept for future needs
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Health check for notification service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      if (!this.queueUrl) {
        throw new Error('Queue URL not configured');
      }

      // Try to send a test message (this won't actually be processed by notification lambda)
      const testMessage = {
        type: 'HEALTH_CHECK' as const,
        data: { test: true },
        recipient: 'test@example.com',
        priority: 'low' as const
      };

      // Just validate we can create the command (don't actually send it)
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(testMessage),
        MessageAttributes: {
          NotificationType: {
            DataType: 'String',
            StringValue: 'HEALTH_CHECK'
          }
        }
      });

      if (!command) {
        throw new Error('Failed to create SQS command');
      }
      
      const latency = Date.now() - startTime;
      
      this.logger.debug('Notification service health check passed', { latency });
      return { status: 'healthy', latency };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('Notification service health check failed', { error: error.message, latency });
      return { 
        status: 'unhealthy', 
        latency,
        error: error.message 
      };
    }
  }

  /**
   * Get queue URL for debugging
   */
  getQueueUrl(): string {
    return this.queueUrl;
  }
}

// Singleton instance
let notificationInstance: NotificationService | null = null;

export const getNotificationService = (): NotificationService => {
  if (!notificationInstance) {
    notificationInstance = new NotificationService();
  }
  return notificationInstance;
};

export default NotificationService;