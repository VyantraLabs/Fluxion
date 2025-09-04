# Fluxion MVP API Documentation

## Overview

Fluxion is a crypto-native invoicing platform built on AWS Lambda with a monolithic architecture. This documentation covers all available API endpoints, authentication, and deployment instructions.

**Base URL**: `https://api.fluxion.pay` (production) or `https://your-api-gateway-url/dev` (development)

## Authentication

Fluxion uses wallet signature-based authentication with JWT tokens.

### Authentication Flow

1. **Get Authentication Message**
   ```http
   POST /auth/message
   Content-Type: application/json

   {
     "wallet_address": "0x1234567890123456789012345678901234567890"
   }
   ```

2. **Verify Wallet Signature**
   ```http
   POST /auth/verify-wallet
   Content-Type: application/json

   {
     "wallet_address": "0x1234567890123456789012345678901234567890",
     "signature": "0x...",
     "message": "Welcome to Fluxion!..."
   }
   ```

3. **Use JWT Token**
   ```http
   Authorization: Bearer <jwt_token>
   ```

## API Endpoints

### Health & System

#### GET /health
System health check with service status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-09-03T10:00:00.000Z",
    "version": "1.0.0",
    "environment": "production",
    "services": {
      "database": "healthy",
      "blockchain": "healthy",
      "notifications": "healthy"
    },
    "service_details": {
      "database": { "latency": 45 },
      "blockchain": { "latency": 120 },
      "notifications": { "latency": 30 }
    },
    "memory_usage": { "heapUsed": 123456 },
    "uptime": 3600
  }
}
```

#### GET /metrics
System metrics for monitoring.

### User Management

#### POST /users/auth/message
Generate authentication message for wallet signing.

**Request:**
```json
{
  "wallet_address": "0x1234567890123456789012345678901234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Welcome to Fluxion!\n\nPlease sign this message to authenticate your wallet.\n\nWallet: 0x1234567890123456789012345678901234567890\nNonce: abc123\nTimestamp: 1693737600000",
    "nonce": "abc123",
    "timestamp": 1693737600000
  }
}
```

#### POST /users/auth/verify-wallet
Verify wallet signature and get JWT token.

**Request:**
```json
{
  "wallet_address": "0x1234567890123456789012345678901234567890",
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
      "wallet_address": "0x1234567890123456789012345678901234567890",
      "created_at": "2025-09-03T10:00:00.000Z"
    }
  }
}
```

#### GET /users/profile
Get current user profile (requires authentication).

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet_address": "0x1234567890123456789012345678901234567890",
    "email": "user@example.com",
    "display_name": "John Doe",
    "notification_preferences": {
      "email_on_payment": true,
      "email_on_invoice_viewed": false
    },
    "stats": {
      "invoice_count": 5,
      "total_received": 2500.00,
      "last_active_at": "2025-09-03T10:00:00.000Z"
    },
    "created_at": "2025-09-01T10:00:00.000Z",
    "updated_at": "2025-09-03T10:00:00.000Z"
  }
}
```

#### PUT /users/profile
Update current user profile (requires authentication).

**Request:**
```json
{
  "email": "newemail@example.com",
  "display_name": "John Smith",
  "notification_preferences": {
    "email_on_payment": true,
    "email_on_invoice_viewed": true
  }
}
```

#### DELETE /users/profile
Delete current user account (requires authentication).

