/**
 * Advanced template engine for Fluxion notifications
 * Uses Handlebars for HTML email template compilation with comprehensive template support
 */

import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import {
  NotificationType,
  TemplateDataUnion,
  CompiledTemplate,
  TemplateValidationResult
} from '../types/notifications';

// Cache compiled templates
const templateCache = new Map<string, HandlebarsTemplateDelegate>();
const baseTemplateCache = new Map<string, HandlebarsTemplateDelegate>();

// Template configuration
const TEMPLATES_CONFIG = {
  invoice_sent: {
    file: 'invoice_sent.hbs',
    subject: 'Invoice from {{creatorName}} - {{amount}} {{currency}}',
    requiredFields: ['clientName', 'creatorName', 'amount', 'currency', 'dueDate', 'paymentUrl']
  },
  payment_received: {
    file: 'payment_received.hbs', 
    subject: 'Payment Received - {{amount}} {{currency}} from {{clientName}}',
    requiredFields: ['clientName', 'amount', 'currency', 'transactionHash', 'paymentDate']
  },
  payment_failed: {
    file: 'payment_failed.hbs',
    subject: 'Payment Failed - {{clientName}} - {{amount}} {{currency}}',
    requiredFields: ['clientName', 'amount', 'currency', 'errorReason']
  },
  payment_reminder: {
    file: 'payment_reminder.hbs',
    subject: '{{#if (gt daysPastDue 0)}}Payment Overdue{{else}}Payment Reminder{{/if}} - Invoice {{invoiceNumber}}',
    requiredFields: ['clientName', 'creatorName', 'amount', 'currency', 'dueDate', 'paymentUrl']
  },
  payment_overdue: {
    file: 'payment_overdue.hbs',
    subject: 'URGENT: Payment {{daysPastDue}} Days Overdue - {{invoiceNumber}}',
    requiredFields: ['clientName', 'creatorName', 'amount', 'currency', 'daysPastDue', 'escalationLevel']
  },
  invoice_viewed: {
    file: 'invoice_viewed.hbs',
    subject: 'Invoice Viewed - {{clientName}} opened {{invoiceNumber}}',
    requiredFields: ['clientName', 'amount', 'currency', 'viewedAt']
  }
} as const;

/**
 * Initialize Handlebars with custom helpers
 */
function initializeHandlebars() {
  // Register equality helper
  Handlebars.registerHelper('eq', function(a: any, b: any) {
    return a === b;
  });

  // Register greater than helper
  Handlebars.registerHelper('gt', function(a: any, b: any) {
    return a > b;
  });

  // Register less than helper
  Handlebars.registerHelper('lt', function(a: any, b: any) {
    return a < b;
  });

  // Register number formatting helper
  Handlebars.registerHelper('formatNumber', function(num: number) {
    return num.toLocaleString();
  });

  // Register date formatting helper
  Handlebars.registerHelper('formatDate', function(dateStr: string) {
    return new Date(dateStr).toLocaleDateString();
  });

  // Register currency formatting helper
  Handlebars.registerHelper('formatCurrency', function(amount: string, currency: string) {
    return `${parseFloat(amount).toLocaleString()} ${currency}`;
  });

  // Register conditional class helper
  Handlebars.registerHelper('conditionalClass', function(condition: any, trueClass: string, falseClass: string = '') {
    return condition ? trueClass : falseClass;
  });

  // Register string truncation helper
  Handlebars.registerHelper('truncate', function(str: string, length: number) {
    if (!str || str.length <= length) return str;
    return str.substring(0, length) + '...';
  });

  logger.info('Handlebars helpers registered successfully');
}

/**
 * Load and compile a Handlebars template
 */
function loadTemplate(templateName: string, isBaseTemplate: boolean = false): HandlebarsTemplateDelegate {
  const cacheKey = isBaseTemplate ? `base-${templateName}` : templateName;
  const cache = isBaseTemplate ? baseTemplateCache : templateCache;
  
  // Check cache first
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  try {
    const templatePath = path.resolve(__dirname, templateName);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateSource);
    
    // Cache the compiled template
    cache.set(cacheKey, compiledTemplate);
    
    logger.info('Template loaded and compiled', { 
      templateName, 
      isBaseTemplate,
      templatePath,
      sourceLength: templateSource.length
    });
    
    return compiledTemplate;
  } catch (error) {
    logger.error('Failed to load template', { 
      templateName,
      isBaseTemplate,
      error: error instanceof Error ? error.message : error 
    });
    throw new Error(`Template '${templateName}' not found or invalid: ${error}`);
  }
}

