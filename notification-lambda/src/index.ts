import { SQSHandler, SQSEvent, SQSRecord, Context, Callback } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import winston from 'winston';
import { renderTemplate } from './templates';
import { config } from '@/config';

// Configure logger using config
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Initialize SES client using config
const sesClientConfig: any = { 
  region: config.aws.ses.region
};

// Add credentials if available (for local development)
if (config.aws.accessKeyId && config.aws.secretAccessKey) {
  sesClientConfig.credentials = {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey
  };
}

const sesClient = new SESClient(sesClientConfig);

interface NotificationMessage {
  type: 'INVOICE_CREATED' | 'PAYMENT_RECEIVED' | 'INVOICE_REMINDER' | 'PAYMENT_FAILED';
  data: any;
  recipient: string;
  priority: 'high' | 'normal' | 'low';
  timestamp: string;
  requestId: string;
}

interface InvoiceCreatedData {
  invoice_id: string;
  client_email: string;
  client_name: string;
  creator_name: string;
  amount: number;
  payment_url: string;
  due_date: string;
  description: string;
}

interface PaymentReceivedData {
  invoice_id: string;
  payment_id: string;
  creator_email: string;
  client_name: string;
  amount: number;
  tx_hash: string;
  payment_date: string;
}

interface InvoiceReminderData {
  invoice_id: string;
  client_email: string;
  client_name: string;
  creator_name: string;
  amount: number;
  payment_url: string;
  due_date: string;
  days_overdue: number;
}

interface PaymentFailedData {
  invoice_id: string;
  payment_id: string;
  creator_email: string;
  client_name: string;
  amount: number;
  tx_hash: string;
  error_reason: string;
}

