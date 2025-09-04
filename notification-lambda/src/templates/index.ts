import Handlebars from 'handlebars';

// Email template registry
const templates: { [key: string]: string } = {};

// Register Handlebars helpers
Handlebars.registerHelper('formatCurrency', (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(value);
});

Handlebars.registerHelper('formatDate', (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
Handlebars.registerHelper('gte', (a: number, b: number) => a >= b);

// Base template with consistent styling
const baseTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f8f9fa;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px;
        }
        
        .greeting {
            font-size: 18px;
            margin-bottom: 24px;
            color: #2d3748;
        }
        
        .message {
            font-size: 16px;
            line-height: 1.7;
            margin-bottom: 32px;
            color: #4a5568;
        }
        
        .info-box {
            background-color: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
        }
        
        .info-box h3 {
            color: #2d3748;
            font-size: 18px;
            margin-bottom: 16px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .info-row:last-child {
            border-bottom: none;
        }
        
        .info-label {
            font-weight: 600;
            color: #4a5568;
        }
        
        .info-value {
            color: #2d3748;
            font-weight: 500;
        }
        
        .amount {
            font-size: 24px;
            font-weight: 700;
            color: #667eea;
        }
        
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 24px 0;
            transition: transform 0.2s ease;
        }
        
        .cta-button:hover {
            transform: translateY(-1px);
        }
        
        .warning {
            background-color: #fff5f5;
            border-left: 4px solid #f56565;
            padding: 16px 20px;
            margin: 24px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .warning .warning-title {
            color: #c53030;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .success {
            background-color: #f0fff4;
            border-left: 4px solid #48bb78;
            padding: 16px 20px;
            margin: 24px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .success .success-title {
            color: #2f855a;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .tx-hash {
            font-family: monospace;
            background-color: #edf2f7;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            word-break: break-all;
        }
        
        .footer {
            background-color: #2d3748;
            color: #a0aec0;
            padding: 32px 40px;
            text-align: center;
            font-size: 14px;
        }
        
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        .footer-links {
            margin: 20px 0;
        }
        
        .footer-links a {
            margin: 0 16px;
        }
        
        @media (max-width: 600px) {
            .container {
                margin: 0;
                box-shadow: none;
            }
            
            .header, .content, .footer {
                padding: 24px 20px;
            }
            
            .info-row {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .info-value {
                margin-top: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        {{{content}}}
        
        <div class="footer">
            <div class="footer-links">
                <a href="https://fluxion.pay">Fluxion.pay</a>
                <a href="https://docs.fluxion.pay">Documentation</a>
                <a href="https://fluxion.pay/support">Support</a>
            </div>
            <p>&copy; {{current_year}} Fluxion. All rights reserved.</p>
            <p>Crypto-native invoicing for the decentralized world.</p>
        </div>
    </div>
</body>
</html>`;

// Invoice Created Template
templates['invoice-created'] = `
<div class="header">
    <h1>📧 New Invoice</h1>
    <p>You have received an invoice payment request</p>
</div>

<div class="content">
    <div class="greeting">Hi {{client_name}},</div>
    
    <div class="message">
        You have received an invoice from <strong>{{creator_name}}</strong>. 
        Payment can be made instantly using your crypto wallet with USDC on the Polygon network.
    </div>
    
    <div class="info-box">
        <h3>Invoice Details</h3>
        <div class="info-row">
            <span class="info-label">Amount:</span>
            <span class="info-value amount">{{formatCurrency amount}} USDC</span>
        </div>
        <div class="info-row">
            <span class="info-label">Description:</span>
            <span class="info-value">{{description}}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Due Date:</span>
            <span class="info-value">{{formatDate due_date}}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Invoice ID:</span>
            <span class="info-value">{{invoice_id}}</span>
        </div>
    </div>
    
    <div style="text-align: center;">
        <a href="{{payment_url}}" class="cta-button">
            💳 Pay with Crypto Wallet
        </a>
    </div>
    
    <div class="message">
        <strong>How to pay:</strong><br>
        1. Click the payment button above<br>
        2. Connect your MetaMask or compatible wallet<br>
        3. Confirm the USDC payment on Polygon network<br>
        4. You'll receive a confirmation once payment is processed
    </div>
</div>`;

// Payment Received Template
templates['payment-received'] = `
<div class="header">
    <h1>🎉 Payment Received!</h1>
    <p>Your invoice has been paid successfully</p>
</div>

<div class="content">
    <div class="greeting">Congratulations!</div>
    
    <div class="success">
        <div class="success-title">Payment Confirmed</div>
        Your invoice has been paid by {{client_name}}. The transaction has been confirmed on the blockchain.
    </div>
    
    <div class="info-box">
        <h3>Payment Details</h3>
        <div class="info-row">
            <span class="info-label">Client:</span>
            <span class="info-value">{{client_name}}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Amount:</span>
            <span class="info-value amount">{{formatCurrency amount}} USDC</span>
        </div>
        <div class="info-row">
            <span class="info-label">Payment Date:</span>
            <span class="info-value">{{formatDate payment_date}}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Invoice ID:</span>
            <span class="info-value">{{invoice_id}}</span>
        </div>
    </div>
    
    <div class="info-box">
        <h3>Blockchain Transaction</h3>
        <div class="info-row">
            <span class="info-label">Transaction Hash:</span>
            <span class="info-value tx-hash">{{tx_hash_short}}</span>
        </div>
        <div style="text-align: center; margin-top: 16px;">
            <a href="{{polygon_explorer_url}}" class="cta-button">
                🔍 View on Polygon Explorer
            </a>
        </div>
    </div>
    
    <div class="message">
        The payment has been securely processed on the Polygon blockchain. 
        You can view the full transaction details using the link above.
    </div>
</div>`;

// Invoice Reminder Template
templates['invoice-reminder'] = `
<div class="header">
    <h1>⏰ Payment Reminder</h1>
    <p>Your invoice payment is {{days_overdue}} days overdue</p>
</div>

<div class="content">
    <div class="greeting">Hi {{client_name}},</div>
    
    <div class="{{#gt days_overdue 7}}warning{{else}}info-box{{/gt}}">
        {{#gt days_overdue 7}}
        <div class="warning-title">Urgent: Payment Overdue</div>
        {{else}}
        <h3>Payment Reminder</h3>
        {{/gt}}
        This is a friendly reminder that your invoice from <strong>{{creator_name}}</strong> 
        is now <strong>{{days_overdue}} days overdue</strong>.
    </div>
    
    <div class="info-box">
        <h3>Invoice Details</h3>
        <div class="info-row">
            <span class="info-label">Amount:</span>
            <span class="info-value amount">{{formatCurrency amount}} USDC</span>
        </div>
        <div class="info-row">
            <span class="info-label">Original Due Date:</span>
            <span class="info-value">{{formatDate due_date}}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Days Overdue:</span>
            <span class="info-value">{{days_overdue}} days</span>
        </div>
        <div class="info-row">
            <span class="info-label">Invoice ID:</span>
            <span class="info-value">{{invoice_id}}</span>
        </div>
    </div>
    
    <div style="text-align: center;">
        <a href="{{payment_url}}" class="cta-button">
            💳 Pay Now with Crypto
        </a>
    </div>
    
    <div class="message">
        Please process your payment as soon as possible to avoid any service interruptions. 
        If you have any questions or concerns, please contact {{creator_name}} directly.
    </div>
</div>`;

// Payment Failed Template
templates['payment-failed'] = `
<div class="header">
    <h1>❌ Payment Failed</h1>
    <p>A payment attempt for your invoice was unsuccessful</p>
</div>

<div class="content">
    <div class="greeting">Payment Alert</div>
    
    <div class="warning">
        <div class="warning-title">Payment Verification Failed</div>
        A payment attempt was made for your invoice, but it could not be verified successfully.
    </div>
    
    <div class="info-box">
        <h3>Payment Attempt Details</h3>
        <div class="info-row">
            <span class="info-label">Client:</span>
            <span class="info-value">{{client_name}}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Expected Amount:</span>
            <span class="info-value amount">{{formatCurrency amount}} USDC</span>
        </div>
        <div class="info-row">
            <span class="info-label">Transaction Hash:</span>
            <span class="info-value tx-hash">{{tx_hash_short}}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Error Reason:</span>
            <span class="info-value">{{error_reason}}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Invoice ID:</span>
            <span class="info-value">{{invoice_id}}</span>
        </div>
    </div>
    
    <div class="message">
        <strong>What happens next?</strong><br>
        • The client may need to retry the payment with the correct amount<br>
        • They should ensure they're sending USDC on the Polygon network<br>
        • The payment should be sent to your wallet address exactly<br>
        • If issues persist, they can contact you directly for assistance
    </div>
    
    <div class="message">
        If you need technical support, please contact us at 
        <a href="mailto:{{support_email}}">{{support_email}}</a>.
    </div>
</div>`;

export function renderTemplate(templateName: string, data: any): string {
  const templateContent = templates[templateName];
  
  if (!templateContent) {
    throw new Error(`Template "${templateName}" not found`);
  }
  
  // Compile the specific template
  const contentTemplate = Handlebars.compile(templateContent);
  const renderedContent = contentTemplate(data);
  
  // Compile the base template with the rendered content
  const fullTemplate = Handlebars.compile(baseTemplate);
  
  return fullTemplate({
    ...data,
    content: renderedContent
  });
}