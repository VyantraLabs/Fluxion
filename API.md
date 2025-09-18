# Fluxion API Documentation

**Version**: 3.0.0 - Complete API Reference  
**Last Updated**: September 18, 2025  
**Status**: Production-Ready API Documentation

Complete API documentation for the Fluxion Web3 payment platform, covering all endpoints, authentication, request/response formats, and integration examples.

## 🌐 Base URLs

### **Environment URLs**
- **Development**: `http://localhost:3000`
- **Staging**: `https://api-staging.fluxion.pay`
- **Production**: `https://api.fluxion.pay`

### **Interactive Documentation**
- **Swagger UI**: `{BASE_URL}/api-docs`
- **OpenAPI Spec**: `{BASE_URL}/api-docs.json`

### **Microservices URLs (Optional)**
- **Main Service**: `http://localhost:3000` (User-facing APIs)
- **Admin Service**: `http://localhost:3001` (Admin-only APIs)

## 🔐 Authentication

### **Web3 Authentication Flow**

Fluxion uses wallet signature-based authentication with JWT tokens:

#### 1. Request Authentication Challenge
```http
POST /users/auth/message
Content-Type: application/json

{
  "wallet_address": "0x742d35Cc6634C0532925a3b8D4c4e32C3FD929fa"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Sign this message to authenticate with Fluxion.\n\nWallet: 0x742d35Cc6634C0532925a3b8D4c4e32C3FD929fa\nNonce: abc123\nTimestamp: 2025-09-18T10:00:00.000Z",
    "nonce": "abc123"
  }
}
```

#### 2. Sign Message with Wallet
```javascript
// Using ethers.js
const signer = provider.getSigner();
const signature = await signer.signMessage(message);
```

#### 3. Verify Signature and Get JWT
```http
POST /users/auth/verify
Content-Type: application/json

{
  "wallet_address": "0x742d35Cc6634C0532925a3b8D4c4e32C3FD929fa",
  "signature": "0x1234567890abcdef...",
  "message": "Sign this message to authenticate..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_123abc",
      "wallet_address": "0x742d35Cc6634C0532925a3b8D4c4e32C3FD929fa",
      "organization_id": "org_456def",
      "created_at": "2025-09-18T10:00:00.000Z"
    },
    "organization": {
      "id": "org_456def",
      "name": "My Organization",
      "settings": {}
    }
  }
}
```

#### 4. Use JWT Token for Authenticated Requests
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **JWT Token Refresh**
```http
POST /users/auth/refresh
Authorization: Bearer {CURRENT_TOKEN}
```

## 📊 Standard Response Format

All API responses follow a consistent format:

### **Success Response**
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "requestId": "req_123abc",
    "timestamp": "2025-09-18T10:00:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### **Error Response**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "meta": {
    "requestId": "req_123abc",
    "timestamp": "2025-09-18T10:00:00.000Z"
  }
}
```

### **Common Error Codes**
- `AUTHENTICATION_REQUIRED` - Missing or invalid JWT token
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `INVALID_INPUT` - Request validation failed
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `ORGANIZATION_REQUIRED` - Organization context required
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## 👥 User Management APIs

### **Get Current User Profile**
```http
GET /users/profile
Authorization: Bearer {TOKEN}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123abc",
    "wallet_address": "0x742d35Cc6634C0532925a3b8D4c4e32C3FD929fa",
    "email": "user@example.com",
    "display_name": "John Doe",
    "organization_id": "org_456def",
    "roles": ["user"],
    "settings": {
      "email_notifications": true,
      "two_factor_enabled": false
    },
    "created_at": "2025-09-18T10:00:00.000Z",
    "updated_at": "2025-09-18T10:00:00.000Z"
  }
}
```

### **Update User Profile**
```http
PUT /users/profile
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "display_name": "Jane Doe",
  "email": "jane@example.com",
  "settings": {
    "email_notifications": false
  }
}
```

### **Get User Organizations**
```http
GET /users/organizations
Authorization: Bearer {TOKEN}
```

## 🏢 Organization Management APIs

### **List User Organizations**
```http
GET /organizations
Authorization: Bearer {TOKEN}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "org_456def",
      "name": "My Organization",
      "description": "Web3 consulting firm",
      "settings": {
        "default_currency": "USDC",
        "invoice_prefix": "INV-",
        "payment_terms": 30
      },
      "role": "admin",
      "created_at": "2025-09-18T10:00:00.000Z"
    }
  ]
}
```

### **Create Organization**
```http
POST /organizations
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "name": "New Organization",
  "description": "Organization description",
  "settings": {
    "default_currency": "USDC",
    "invoice_prefix": "ORG-"
  }
}
```

### **Get Organization Details**
```http
GET /organizations/{organizationId}
Authorization: Bearer {TOKEN}
```

### **Get Organization Activity Logs**
```http
GET /organizations/{organizationId}/activity
Authorization: Bearer {TOKEN}
Query Parameters:
  - page: number (default: 1)
  - limit: number (default: 20)
  - action: string (optional filter)
  - user_id: string (optional filter)
