# Fluxion - Web3 Payment Platform

A production-ready Web3 payment platform for crypto-native invoicing and payroll, built with Node.js, TypeScript, PostgreSQL, and Next.js.

## 🚀 Overview

Fluxion is a comprehensive Web3 payment platform designed to be the "Stripe of Web3" - providing crypto-native invoicing, multi-blockchain payment processing, and enterprise-grade tools for the decentralized economy.

### ✅ **Current Status: Production Ready MVP**
- **PostgreSQL Backend**: Multi-tenant architecture with TypeORM
- **Dynamic Blockchain Support**: Networks and tokens configurable via database
- **Multi-tenant Architecture**: Organization-based data isolation
- **Comprehensive API**: RESTful endpoints with Swagger documentation
- **Frontend Ready**: Next.js application structure in place

## 🏗️ Architecture

### **Modern Multi-Service Architecture**
```
fluxion/
├── main-lambda/           # Backend API (Express.js + PostgreSQL + TypeORM)
├── notification-lambda/   # Email notification service
├── frontend/             # Next.js frontend application
├── infrastructure/       # AWS deployment configurations
└── docs/                # API documentation and schemas
```

### **Key Technologies**
- **Backend**: Node.js 20, Express.js, TypeORM, PostgreSQL 15
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Database**: PostgreSQL with Redis caching
- **Blockchain**: Ethers.js v6, multi-chain support
- **Infrastructure**: AWS Lambda, RDS Aurora, ElastiCache
- **Authentication**: JWT with wallet signature verification

## 🌟 Features

### **Invoice Management**
- Create and manage professional crypto invoices
- PDF generation with payment QR codes
- Multi-currency support (USDC, USDT, DAI)
- Automated payment tracking and verification

### **Multi-Blockchain Support**
- **Dynamic Network Configuration**: Add new blockchains without code changes
- **Supported Networks**: Ethereum, Polygon, Arbitrum, Base, and more
- **Token Management**: Configurable token contracts per network
- **Cross-chain Payments**: Unified payment interface across networks

### **Enterprise Features**
- **Multi-tenancy**: Organization-based data isolation with row-level security
- **Wallet Authentication**: Secure Web3 authentication via signature verification
- **Email Notifications**: Automated lifecycle notifications (invoice created, paid, etc.)
- **Analytics Dashboard**: Payment tracking and business metrics
- **API Documentation**: Comprehensive Swagger/OpenAPI specification

### **Developer Experience**
- **Type-safe**: Full TypeScript implementation
- **Comprehensive Testing**: >80% test coverage with unit and integration tests
- **Hot Reloading**: Fast development with ts-node-dev
- **Database Migrations**: Automated schema management with TypeORM
- **Containerization**: Docker Compose for local development

## 📋 Quick Start

### Prerequisites
- **Node.js**: 20.x or later
- **Docker**: For PostgreSQL and Redis
- **Git**: For version control

### 1. Setup Repository
```bash
# Clone the repository
git clone https://github.com/yourorg/fluxion
cd fluxion

# Install backend dependencies
cd main-lambda
npm install
cd ..
```

### 2. Start Database Services
```bash
# Start PostgreSQL and Redis with Docker
docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker-compose.dev.yml ps
```

### 3. Configure Environment
```bash
# Create environment file
cd main-lambda
cp .env.example .env

# Edit .env with your settings
# DATABASE_URL=postgresql://fluxion_user:fluxion_password@localhost:5432/fluxion_db
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=your-super-secret-jwt-key
```

### 4. Initialize Database
```bash
# Run migrations to create schema
npm run migration:run

# Seed initial data (blockchain networks, tokens)
npm run seed:run
```

### 5. Start Development
```bash
# Start backend API server
npm run start:dev

# API available at: http://localhost:3000
# API Documentation: http://localhost:3000/api-docs
# Database Admin: http://localhost:8080 (pgAdmin)
```

### 6. Test the API
```bash
# Health check
curl http://localhost:3000/health

# Get available blockchain networks
curl http://localhost:3000/networks

# Get available tokens
curl http://localhost:3000/tokens

# Generate wallet authentication challenge
curl -X POST http://localhost:3000/users/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "0x742d35Cc6634C0532925a3b8D4c4e32C3FD929fa"}'
```

## 🗄️ Database Schema

### **Multi-Tenant PostgreSQL Design**
- **Organizations**: Tenant isolation with row-level security
- **Users**: Wallet-based user accounts
- **Invoices**: Professional invoice management
- **Payments**: Payment tracking and verification
- **Blockchain Networks**: Dynamic blockchain configuration
- **Tokens**: Multi-network token management
- **Audit Logs**: Comprehensive activity logging

### **Key Features**
- **Row-Level Security (RLS)**: Automatic tenant data isolation
- **Foreign Key Constraints**: Data integrity enforcement
- **Optimized Indexes**: Performance tuned for common queries
- **ACID Compliance**: Full transaction support

## 🌐 Blockchain Integration