#### GET /users/exists/:wallet
Check if user exists by wallet address.

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet_address": "0x1234567890123456789012345678901234567890",
    "exists": true,
    "profile_complete": true
  }
}
```

#### POST /users/validate-address
Validate wallet address format.

**Request:**
```json
{
  "wallet_address": "0x1234567890123456789012345678901234567890"
}
```

### Invoice Management

#### POST /invoices
Create a new invoice (requires authentication).

**Request:**
```json
{
  "client_email": "client@example.com",
  "client_name": "Client Name",
  "amount": 1500.00,
  "description": "Website development services",
  "due_date": "2025-10-01T23:59:59.000Z",
  "line_items": [
    {
      "description": "Frontend development",
      "quantity": 1,
      "rate": 1000.00,
      "amount": 1000.00
    },
    {
      "description": "Backend integration",
      "quantity": 1,
      "rate": 500.00,
      "amount": 500.00
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice_id": "inv_1234567890",
    "creator_wallet": "0x1234567890123456789012345678901234567890",
    "client_email": "client@example.com",
    "client_name": "Client Name",
    "amount": 1500.00,
    "description": "Website development services",
    "status": "draft",
    "due_date": "2025-10-01T23:59:59.000Z",
    "payment_url": "https://app.fluxion.pay/pay/inv_1234567890",
    "line_items": [...],
    "created_at": "2025-09-03T10:00:00.000Z",
    "updated_at": "2025-09-03T10:00:00.000Z"
  }
}
```

#### GET /invoices/:id
Get invoice by ID (public endpoint for payment pages).

#### GET /invoices/:id/public
Get public invoice data (limited information for payment pages).

#### GET /invoices/my
Get invoices for current authenticated user.

**Query Parameters:**
- `limit` (optional): Number of results (1-100, default: 20)
- `nextToken` (optional): Pagination token
- `status` (optional): Filter by status (`draft`, `pending`, `paid`, `expired`, `cancelled`)

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "invoice_id": "inv_1234567890",
        "client_name": "Client Name",
        "amount": 1500.00,
        "status": "pending",
        "created_at": "2025-09-03T10:00:00.000Z",
        "due_date": "2025-10-01T23:59:59.000Z"
      }
    ],
    "pagination": {
      "hasMore": false,
      "nextToken": null
    }
  }
}
```

#### PUT /invoices/:id
Update an invoice (requires authentication, creator only).

#### DELETE /invoices/:id
Cancel/delete an invoice (requires authentication, creator only).

#### POST /invoices/:id/send
Send an invoice to client (changes status to pending).

#### GET /invoices/dashboard/stats
Get dashboard statistics for authenticated user.

#### GET /invoices/:id/status
Get invoice status and payment info.

### Payment Processing

#### POST /payments/verify
Verify a blockchain payment.

**Request:**
```json
{
  "invoice_id": "inv_1234567890",
  "tx_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
  "from_address": "0x1234567890123456789012345678901234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "payment_id": "pay_1234567890",
      "invoice_id": "inv_1234567890",
      "tx_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
      "amount": 1500.00,
      "status": "confirmed",
      "confirmations": 15,
      "created_at": "2025-09-03T10:15:00.000Z"
    },
    "invoice": {
      "invoice_id": "inv_1234567890",
      "status": "paid",
      "paid_at": "2025-09-03T10:15:00.000Z"
    },
    "verification_details": {
      "is_valid": true,
      "confirmations": 15,
      "actual_amount": "1500.000000",
      "actual_sender": "0x1234567890123456789012345678901234567890",
      "actual_recipient": "0x0987654321098765432109876543210987654321",
      "already_processed": false
    }
  }
}
```

#### GET /payments/:id/status
Get payment status by payment ID.

#### GET /payments/invoice/:invoice_id
Get payments for an invoice (public endpoint).

#### GET /payments/my
Get payment history for authenticated user.

#### GET /payments/tx/:tx_hash
Get payment details by transaction hash.

#### POST /payments/:id/retry
Retry payment verification (for failed payments).

#### GET /payments/stats
Get payment statistics for authenticated user.

#### GET /payments/check-tx/:tx_hash
Check if a transaction hash has already been used.

### Analytics

#### GET /analytics/platform
Get platform-wide analytics (public endpoint).

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_invoices": 1250,
      "total_payments": 980,
      "total_volume": 125000.00,
      "total_users": 150,
      "active_users_7d": 45,
      "active_users_30d": 120
    },
    "invoice_stats": {
      "pending_invoices": 180,
      "paid_invoices": 980,
      "draft_invoices": 90,
      "cancelled_invoices": 15,
      "average_invoice_amount": 850.50,
      "payment_conversion_rate": 78.4
    },
    "trends": {
      "invoices_last_7d": 25,
      "invoices_last_30d": 150,
      "volume_last_7d": 15000.00,
      "volume_last_30d": 75000.00
    }
  }
}
```

#### GET /analytics/my
Get current user analytics (requires authentication).

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d`, `1y` (default: `30d`)