```

### **Get Organization Team Members**
```http
GET /organizations/{organizationId}/users
Authorization: Bearer {TOKEN}
```

## 📄 Invoice Management APIs

### **List Invoices**
```http
GET /invoices
Authorization: Bearer {TOKEN}
Query Parameters:
  - page: number (default: 1)
  - limit: number (default: 20)
  - status: string (draft,created,sent,paid,overdue,cancelled)
  - client_email: string
  - search: string
  - sort: string (created_at,amount,due_date)
  - order: string (asc,desc)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "inv_789ghi",
      "title": "Web Development Services",
      "description": "Frontend development for Q3",
      "amount": 5000.00,
      "currency": "USDC",
      "status": "sent",
      "client_email": "client@example.com",
      "client_name": "Client Company",
      "due_date": "2025-10-18T00:00:00.000Z",
      "network_id": "polygon",
      "token_address": "0xa0b86a33e6f7da2ca7d8a09d17bb6b4b7c8d2e9f",
      "recipient_address": "0x742d35Cc6634C0532925a3b8D4c4e32C3FD929fa",
      "payment_status": "pending",
      "access_token": "token_abc123",
      "created_at": "2025-09-18T10:00:00.000Z",
      "updated_at": "2025-09-18T10:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### **Create Invoice**
```http
POST /invoices
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "title": "Consulting Services",
  "description": "Blockchain consulting for Q4",
  "amount": 7500.00,
  "currency": "USDC",
  "client_email": "client@example.com",
  "client_name": "Client Company",
  "client_address": "123 Business St",
  "due_date": "2025-11-18T00:00:00.000Z",
  "network_id": "polygon",
  "token_address": "0xa0b86a33e6f7da2ca7d8a09d17bb6b4b7c8d2e9f",
  "recipient_address": "0x742d35Cc6634C0532925a3b8D4c4e32C3FD929fa",
  "status": "draft",
  "metadata": {
    "project_id": "proj_123",
    "purchase_order": "PO-2025-001"
  }
}
```

### **Get Invoice Details**
```http
GET /invoices/{invoiceId}
Authorization: Bearer {TOKEN}
```

### **Update Invoice**
```http
PUT /invoices/{invoiceId}
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "title": "Updated Invoice Title",
  "amount": 8000.00,
  "status": "created"
}
```

### **Delete Invoice**
```http
DELETE /invoices/{invoiceId}
Authorization: Bearer {TOKEN}
```

### **Send Invoice to Client**
```http
POST /invoices/{invoiceId}/send
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "send_email": true,
  "email_subject": "Invoice for Consulting Services",
  "email_message": "Please find attached your invoice for consulting services."
}
```

### **Create Invoice from Template**
```http
POST /invoices/from-template/{templateId}
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "client_email": "client@example.com",
  "amount": 5000.00,
  "due_date": "2025-11-18"
}
```

## 💳 Payment Processing APIs

### **Submit Payment**
```http
POST /invoices/{invoiceId}/pay
Content-Type: application/json
# Note: No authentication required for client payments

{
  "transaction_hash": "0xabcdef1234567890...",
  "network_id": "polygon",
  "payer_address": "0x123456789abcdef...",
  "amount_paid": 5000.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_id": "pay_123abc",
    "status": "verifying",
    "verification_job_id": "job_456def",
    "estimated_confirmation_time": "5-10 minutes"
  }
}
```

