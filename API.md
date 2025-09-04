# Fluxion API Documentation

Fluxion is a crypto-native invoicing platform that allows users to create, send, and manage invoices with cryptocurrency payments on Polygon network.

## Base URL
```
Development: https://api-gateway-id.execute-api.us-east-1.amazonaws.com/dev
Staging: https://api-gateway-id.execute-api.us-east-1.amazonaws.com/staging
Production: https://api.fluxion.pay
```

## Authentication

Fluxion uses JSON Web Tokens (JWT) for authentication. Most endpoints require a valid JWT token in the Authorization header.

### Wallet Authentication Flow
1. Request authentication message
2. Sign message with wallet (MetaMask, etc.)
3. Submit signature for verification
4. Receive JWT token for subsequent requests

```javascript
// Example authentication flow
const message = await fetch('/auth/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ wallet_address: '0x...' })
});

const signature = await ethereum.request({
  method: 'personal_sign',
  params: [message.data, walletAddress]
});

const auth = await fetch('/auth/verify-wallet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ wallet_address, signature, message })
});

const { token } = auth.data;
```

### Authorization Header
```
Authorization: Bearer <jwt_token>
```

## Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req-123",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be greater than 0",
        "code": "invalid_type"
      }
    ]
  },
  "meta": {
    "requestId": "req-123",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## API Endpoints

### Health Check

#### GET /health
Returns the health status of the API.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0",
    "environment": "production",
    "services": {
      "database": "healthy",
      "blockchain": "healthy",
      "notifications": "healthy"
    },
    "uptime": 3600
  }
}
```

---

## Authentication Endpoints

### Request Authentication Message

#### POST /auth/message
Generate a message for wallet signing.

**Request Body:**
```json
{
  "wallet_address": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Welcome to Fluxion!\n\nPlease sign this message to authenticate your wallet.\n\nWallet: 0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e\nNonce: abc123\nTimestamp: 1640995200000",
    "nonce": "abc123",
    "timestamp": 1640995200000
  }
}
```

### Verify Wallet Signature

#### POST /auth/verify-wallet
Verify wallet signature and receive JWT token.

**Request Body:**
```json
{
  "wallet_address": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
  "signature": "0x...",
  "message": "Welcome to Fluxion!..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "wallet_address": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
      "email": null,
      "display_name": null,
      "created_at": "2024-01-01T00:00:00.000Z",
      "stats": {
        "invoice_count": 0,
        "total_received": 0,
        "last_active_at": "2024-01-01T00:00:00.000Z"
      }
    },
    "expires_at": "2024-01-02T00:00:00.000Z"
  }
}
```

---

## User Endpoints

### Get User Profile

#### GET /users/profile
**Requires Authentication**

Get current user's profile information.

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet_address": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
    "email": "user@example.com",
    "display_name": "John Doe",
    "notification_preferences": {
      "email_on_payment": true,
      "email_on_invoice_viewed": true
    },
    "stats": {
      "invoice_count": 25,
      "total_received": 12500.50,
      "last_active_at": "2024-01-01T12:00:00.000Z"
    },
    "created_at": "2023-12-01T00:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  }
}
```

### Update User Profile

#### PUT /users/profile
**Requires Authentication**

Update current user's profile information.

**Request Body:**
```json
{
  "email": "newemail@example.com",
  "display_name": "John Smith",
  "notification_preferences": {
    "email_on_payment": false,
    "email_on_invoice_viewed": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet_address": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
    "email": "newemail@example.com",
    "display_name": "John Smith",
    "notification_preferences": {
      "email_on_payment": false,
      "email_on_invoice_viewed": true
    },
    "updated_at": "2024-01-01T13:00:00.000Z"
  }
}
```

---

## Invoice Endpoints

### Create Invoice

#### POST /invoices
**Requires Authentication**

Create a new invoice.