### **Supported Networks**
Networks are now dynamically configured via database:
- **Ethereum Mainnet** (Chain ID: 1)
- **Polygon** (Chain ID: 137)
- **Arbitrum One** (Chain ID: 42161)
- **Base** (Chain ID: 8453)
- **Custom Networks**: Add any EVM-compatible chain

### **Supported Tokens**
Tokens are managed per network:
- **USDC**: Primary stablecoin across all networks
- **USDT**: Tether stablecoin support
- **DAI**: MakerDAO stablecoin
- **Custom Tokens**: Add any ERC-20 token

### **Payment Verification Flow**
1. **User submits payment** with transaction hash
2. **Backend verifies transaction** on specified network
3. **Validates payment details** (amount, recipient, token contract)
4. **Updates invoice status** and records payment
5. **Sends notifications** to relevant parties

## 📊 API Documentation

### **Base URLs**
- **Development**: `http://localhost:3000`
- **Staging**: `https://api-staging.fluxion.pay`
- **Production**: `https://api.fluxion.pay`

### **Authentication Flow**
```bash
# 1. Request authentication challenge
curl -X POST /users/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "0x..."}'

# 2. Sign message with wallet and verify
curl -X POST /users/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0x...",
    "signature": "0x...",
    "message": "Welcome to Fluxion..."
  }'

# 3. Use returned JWT token for authenticated requests
curl -H "Authorization: Bearer <jwt-token>" /invoices
```

### **Core API Endpoints**

| Endpoint | Method | Description | Auth |
|----------|---------|------------|------|
| `/health` | GET | System health check | ❌ |
| `/networks` | GET | List blockchain networks | ❌ |
| `/tokens` | GET | List available tokens | ❌ |
| `/users/auth/challenge` | POST | Get authentication challenge | ❌ |
| `/users/auth/verify` | POST | Verify wallet signature | ❌ |
| `/invoices` | POST | Create new invoice | ✅ |
| `/invoices/:id` | GET | Get invoice details | ❌ |
| `/invoices/:id/pay` | POST | Submit payment | ❌ |
| `/users/:address/invoices` | GET | User's invoices | ✅ |
| `/payments/verify` | POST | Verify payment transaction | ❌ |

**Complete API Documentation**: Available at `/api-docs` endpoint

## 🧪 Testing

### **Comprehensive Test Suite**
```bash
# Run all tests
npm test

# Run with coverage report
npm run test:cov

# Run specific test files
npm test -- --testNamePattern="Invoice"

# Watch mode for development
npm run test:watch
```

### **Test Coverage Requirements**
- **Branches**: >80%
- **Functions**: >80% 
- **Lines**: >80%
- **Statements**: >80%

### **Test Types**
- **Unit Tests**: Service and utility function testing
- **Integration Tests**: API endpoint testing with test database
- **Database Tests**: Repository and migration testing

## 🚀 Production Deployment

### **AWS Infrastructure**
- **RDS Aurora PostgreSQL**: High-availability database cluster
- **ElastiCache Redis**: Distributed caching layer
- **Lambda Functions**: Serverless API and notification processing
- **API Gateway**: Request routing and rate limiting
- **CloudWatch**: Logging, monitoring, and alerting

### **Deployment Commands**
```bash
# Production deployment
npm run build
sam deploy --config-env production

# Database migrations in production
aws lambda invoke \
  --function-name fluxion-prod-MainLambda \
  --payload '{"action": "migrate", "direction": "up"}' \
  response.json
```

### **Environment Configuration**
```bash
# Store secrets in AWS Parameter Store
aws ssm put-parameter \
  --name "/fluxion/prod/database-url" \
  --type "SecureString" \
  --value "postgresql://user:password@cluster.rds.amazonaws.com:5432/fluxion"

aws ssm put-parameter \
  --name "/fluxion/prod/jwt-secret" \
  --type "SecureString" \
  --value "production-jwt-secret-very-secure"
```

## 🔧 Development Workflow

### **Adding New Blockchain Networks**
```bash
# Add network via API (admin access required)
curl -X POST http://localhost:3000/admin/networks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -d '{
    "name": "Optimism",
    "chain_id": 10,
    "rpc_url": "https://optimism-mainnet.infura.io/v3/YOUR_KEY",
    "block_explorer": "https://optimistic.etherscan.io",
    "native_currency": "ETH",
    "is_testnet": false
  }'

# Add USDC token for the network
curl -X POST http://localhost:3000/admin/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -d '{
    "name": "USD Coin",
    "symbol": "USDC",
    "address": "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
    "decimals": 6,
    "network_id": "optimism-mainnet",
    "is_stablecoin": true
  }'
```

### **Database Management**
```bash
# Create new migration
npm run migration:generate -- src/database/migrations/AddNewFeature

# Apply migrations
npm run migration:run

# Rollback migration
npm run migration:revert

# Reset database (development only)
npm run db:reset
```