### **Get Payment Status**
```http
GET /payments/{paymentId}/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pay_123abc",
    "status": "confirmed",
    "transaction_hash": "0xabcdef1234567890...",
    "amount": 5000.00,
    "network_id": "polygon",
    "confirmations": 12,
    "verified_at": "2025-09-18T10:05:00.000Z",
    "invoice": {
      "id": "inv_789ghi",
      "status": "paid"
    }
  }
}
```

### **List Payments**
```http
GET /payments
Authorization: Bearer {TOKEN}
Query Parameters:
  - page: number
  - limit: number
  - status: string (pending,confirmed,failed)
  - network_id: string
```

### **Verify Payment Manually**
```http
POST /payments/verify
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "transaction_hash": "0xabcdef1234567890...",
  "network_id": "polygon"
}
```

## 🎨 Template Management APIs

### **List Templates**
```http
GET /templates
Authorization: Bearer {TOKEN}
Query Parameters:
  - category: string (invoices,contracts,estimates,receipts)
  - scope: string (organization,system)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tpl_123abc",
      "name": "Professional Business Invoice",
      "category": "invoices",
      "description": "Clean professional invoice template",
      "preview_url": "https://templates.fluxion.pay/previews/professional-business.png",
      "template_url": "/templates/system/invoices/professional-business/template.html",
      "scope": "system",
      "is_active": true,
      "created_at": "2025-09-18T10:00:00.000Z"
    }
  ]
}
```

### **Get Template Details**
```http
GET /templates/{templateId}
Authorization: Bearer {TOKEN}
```

### **Create Custom Template**
```http
POST /templates
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "name": "Custom Invoice Template",
  "category": "invoices",
  "description": "Organization-specific invoice template",
  "template_content": "<html>...</html>",
  "variables": [
    {
      "name": "company_logo",
      "type": "image",
      "required": false
    },
    {
      "name": "invoice_number",
      "type": "string",
      "required": true
    }
  ]
}
```

### **List Template Categories**
```http
GET /templates/categories
Authorization: Bearer {TOKEN}
```

## 📋 Public Invoice Access APIs

### **Get Public Invoice**
```http
GET /public/invoice/{accessToken}
# Note: No authentication required - uses secure access token
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "inv_789ghi",
    "title": "Web Development Services",
    "description": "Frontend development for Q3",
    "amount": 5000.00,
    "currency": "USDC",
    "status": "sent",
    "client_email": "client@example.com",
    "due_date": "2025-10-18T00:00:00.000Z",
    "network_id": "polygon",
    "token_address": "0xa0b86a33e6f7da2ca7d8a09d17bb6b4b7c8d2e9f",
    "recipient_address": "0x742d35Cc6634C0532925a3b8D4c4e32C3FD929fa",
    "payment_qr_code": "data:image/png;base64,iVBOR...",
    "payment_url": "ethereum:0x742d35Cc6634C0532925a3b8D4c4e32C3FD929fa@137?amount=5000000000",
    "organization": {
      "name": "Service Provider",
      "logo_url": "https://logos.fluxion.pay/org_456def.png"
    },
    "access_info": {
      "views_remaining": 10,
      "expires_at": "2025-10-18T00:00:00.000Z"
    }
  }
}
```

## ⚙️ Configuration APIs

### **Get Application Configuration**
```http
GET /config
# Note: No authentication required - returns public configuration
```

**Response:**
```json
{
  "success": true,
  "data": {
    "networks": [
      {
        "id": "ethereum",
        "name": "Ethereum",
        "chain_id": 1,
        "symbol": "ETH",
        "rpc_url": "https://mainnet.infura.io/v3/...",
        "explorer_url": "https://etherscan.io",
        "is_testnet": false
      },
      {
        "id": "polygon",
        "name": "Polygon",
        "chain_id": 137,
        "symbol": "MATIC",
        "rpc_url": "https://polygon-rpc.com",
        "explorer_url": "https://polygonscan.com",
        "is_testnet": false
      }
    ],
    "tokens": [
      {
        "id": "usdc-polygon",
        "name": "USD Coin",
        "symbol": "USDC",
        "address": "0xa0b86a33e6f7da2ca7d8a09d17bb6b4b7c8d2e9f",
        "decimals": 6,
        "network_id": "polygon",
        "is_stablecoin": true
      }
    ],
    "supported_currencies": ["USDC", "USDT", "DAI", "ETH"],
    "payment_confirmation_blocks": {
      "ethereum": 12,
      "polygon": 20,
      "arbitrum": 1,
      "base": 1
    }
  }
}
```