/**
 * Validate template data against requirements
 */
export function validateTemplateData(type: NotificationType, data: TemplateDataUnion): TemplateValidationResult {
  const config = TEMPLATES_CONFIG[type];
  if (!config) {
    return {
      valid: false,
      missingVariables: [],
      invalidVariables: [],
      errors: [`Unknown template type: ${type}`]
    };
  }

  const errors: string[] = [];
  const missingVariables: string[] = [];
  const invalidVariables: string[] = [];

  // Check required fields
  for (const field of config.requiredFields) {
    if (!(field in data) || data[field as keyof TemplateDataUnion] === undefined || data[field as keyof TemplateDataUnion] === null) {
      missingVariables.push(field);
    }
  }

  // Type-specific validations
  switch (type) {
    case 'invoice_sent':
      if ('amount' in data && isNaN(parseFloat(data.amount as string))) {
        invalidVariables.push('amount');
      }
      break;
    case 'payment_received':
      if ('transactionHash' in data && (!data.transactionHash || (data.transactionHash as string).length < 10)) {
        invalidVariables.push('transactionHash');
      }
      break;
    case 'payment_overdue':
      if ('escalationLevel' in data && ![1, 2, 3].includes(data.escalationLevel as number)) {
        invalidVariables.push('escalationLevel');
      }
      break;
  }

  const valid = missingVariables.length === 0 && invalidVariables.length === 0 && errors.length === 0;

  return {
    valid,
    missingVariables,
    invalidVariables,
    errors
  };
}

/**
 * Render a complete email template with subject and body
 */
export function renderEmailTemplate(type: NotificationType, data: TemplateDataUnion, recipientEmail?: string): CompiledTemplate {
  logger.info('Rendering email template', { 
    type, 
    dataKeys: Object.keys(data),
    recipientEmail: recipientEmail ? recipientEmail.replace(/(.{3}).*@/, '$1***@') : undefined
  });

  // Initialize Handlebars helpers if not already done
  if (templateCache.size === 0) {
    initializeHandlebars();
  }

  // Validate template data
  const validation = validateTemplateData(type, data);
  if (!validation.valid) {
    const errorMessage = `Template validation failed: ${validation.errors.join(', ')}. Missing: ${validation.missingVariables.join(', ')}. Invalid: ${validation.invalidVariables.join(', ')}`;
    logger.error('Template validation failed', { type, validation });
    throw new Error(errorMessage);
  }

  try {
    const config = TEMPLATES_CONFIG[type];
    
    // Load base template
    const baseTemplate = loadTemplate('base.hbs', true);
    
    // Load content template
    const contentTemplate = loadTemplate(config.file);
    
    // Render the content template first
    const contentHtml = contentTemplate({
      ...data,
      currentYear: new Date().getFullYear()
    });
    
    // Enhanced data for base template
    const enhancedData = {
      ...data,
      content: contentHtml,
      recipientEmail: recipientEmail || 'recipient',
      headerTitle: getHeaderTitle(type),
      subject: renderSubject(type, data),
      currentYear: new Date().getFullYear(),
      unsubscribeUrl: `https://fluxion.pay/unsubscribe?email=${encodeURIComponent(recipientEmail || '')}`,
    };
    
    // Render the complete HTML with base template
    const bodyHtml = baseTemplate(enhancedData);
    
    // Generate plain text version
    const bodyText = generateTextVersion(type, data);
    
    const result: CompiledTemplate = {
      subject: enhancedData.subject,
      bodyHtml,
      bodyText,
      variables: Object.keys(data)
    };
    
    logger.info('Template rendered successfully', { 
      type,
      subject: result.subject,
      htmlLength: result.bodyHtml.length,
      textLength: result.bodyText.length
    });
    
    return result;
  } catch (error) {
    logger.error('Template rendering failed', {
      type,
      error: error instanceof Error ? error.message : error
    });
    
    // Return fallback template
    return generateFallbackTemplate(type, data, recipientEmail);
  }
}

/**
 * Render just the subject line
 */
function renderSubject(type: NotificationType, data: TemplateDataUnion): string {
  const config = TEMPLATES_CONFIG[type];
  const subjectTemplate = Handlebars.compile(config.subject);
  return subjectTemplate(data);
}

/**
 * Get header title for the email type
 */