#### GET /analytics/dashboard
Get dashboard summary for current user (requires authentication).

## Error Handling

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req-1693737600-abc123",
    "timestamp": "2025-09-03T10:00:00.000Z",
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
        "message": "Amount must be at least $0.01",
        "code": "too_small"
      }
    ]
  },
  "meta": {
    "requestId": "req-1693737600-abc123",
    "timestamp": "2025-09-03T10:00:00.000Z"
  }
}
```

### HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service health check failed

### Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Access denied
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `BLOCKCHAIN_ERROR` - Blockchain interaction failed
- `DATABASE_ERROR` - Database operation failed
- `PAYMENT_VERIFICATION_ERROR` - Payment verification failed
- `INTERNAL_ERROR` - Unexpected server error

## Rate Limiting

API endpoints are rate limited:
- **Production**: 100 requests per 15 minutes per IP
- **Development**: 1000 requests per 15 minutes per IP

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Blockchain Integration

### Supported Networks
- **Polygon (Mainnet)**: Chain ID 137

### Supported Tokens
- **USDC**: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` (6 decimals)

### Payment Requirements
- Minimum confirmations: 12 blocks
- Payment timeout: 24 hours after invoice creation
- Exact amount matching required (±0.01 USDC tolerance)

## Webhooks & Notifications

Fluxion automatically sends email notifications for:
- Invoice created (to client)
- Payment received (to creator)
- Payment failed (to creator)
- Invoice reminders (to client)

## Development & Testing

### Local Development

1. **Set Environment Variables:**
   ```bash
   NODE_ENV=development
   JWT_SECRET=your-development-secret
   DYNAMODB_TABLE=fluxion-dev
   POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/
   ALCHEMY_API_KEY=your-alchemy-key
   ```

2. **Start Local Server:**
   ```bash
   cd main-lambda
   npm run start:dev
   ```

3. **Run Tests:**
   ```bash
   npm test
   ```

### API Testing

Use the health check endpoint to verify deployment:
```bash
curl https://your-api-gateway-url/health
```

Test authentication flow:
```bash
# 1. Get auth message
curl -X POST https://your-api-gateway-url/users/auth/message \
  -H "Content-Type: application/json" \
  -d '{"wallet_address":"0x1234567890123456789012345678901234567890"}'

# 2. Sign message with wallet and verify
curl -X POST https://your-api-gateway-url/users/auth/verify-wallet \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address":"0x1234567890123456789012345678901234567890",
    "signature":"0x...",
    "message":"Welcome to Fluxion!..."
  }'
```

## Security Considerations

### Authentication Security
- JWT tokens expire after 7 days
- Wallet signatures use EIP-191 standard
- Message replay protection with timestamps
- Rate limiting prevents brute force attacks

### API Security
- CORS configured for specific origins
- Helmet.js security headers
- Input validation with Zod schemas
- SQL injection prevention (NoSQL with DynamoDB)
- Secrets managed via AWS SSM Parameter Store

### Blockchain Security
- Transaction verification on Polygon network
- USDC contract interaction only
- Minimum confirmation requirements
- Duplicate transaction prevention
- Amount verification with tolerance

## Monitoring & Observability

### CloudWatch Metrics
- Lambda invocation count/duration/errors
- API Gateway request count/latency/errors
- DynamoDB read/write capacity/throttles
- SQS message count/processing time

### Logging
- Structured JSON logs with correlation IDs
- Error tracking with stack traces
- Performance metrics
- Security event logging

### Alerting
- Lambda error rate > 5% (5 minutes)
- API Gateway 5xx errors > 10 (5 minutes)
- DynamoDB throttling events
- SQS dead letter queue messages

## Deployment Guide

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

---

For support or questions, please contact: support@fluxion.pay