### **Get Blockchain Networks**
```http
GET /networks
```

### **Get Available Tokens**
```http
GET /tokens
Query Parameters:
  - network_id: string (filter by network)
  - is_stablecoin: boolean
```

## 📊 Analytics & Dashboard APIs

### **Get Dashboard Statistics**
```http
GET /dashboard/stats
Authorization: Bearer {TOKEN}
Query Parameters:
  - period: string (7d,30d,90d,1y)
  - organization_id: string (optional for multi-org users)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_invoices": 156,
      "total_revenue": 245000.00,
      "pending_payments": 25000.00,
      "overdue_amount": 5000.00
    },
    "period_stats": {
      "period": "30d",
      "invoices_created": 12,
      "revenue_generated": 35000.00,
      "payments_received": 8,
      "average_payment_time": "3.2 days"
    },
    "payment_breakdown": {
      "USDC": 180000.00,
      "USDT": 45000.00,
      "DAI": 20000.00
    },
    "network_distribution": {
      "polygon": 150000.00,
      "ethereum": 75000.00,
      "arbitrum": 20000.00
    }
  }
}
```

### **Get Recent Activity**
```http
GET /dashboard/activity
Authorization: Bearer {TOKEN}
Query Parameters:
  - limit: number (default: 10)
```

## 🔔 Notification APIs

### **Get Notification Settings**
```http
GET /notifications/settings
Authorization: Bearer {TOKEN}
```

### **Update Notification Settings**
```http
PUT /notifications/settings
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "email_notifications": {
    "invoice_sent": true,
    "payment_received": true,
    "payment_overdue": true,
    "weekly_summary": false
  },
  "webhook_url": "https://yourapp.com/webhooks/fluxion",
  "webhook_events": ["invoice_paid", "payment_failed"]
}
```

### **List Notification History**
```http
GET /notifications/history
Authorization: Bearer {TOKEN}
Query Parameters:
  - page: number
  - limit: number
  - type: string (email,webhook)
  - status: string (sent,failed,pending)
```

## 🔧 Admin APIs

### **System Statistics** (Admin Only)
```http
GET /admin/system/stats
Authorization: Bearer {ADMIN_TOKEN}
```

### **User Management** (Admin Only)
```http
GET /admin/users
PUT /admin/users/{userId}
DELETE /admin/users/{userId}
Authorization: Bearer {ADMIN_TOKEN}
```

### **Organization Management** (Admin Only)
```http
GET /admin/organizations
PUT /admin/organizations/{orgId}
Authorization: Bearer {ADMIN_TOKEN}
```

### **Global Template Management** (Admin Only)
```http
GET /admin/templates/global
POST /admin/templates/global
Authorization: Bearer {ADMIN_TOKEN}
```

## 🚨 Health Check APIs

### **Basic Health Check**
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-09-18T10:00:00.000Z",
  "environment": "production",
  "version": "3.0.0"
}
```

### **Detailed Health Checks**
```http
GET /health/database
GET /health/cache
GET /health/queues
GET /health/blockchain
```

## 📝 Webhook Integration

### **Webhook Events**

Fluxion can send webhooks for various events:

- `invoice.created` - New invoice created
- `invoice.sent` - Invoice sent to client
- `invoice.paid` - Invoice payment confirmed
- `invoice.overdue` - Invoice payment overdue
- `payment.received` - Payment verification completed
- `payment.failed` - Payment verification failed
- `user.created` - New user registered
- `organization.created` - New organization created

### **Webhook Payload Format**
```json
{
  "event": "invoice.paid",
  "timestamp": "2025-09-18T10:00:00.000Z",
  "data": {
    "invoice": {
      "id": "inv_789ghi",
      "amount": 5000.00,
      "status": "paid"
    },
    "payment": {
      "id": "pay_123abc",
      "transaction_hash": "0xabcdef...",
      "network_id": "polygon"
    }
  },
  "organization_id": "org_456def"
}
```

### **Webhook Security**

Webhooks include a signature header for verification:

```http
X-Fluxion-Signature: sha256=abcdef1234567890...
```

Verify using HMAC SHA256 with your webhook secret:

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

## 🔄 Rate Limiting

### **Rate Limits by Endpoint Type**

- **Authentication**: 10 requests per minute per IP
- **Public APIs**: 100 requests per minute per IP
- **Authenticated APIs**: 1000 requests per minute per user
- **Admin APIs**: 500 requests per minute per admin user
- **Payment Submission**: 5 requests per minute per invoice

### **Rate Limit Headers**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1632834000
```