**Request Body:**
```json
{
  "creator_wallet": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
  "client_email": "client@example.com",
  "client_name": "Client Company",
  "amount": 250.00,
  "description": "Web development services",
  "due_date": "2024-01-15T23:59:59.000Z",
  "line_items": [
    {
      "description": "Frontend Development",
      "quantity": 20,
      "rate": 10.00,
      "amount": 200.00
    },
    {
      "description": "Testing & QA",
      "quantity": 5,
      "rate": 10.00,
      "amount": 50.00
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice_id": "inv_abc123",
    "creator_wallet": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
    "client_email": "client@example.com",
    "client_name": "Client Company",
    "amount": 250.00,
    "description": "Web development services",
    "status": "draft",
    "due_date": "2024-01-15T23:59:59.000Z",
    "payment_url": "https://app.fluxion.pay/pay/inv_abc123",
    "line_items": [...],
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get Invoice

#### GET /invoices/:id
Get invoice details by ID. Public endpoint for payment pages.

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice_id": "inv_abc123",
    "creator_wallet": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
    "client_email": "client@example.com",
    "client_name": "Client Company",
    "amount": 250.00,
    "description": "Web development services",
    "status": "pending",
    "due_date": "2024-01-15T23:59:59.000Z",
    "payment_url": "https://app.fluxion.pay/pay/inv_abc123",
    "line_items": [...],
    "payments": [
      {
        "payment_id": "pay_xyz789",
        "tx_hash": "0x...",
        "amount": 250.00,
        "status": "confirmed",
        "created_at": "2024-01-01T12:00:00.000Z"
      }
    ],
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  }
}
```

### Get Public Invoice

#### GET /invoices/:id/public
Get public invoice details for payment page (limited information).

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice_id": "inv_abc123",
    "creator_wallet": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
    "client_name": "Client Company",
    "amount": 250.00,
    "description": "Web development services",
    "status": "pending",
    "due_date": "2024-01-15T23:59:59.000Z",
    "line_items": [...],
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Update Invoice

#### PUT /invoices/:id
**Requires Authentication & Ownership**

Update an existing invoice.

**Request Body:**
```json
{
  "client_email": "newemail@example.com",
  "description": "Updated description",
  "due_date": "2024-01-20T23:59:59.000Z",
  "status": "pending"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice_id": "inv_abc123",
    "client_email": "newemail@example.com",
    "description": "Updated description",
    "due_date": "2024-01-20T23:59:59.000Z",
    "status": "pending",
    "updated_at": "2024-01-01T13:00:00.000Z"
  }
}
```

### Cancel Invoice

#### DELETE /invoices/:id
**Requires Authentication & Ownership**

Cancel (soft delete) an invoice.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Invoice cancelled successfully"
  }
}
```

### Send Invoice

#### POST /invoices/:id/send
**Requires Authentication & Ownership**

Send invoice to client (changes status to 'pending' and queues email notification).

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice_id": "inv_abc123",
    "status": "pending",
    "updated_at": "2024-01-01T13:00:00.000Z"
  }
}
```

### Get User Invoices

#### GET /invoices/user/:wallet
**Requires Authentication & Wallet Ownership**

Get all invoices for a specific wallet address.

**Query Parameters:**
- `limit` (optional): Number of invoices to return (default: 20, max: 100)
- `nextToken` (optional): Pagination token for next page
- `status` (optional): Filter by status (draft, pending, paid, expired, cancelled)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "invoice_id": "inv_abc123",
      "client_name": "Client Company",
      "amount": 250.00,
      "status": "paid",
      "due_date": "2024-01-15T23:59:59.000Z",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "hasMore": true,
    "nextToken": "eyJ..."
  }
}
```

### Get Dashboard Statistics

#### GET /invoices/dashboard/stats
**Requires Authentication**

Get invoice statistics for dashboard.

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_invoices": 25,
      "draft_invoices": 3,
      "pending_invoices": 5,
      "paid_invoices": 15,
      "total_revenue": 12500.50,
      "average_invoice_amount": 500.02
    },
    "recent_activity": {
      "invoices_last_30_days": 8,
      "revenue_last_30_days": 4250.00
    },
    "status_breakdown": {
      "draft": 3,
      "pending": 5,
      "paid": 15,
      "expired": 2,
      "cancelled": 0
    }
  }
}
```

---

## Payment Endpoints

### Verify Payment

#### POST /payments/verify
**Public Endpoint**

Verify a blockchain payment for an invoice.

**Request Body:**
```json
{
  "invoice_id": "inv_abc123",
  "tx_hash": "0x1234567890abcdef...",
  "from_address": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "payment_id": "pay_xyz789",
      "invoice_id": "inv_abc123",
      "tx_hash": "0x1234567890abcdef...",
      "from_address": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
      "to_address": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
      "amount": 250.00,
      "gas_used": 21000,
      "block_number": 12345678,
      "status": "confirmed",
      "confirmations": 15,
      "created_at": "2024-01-01T12:00:00.000Z"
    },
    "invoice": {
      "invoice_id": "inv_abc123",
      "status": "paid",
      "paid_at": "2024-01-01T12:00:00.000Z",
      "payment_tx_hash": "0x1234567890abcdef..."
    },
    "verification": {
      "isValid": true,
      "actualAmount": "250.000000",
      "actualSender": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
      "actualRecipient": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
      "confirmations": 15,
      "alreadyProcessed": false
    }
  }
}
```