### **Code Quality**
```bash
# Lint code
npm run lint
npm run lint:fix

# Type checking
npm run build

# Run all quality checks
npm run test && npm run lint && npm run build
```

## 📈 Performance & Monitoring

### **Database Optimization**
- **Connection Pooling**: Optimized PostgreSQL connections
- **Query Optimization**: Indexed queries for common operations
- **Row-Level Security**: Efficient tenant data isolation
- **Redis Caching**: Multi-level caching for frequently accessed data

### **Monitoring & Alerts**
```bash
# Health endpoints
curl http://localhost:3000/health
curl http://localhost:3000/health/database
curl http://localhost:3000/health/cache

# Performance monitoring
# CloudWatch metrics for Lambda duration, errors, and throughput
# PostgreSQL performance insights
# Redis memory and hit rate monitoring
```

### **Logging**
Structured JSON logging with correlation IDs:
```json
{
  "timestamp": "2025-09-04T10:00:00.000Z",
  "level": "info",
  "context": "InvoiceService",
  "message": "Invoice created successfully", 
  "requestId": "req-123-abc",
  "organizationId": "org_abc_123",
  "invoiceId": "inv_456_def",
  "walletAddress": "0x742d35Cc..."
}
```

## 🔒 Security Features

### **Authentication & Authorization**
- **Wallet-based Authentication**: Cryptographic signature verification
- **JWT Tokens**: Secure session management
- **Multi-tenant Isolation**: Row-level security policies
- **Rate Limiting**: Request throttling per IP/user

### **Data Protection**
- **Input Validation**: Comprehensive Zod schema validation
- **SQL Injection Prevention**: TypeORM query builder protection
- **CORS Configuration**: Strict cross-origin policies
- **Encryption**: TLS in transit, encryption at rest

### **Infrastructure Security**
- **VPC Isolation**: Network-level security
- **Security Groups**: Firewall rules
- **IAM Policies**: Least-privilege access
- **Secrets Management**: AWS Parameter Store integration

## 🐛 Troubleshooting

### **Common Issues**

#### Backend won't start
```bash
# Check Node.js version
node --version  # Should be 20.x+

# Verify dependencies
npm install

# Check environment variables
cat .env

# Test database connection
psql $DATABASE_URL -c "SELECT 1"
```

#### Database connection failed
```bash
# Verify Docker services
docker-compose -f docker-compose.dev.yml ps

# Check PostgreSQL logs
docker-compose -f docker-compose.dev.yml logs postgres

# Test direct connection
psql postgresql://fluxion_user:fluxion_password@localhost:5432/fluxion_db
```

#### API endpoints returning errors
```bash
# Check application logs
npm run start:dev  # Look for startup errors

# Test health endpoint
curl -v http://localhost:3000/health

# Check database connectivity
curl http://localhost:3000/health/database
```

## 🤝 Contributing

### **Development Guidelines**
1. **Fork the repository** and create a feature branch
2. **Follow TypeScript best practices** with strict type checking
3. **Write comprehensive tests** for new functionality
4. **Update documentation** for API changes
5. **Run quality checks** before submitting PR

### **Commit Guidelines**
```bash
# Conventional commit format
feat: add multi-chain payment support
fix: resolve PostgreSQL connection pool exhaustion
docs: update API documentation for webhook endpoints
test: add integration tests for payment verification
```

## 🗺️ Roadmap

### **Phase 1: MVP (Completed ✅)**
- ✅ PostgreSQL multi-tenant architecture
- ✅ Dynamic blockchain network support
- ✅ Crypto invoice management
- ✅ Wallet authentication
- ✅ Payment verification system

### **Phase 2: Enhancement (In Progress 🔄)**
- 🔄 Frontend integration and UI polish
- 🔄 PDF invoice generation
- 🔄 Advanced payment analytics
- 🔄 Webhook API for integrations

### **Phase 3: Scale (Planned 📋)**
- 📋 Escrow and milestone payments
- 📋 Recurring payment subscriptions
- 📋 Cross-chain atomic swaps
- 📋 White-label solutions

### **Phase 4: Enterprise (Future 🔮)**
- 🔮 Advanced compliance reporting
- 🔮 Multi-signature treasury management
- 🔮 Advanced fraud detection
- 🔮 Enterprise SSO integration

## 📝 License & Support

### **License**
MIT License - see [LICENSE](LICENSE) file for details.

### **Support Channels**
- **Documentation**: Complete deployment and API docs included
- **Issues**: Create GitHub issues for bugs and feature requests
- **Email**: devops@fluxion.pay for technical support
- **Community**: Join our Discord for discussions and updates

### **Project Status**
- **Current Version**: v1.0.0
- **Development Status**: Production Ready MVP
- **Database Migration**: Completed (DynamoDB → PostgreSQL)
- **API Stability**: Stable (backward compatible)
- **Infrastructure**: AWS production ready

---

**🚀 Built for the future of Web3 payments - Fluxion makes crypto invoicing simple, secure, and scalable.**

*Last Updated: September 2025*