### **Rate Limit Exceeded Response**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "limit": 1000,
      "reset_at": "2025-09-18T11:00:00.000Z"
    }
  }
}
```

## 📱 SDK Integration Examples

### **JavaScript/TypeScript SDK**
```typescript
import { FluxionAPI } from '@fluxion/sdk';

const fluxion = new FluxionAPI({
  baseUrl: 'https://api.fluxion.pay',
  apiKey: 'your-api-key' // Optional for authenticated requests
});

// Authenticate with wallet
const auth = await fluxion.auth.authenticate({
  walletAddress: '0x123...',
  signature: '0xabc...',
  message: 'Sign this message...'
});

// Create invoice
const invoice = await fluxion.invoices.create({
  title: 'Consulting Services',
  amount: 5000,
  clientEmail: 'client@example.com'
});

// Listen for payment
invoice.onPayment((payment) => {
  console.log('Payment received:', payment);
});
```

### **React Hooks**
```typescript
import { useFluxion, useInvoices } from '@fluxion/react';

function InvoiceList() {
  const { user } = useFluxion();
  const { invoices, loading, createInvoice } = useInvoices();

  const handleCreate = async (data) => {
    const invoice = await createInvoice(data);
    // Handle success
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {invoices.map(invoice => (
        <InvoiceCard key={invoice.id} invoice={invoice} />
      ))}
    </div>
  );
}
```

### **Python SDK**
```python
from fluxion import FluxionAPI

client = FluxionAPI(
    base_url='https://api.fluxion.pay',
    api_key='your-api-key'
)

# Create invoice
invoice = client.invoices.create({
    'title': 'Consulting Services',
    'amount': 5000.00,
    'client_email': 'client@example.com'
})

# Get payment status
payment_status = client.payments.get_status(payment_id)
```

## 🐛 Error Handling

### **Error Response Structure**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "amount",
      "value": -100,
      "constraint": "Amount must be positive"
    }
  },
  "meta": {
    "requestId": "req_123abc",
    "timestamp": "2025-09-18T10:00:00.000Z"
  }
}
```

### **HTTP Status Codes**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable

### **Client Error Handling Example**
```typescript
try {
  const invoice = await fluxion.invoices.create(invoiceData);
} catch (error) {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      // Handle validation errors
      console.error('Validation failed:', error.details);
      break;
    case 'AUTHENTICATION_REQUIRED':
      // Redirect to login
      redirectToLogin();
      break;
    case 'RATE_LIMIT_EXCEEDED':
      // Implement retry with backoff
      await wait(error.details.reset_at);
      retry();
      break;
    default:
      // Handle unexpected errors
      console.error('Unexpected error:', error);
  }
}
```

---

## 🎯 Quick Reference

### **Most Common API Calls**

1. **Authenticate User**
   ```bash
   curl -X POST https://api.fluxion.pay/users/auth/message \
     -H "Content-Type: application/json" \
     -d '{"wallet_address":"0x123..."}'
   ```

2. **Create Invoice**
   ```bash
   curl -X POST https://api.fluxion.pay/invoices \
     -H "Authorization: Bearer {TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"title":"Services","amount":1000,"client_email":"client@example.com"}'
   ```

3. **Submit Payment**
   ```bash
   curl -X POST https://api.fluxion.pay/invoices/{id}/pay \
     -H "Content-Type: application/json" \
     -d '{"transaction_hash":"0xabc...","network_id":"polygon"}'
   ```

4. **Get Dashboard Stats**
   ```bash
   curl -H "Authorization: Bearer {TOKEN}" \
     https://api.fluxion.pay/dashboard/stats
   ```

### **Testing Endpoints**
- Health: `GET /health`
- Networks: `GET /networks`
- Tokens: `GET /tokens`
- API Docs: `GET /api-docs`

---

**This API documentation provides complete reference for integrating with the Fluxion Web3 payment platform. All endpoints are production-ready with comprehensive error handling and security.**

*API Documentation - September 2025*