function getHeaderTitle(type: NotificationType): string {
  const titles = {
    invoice_sent: 'New Invoice',
    payment_received: 'Payment Confirmed',
    payment_failed: 'Payment Issue',
    payment_reminder: 'Payment Reminder',
    payment_overdue: 'Payment Overdue',
    invoice_viewed: 'Invoice Activity'
  };
  return titles[type] || 'Notification';
}

/**
 * Generate a plain text version of the email
 */
function generateTextVersion(type: NotificationType, data: TemplateDataUnion): string {
  // Basic text templates for each type
  switch (type) {
    case 'invoice_sent':
      if ('clientName' in data && 'creatorName' in data && 'amount' in data) {
        return `
Hi ${data.clientName},

You have received an invoice from ${data.creatorName} for ${data.amount} ${data.currency || 'USDC'}.

${data.description ? `Description: ${data.description}\n` : ''}Due Date: ${data.dueDate || 'Not specified'}

To pay this invoice with your crypto wallet, visit:
${data.paymentUrl || 'Payment URL not provided'}

Invoice ID: ${data.invoiceId || 'Not provided'}

Thank you,
Fluxion Team
        `.trim();
      }
      break;
      
    case 'payment_received':
      if ('clientName' in data && 'amount' in data) {
        return `
Congratulations! Your invoice has been paid.

Payment Details:
- Client: ${data.clientName}
- Amount: ${data.amount} ${data.currency || 'USDC'}
- Payment Date: ${data.paymentDate || 'Not specified'}
${data.transactionHash ? `- Transaction: ${data.transactionHash}` : ''}

Thank you for using Fluxion!
Fluxion Team
        `.trim();
      }
      break;
      
    default:
      return `
Fluxion Notification

Type: ${type}
Details: ${JSON.stringify(data, null, 2)}

Thank you,
Fluxion Team
      `.trim();
  }
  
  return `Fluxion notification - please view the HTML version of this email for full details.`;
}

/**
 * Generate a fallback template if main template fails
 */
function generateFallbackTemplate(type: NotificationType, data: TemplateDataUnion, recipientEmail?: string): CompiledTemplate {
  const fallbackTitle = getHeaderTitle(type);
  const subject = `Fluxion ${fallbackTitle}`;
  
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>${subject}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
    .container { background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
    .content { padding: 20px 0; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 8px; margin-top: 20px; }
    .error { color: #dc2626; background-color: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #fecaca; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚡ Fluxion</h1>
      <h2>${fallbackTitle}</h2>
    </div>
    <div class="content">
      <div class="error">
        <p><strong>⚠️ Template Rendering Issue</strong></p>
        <p>We encountered an issue rendering your email template. The notification details are included below:</p>
      </div>
      <p><strong>Notification Type:</strong> ${type}</p>
      <p><strong>Data Summary:</strong></p>
      <pre style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
    </div>
    <div class="footer">
      <p><strong>Fluxion</strong> - The Future of Crypto Payments</p>
      <p>© ${new Date().getFullYear()} Fluxion. All rights reserved.</p>
      ${recipientEmail ? `<p>This email was sent to ${recipientEmail}</p>` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();
  
  const bodyText = `
Fluxion ${fallbackTitle}

We encountered an issue rendering your email template.

Notification Type: ${type}
Data: ${JSON.stringify(data, null, 2)}

Fluxion Team
  `.trim();

  return {
    subject,
    bodyHtml,
    bodyText,
    variables: Object.keys(data)
  };
}

/**
 * Clear template cache (useful for development/testing)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
  baseTemplateCache.clear();
  logger.info('Template cache cleared');
}

/**
 * Get cache statistics
 */
export function getTemplateCacheStats() {
  return {
    templateCacheSize: templateCache.size,
    baseTemplateCacheSize: baseTemplateCache.size,
    templates: Array.from(templateCache.keys()),
    baseTemplates: Array.from(baseTemplateCache.keys()),
    availableTypes: Object.keys(TEMPLATES_CONFIG)
  };
}

/**
 * Preload all templates (useful for Lambda warm-up)
 */
export async function preloadTemplates(): Promise<void> {
  logger.info('Preloading all email templates');
  
  try {
    // Initialize Handlebars helpers
    initializeHandlebars();
    
    // Load base template
    loadTemplate('base.hbs', true);
    
    // Load all content templates
    for (const [type, config] of Object.entries(TEMPLATES_CONFIG)) {
      loadTemplate(config.file);
    }
    
    logger.info('All templates preloaded successfully', {
      templateCount: templateCache.size,
      baseTemplateCount: baseTemplateCache.size
    });
  } catch (error) {
    logger.error('Failed to preload templates', {
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
}