### Get Payment Details

#### GET /payments/:id
**Requires Authentication**

Get payment details by payment ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_id": "pay_xyz789",
    "invoice_id": "inv_abc123",
    "tx_hash": "0x1234567890abcdef...",
    "from_address": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
    "to_address": "0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e",
    "amount": 250.00,
    "gas_used": 21000,
    "block_number": 12345678,
    "status": "confirmed",
    "confirmations": 15,
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:05:00.000Z"
  }
}
```

### Get Invoice Payments

#### GET /payments/invoice/:invoice_id
**Requires Authentication**

Get all payments for a specific invoice.

**Query Parameters:**
- `limit` (optional): Number of payments to return (default: 20, max: 100)
- `nextToken` (optional): Pagination token for next page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "payment_id": "pay_xyz789",
      "tx_hash": "0x1234567890abcdef...",
      "amount": 250.00,
      "status": "confirmed",
      "confirmations": 15,
      "created_at": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

---

## Analytics Endpoints

### Get Dashboard Analytics

#### GET /analytics/dashboard
**Requires Authentication**

Get comprehensive analytics for user dashboard.

**Query Parameters:**
- `period` (optional): Time period for analytics (7d, 30d, 90d, 1y) - default: 30d

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_invoices": 25,
      "total_revenue": 12500.50,
      "pending_amount": 1250.00,
      "success_rate": 85.7,
      "average_payment_time": 3.2
    },
    "revenue_trend": [
      {
        "date": "2024-01-01",
        "revenue": 500.00,
        "invoices": 2
      }
    ],
    "status_distribution": {
      "paid": 15,
      "pending": 5,
      "draft": 3,
      "expired": 2
    },
    "top_clients": [
      {
        "client_name": "Client Company",
        "total_amount": 2500.00,
        "invoice_count": 5
      }
    ],
    "payment_methods": {
      "polygon_usdc": 100
    }
  }
}
```

---

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Invalid request data | 400 |
| `UNAUTHORIZED` | Authentication required or invalid | 401 |
| `FORBIDDEN` | Access denied | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `CONFLICT` | Resource already exists or conflict | 409 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Internal server error | 500 |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable | 503 |
| `BLOCKCHAIN_ERROR` | Blockchain interaction error | 500 |
| `DATABASE_ERROR` | Database operation error | 500 |

## Rate Limits

- **Development**: 1000 requests per 15 minutes per IP
- **Production**: 100 requests per 15 minutes per IP
- **Authentication endpoints**: 10 requests per minute per IP
- **Payment verification**: 50 requests per minute per IP

## Supported Networks

- **Polygon Mainnet**: Chain ID 137
- **Token**: USDC (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)
- **Minimum confirmations**: 12 blocks
- **Payment timeout**: 24 hours

## Webhooks (Future)

Webhook support is planned for future versions to notify external systems of events:
- Invoice status changes
- Payment confirmations
- Failed payment attempts

## SDKs and Examples

### JavaScript/TypeScript
```javascript
const fluxion = new FluxionSDK({
  apiUrl: 'https://api.fluxion.pay',
  apiKey: 'your-api-key'
});

// Create invoice
const invoice = await fluxion.invoices.create({
  clientEmail: 'client@example.com',
  clientName: 'Client Company',
  amount: 250.00,
  description: 'Web development services'
});

// Verify payment
const payment = await fluxion.payments.verify({
  invoiceId: 'inv_abc123',
  txHash: '0x...',
  fromAddress: '0x...'
});
```

### Python
```python
from fluxion_sdk import FluxionClient

client = FluxionClient(api_url='https://api.fluxion.pay')

# Authenticate
auth = client.auth.verify_wallet(
    wallet_address='0x...',
    signature='0x...',
    message='...'
)

client.set_token(auth['token'])

# Create invoice
invoice = client.invoices.create({
    'client_email': 'client@example.com',
    'client_name': 'Client Company',
    'amount': 250.00,
    'description': 'Web development services'
})
```

## Testing

Use the following test data for development:

### Test Wallet Addresses
- Creator: `0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e`
- Client: `0x8ba1f109551bD432803012645Hac136c95ce69A88`

### Test Transaction Hashes
- Valid: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`
- Invalid: `0x0000000000000000000000000000000000000000000000000000000000000000`

For complete testing examples and integration tests, see the `/tests` directory in the repository.