export const handler: SQSHandler = async (event: SQSEvent, context: Context, _callback: Callback) => {
  logger.info('Notification Lambda invoked', { 
    recordCount: event.Records.length,
    requestId: context.awsRequestId,
    environment: config.environment,
    timestamp: new Date().toISOString()
  });

  const results = [];

  for (const record of event.Records) {
    try {
      await processNotification(record);
      results.push({ status: 'success', messageId: record.messageId });
    } catch (error) {
      logger.error('Failed to process notification', {
        error: error instanceof Error ? error.message : error,
        messageId: record.messageId,
        body: record.body
      });
      
      results.push({ 
        status: 'error', 
        messageId: record.messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  logger.info('Notification batch processing completed', {
    totalRecords: event.Records.length,
    successCount,
    errorCount,
    requestId: context.awsRequestId,
    timestamp: new Date().toISOString()
  });

  // If there are errors, SQS will retry failed messages based on DLQ configuration
  if (errorCount > 0) {
    logger.warn('Some notifications failed to process', { errorCount });
  }
};

async function processNotification(record: SQSRecord): Promise<void> {
  const messageId = record.messageId;
  
  logger.info('Processing notification', { messageId });

  let notification: NotificationMessage;
  
  try {
    notification = JSON.parse(record.body);
  } catch (error) {
    logger.error('Failed to parse notification message', { 
      error: error instanceof Error ? error.message : error,
      messageId,
      body: record.body 
    });
    throw new Error(`Invalid message format: ${error}`);
  }

  // Validate required fields
  if (!notification.type || !notification.data || !notification.recipient) {
    throw new Error('Missing required notification fields');
  }

  logger.info('Processing notification type', { 
    type: notification.type,
    recipient: notification.recipient,
    priority: notification.priority,
    messageId
  });

  switch (notification.type) {
    case 'INVOICE_CREATED':
      await sendInvoiceCreatedEmail(notification.data as InvoiceCreatedData, messageId);
      break;
      
    case 'PAYMENT_RECEIVED':
      await sendPaymentReceivedEmail(notification.data as PaymentReceivedData, messageId);
      break;
      
    case 'INVOICE_REMINDER':
      await sendInvoiceReminderEmail(notification.data as InvoiceReminderData, messageId);
      break;
      
    case 'PAYMENT_FAILED':
      await sendPaymentFailedEmail(notification.data as PaymentFailedData, messageId);
      break;
      
    default:
      logger.warn('Unknown notification type', { 
        type: notification.type,
        messageId 
      });
      throw new Error(`Unknown notification type: ${notification.type}`);
  }

  logger.info('Notification processed successfully', { 
    type: notification.type,
    messageId 
  });
}

async function sendInvoiceCreatedEmail(data: InvoiceCreatedData, messageId: string): Promise<void> {
  logger.info('Sending invoice created email', { 
    invoice_id: data.invoice_id,
    client_email: data.client_email,
    messageId
  });

  const emailHtml = renderTemplate('invoice-created', {
    client_name: data.client_name,
    creator_name: data.creator_name,
    amount: data.amount.toLocaleString(),
    description: data.description,
    payment_url: data.payment_url,
    due_date: new Date(data.due_date).toLocaleDateString(),
    invoice_id: data.invoice_id,
    current_year: new Date().getFullYear()
  });

  const emailText = `
Hi ${data.client_name},

You have received an invoice from ${data.creator_name} for ${data.amount} USDC.

Description: ${data.description}
Due Date: ${new Date(data.due_date).toLocaleDateString()}

To pay this invoice with your crypto wallet, visit:
${data.payment_url}

Invoice ID: ${data.invoice_id}

Thank you,
Fluxion Team
  `.trim();

  await sendEmail({
    to: data.client_email,
    subject: `Invoice from ${data.creator_name} - ${data.amount} USDC`,
    htmlBody: emailHtml,
    textBody: emailText,
    messageId
  });
}

async function sendPaymentReceivedEmail(data: PaymentReceivedData, messageId: string): Promise<void> {
  logger.info('Sending payment received email', { 
    invoice_id: data.invoice_id,
    payment_id: data.payment_id,
    creator_email: data.creator_email,
    messageId
  });

  const emailHtml = renderTemplate('payment-received', {
    client_name: data.client_name,
    amount: data.amount.toLocaleString(),
    tx_hash: data.tx_hash,
    tx_hash_short: `${data.tx_hash.substring(0, 10)}...${data.tx_hash.substring(data.tx_hash.length - 8)}`,
    payment_date: new Date(data.payment_date).toLocaleDateString(),
    invoice_id: data.invoice_id,
    polygon_explorer_url: `https://polygonscan.com/tx/${data.tx_hash}`,
    current_year: new Date().getFullYear()
  });

  const emailText = `
Congratulations! Your invoice has been paid.

Payment Details:
- Client: ${data.client_name}
- Amount: ${data.amount} USDC
- Payment Date: ${new Date(data.payment_date).toLocaleDateString()}
- Transaction: ${data.tx_hash}

You can view the transaction on Polygon Explorer:
https://polygonscan.com/tx/${data.tx_hash}

Invoice ID: ${data.invoice_id}

Thank you for using Fluxion!
Fluxion Team
  `.trim();

  await sendEmail({
    to: data.creator_email,
    subject: `Payment Received - ${data.amount} USDC from ${data.client_name}`,
    htmlBody: emailHtml,
    textBody: emailText,
    messageId
  });
}

async function sendInvoiceReminderEmail(data: InvoiceReminderData, messageId: string): Promise<void> {
  logger.info('Sending invoice reminder email', { 
    invoice_id: data.invoice_id,
    client_email: data.client_email,
    days_overdue: data.days_overdue,
    messageId
  });

  const emailHtml = renderTemplate('invoice-reminder', {
    client_name: data.client_name,
    creator_name: data.creator_name,
    amount: data.amount.toLocaleString(),
    payment_url: data.payment_url,
    due_date: new Date(data.due_date).toLocaleDateString(),
    days_overdue: data.days_overdue,
    invoice_id: data.invoice_id,
    urgency_class: data.days_overdue > 7 ? 'urgent' : 'normal',
    current_year: new Date().getFullYear()
  });

  const emailText = `
Hi ${data.client_name},

This is a friendly reminder that your invoice from ${data.creator_name} is now ${data.days_overdue} days overdue.

Invoice Details:
- Amount: ${data.amount} USDC
- Original Due Date: ${new Date(data.due_date).toLocaleDateString()}
- Days Overdue: ${data.days_overdue}

To pay this invoice, visit:
${data.payment_url}

Invoice ID: ${data.invoice_id}

Thank you,
Fluxion Team
  `.trim();

  await sendEmail({
    to: data.client_email,
    subject: `Payment Reminder - Invoice ${data.days_overdue} days overdue`,
    htmlBody: emailHtml,
    textBody: emailText,
    messageId
  });
}

async function sendPaymentFailedEmail(data: PaymentFailedData, messageId: string): Promise<void> {
  logger.info('Sending payment failed email', { 
    invoice_id: data.invoice_id,
    payment_id: data.payment_id,
    creator_email: data.creator_email,
    messageId
  });

  const emailHtml = renderTemplate('payment-failed', {
    client_name: data.client_name,
    amount: data.amount.toLocaleString(),
    tx_hash: data.tx_hash,
    tx_hash_short: `${data.tx_hash.substring(0, 10)}...${data.tx_hash.substring(data.tx_hash.length - 8)}`,
    error_reason: data.error_reason,
    invoice_id: data.invoice_id,
    support_email: 'support@fluxion.pay',
    current_year: new Date().getFullYear()
  });

  const emailText = `
A payment attempt for your invoice has failed.

Payment Details:
- Client: ${data.client_name}
- Amount: ${data.amount} USDC
- Transaction: ${data.tx_hash}
- Error: ${data.error_reason}

The client may need to retry the payment or contact you directly.

If you need assistance, please contact support@fluxion.pay

Invoice ID: ${data.invoice_id}

Fluxion Team
  `.trim();

  await sendEmail({
    to: data.creator_email,
    subject: `Payment Failed - ${data.client_name} - ${data.amount} USDC`,
    htmlBody: emailHtml,
    textBody: emailText,
    messageId
  });
}

async function sendEmail(params: {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  messageId: string;
}): Promise<void> {
  const { to, subject, htmlBody, textBody, messageId } = params;
  
  logger.info('Sending email via SES', { 
    to: to.replace(/(.{3}).*@/, '$1***@'), // Mask email for privacy
    subject,
    messageId
  });

  const fromEmail = config.aws.ses.fromEmail;
  const fromName = config.aws.ses.fromName;

  try {
    const command = new SendEmailCommand({
      Source: `${fromName} <${fromEmail}>`,
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8'
          }
        }
      },
      // Add email tags for tracking
      Tags: [
        {
          Name: 'Service',
          Value: 'Fluxion'
        },
        {
          Name: 'MessageId',
          Value: messageId
        }
      ]
    });

    const result = await sesClient.send(command);
    
    logger.info('Email sent successfully', { 
      to: to.replace(/(.{3}).*@/, '$1***@'),
      messageId: result.MessageId,
      sqsMessageId: messageId
    });
  } catch (error) {
    logger.error('Failed to send email', { 
      error: error instanceof Error ? error.message : error,
      to: to.replace(/(.{3}).*@/, '$1***@'),
      messageId
    });
    
    throw new Error(`Failed to send email: ${error}`);
  }
}