# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fluxion is a **production-ready Web3 payment platform** for crypto-native invoicing and payroll. Originally built with DynamoDB and serverless, it has been successfully migrated to PostgreSQL with TypeORM for better relational data management and enterprise features.

**Current Status**: MVP Phase 1 Complete - Crypto Invoicing & Payroll implemented with PostgreSQL backend and Next.js frontend structure.

## Common Development Commands

### Backend Development (main-lambda)
```bash
# Development server with hot reload
cd main-lambda && npm run start:dev

# Run all tests
npm test

# Test with coverage
npm run test:cov  

# Run specific test
npm test -- --testNamePattern="InvoiceService"

# Watch mode testing
npm run test:watch

# Linting
npm run lint
npm run lint:fix

# TypeScript build
npm run build
```

### Database Management
```bash
cd main-lambda

# Generate new migration from entity changes
npm run migration:generate -- src/database/migrations/YourMigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Seed database with initial data
npm run seed:run

# Reset database (drop, migrate, seed) - DEVELOPMENT ONLY
npm run db:reset

# Direct TypeORM CLI access
npm run typeorm -- <command>
```

### Frontend Development
```bash
cd frontend

# Development server
npm run dev

# Build production
npm run build

# Type checking
npm run type-check

# Run tests
npm test
```

### Docker Services
```bash
# Start all services (PostgreSQL, Redis, PgBouncer, etc.)
docker-compose -f docker-compose.dev.yml up -d

# Stop all services
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f postgres

# Reset volumes (clean database)
docker-compose -f docker-compose.dev.yml down -v
```

### Deployment
```bash
# Build both lambdas
npm run build

# Deploy to AWS (dev environment)
sam build && sam deploy --config-env dev

# Deploy to production
sam build && sam deploy --config-env production
```

## High-Level Architecture

### Project Structure
```
fluxion/
├── main-lambda/              # Primary backend API service
│   ├── src/
│   │   ├── config/          # Application configuration & Swagger
│   │   ├── database/       # TypeORM entities, migrations, repositories
│   │   │   ├── entities/   # Domain models (User, Invoice, Payment, etc.)
│   │   │   ├── migrations/ # Database schema migrations
│   │   │   └── repositories/ # Data access layer with business logic
│   │   ├── modules/         # Feature modules (invoices, payments, users)
│   │   │   └── */
│   │   │       ├── handlers.ts  # Express route handlers
│   │   │       └── service.ts   # Business logic layer
│   │   ├── shared/          # Cross-cutting concerns
│   │   │   ├── blockchain/  # Ethers.js blockchain client
│   │   │   ├── cache/       # Redis caching layer
│   │   │   ├── middleware/  # Express middleware (auth, tenant)
│   │   │   └── validation/  # Zod schemas for request validation
│   │   └── types/           # TypeScript type definitions
│   └── tests/               # Jest test suites
├── notification-lambda/      # Email notification service (SQS consumer)
├── frontend/                # Next.js 14 application
│   └── src/
│       ├── app/            # App router pages
│       ├── components/     # React components
│       ├── contexts/       # React contexts (Auth, Web3)
│       └── utils/          # Helper functions & API client
└── infrastructure/         # AWS deployment configurations
```

### Key Architecture Decisions

1. **PostgreSQL Multi-Tenant Design**: Each organization has isolated data using `organization_id` foreign keys throughout the schema. Row-level security ensures tenant isolation.

2. **TypeORM Repository Pattern**: Custom repositories extend `BaseRepository` to provide consistent CRUD operations with automatic tenant scoping and soft deletes.

3. **Dynamic Blockchain Support**: Networks and tokens are stored in database tables, allowing runtime configuration without code changes.

4. **Redis Caching Strategy**: Multi-level caching with separate Redis databases for cache (DB 1) and sessions (DB 2).

5. **JWT + Wallet Authentication**: Users authenticate via wallet signature verification, receiving JWT tokens for subsequent API calls.

6. **Express Monolith in Lambda**: Single Express application deployed as Lambda function with API Gateway, providing RESTful endpoints.

## Database Schema Overview

### Core Tables
- **organizations**: Multi-tenant root entity
- **users**: Wallet-based user accounts with organization association  
- **invoices**: Invoice management with status tracking
- **payments**: Payment records linked to invoices
- **blockchain_networks**: Dynamic blockchain configuration
- **tokens**: ERC-20 token contracts per network
- **audit_logs**: Comprehensive activity logging

### Key Relationships
- All entities (except blockchain_networks/tokens) have `organization_id` for tenant isolation
- Invoices belong to users and organizations
- Payments reference invoices and include blockchain transaction details
- Tokens are associated with specific blockchain networks

## API Patterns

### Authentication Flow
1. `POST /users/auth/challenge` - Get message to sign
2. Sign message with wallet (client-side)
3. `POST /users/auth/verify` - Submit signature, receive JWT
4. Include JWT in `Authorization: Bearer <token>` header

### Standard Response Format
```typescript
{
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    pagination?: {...};
    timestamp: string;
  };
}
```

### Error Handling
- Custom error classes in `src/shared/errors/`
- Consistent error codes and messages
- Proper HTTP status codes
- Detailed error logging with correlation IDs

## Testing Approach

### Test Organization
- **Unit Tests**: `src/**/*.spec.ts` - Service and utility testing
- **Integration Tests**: `tests/integration/` - API endpoint testing
- **Setup**: `tests/setup.ts` - Test database configuration

### Running Tests
```bash
# Single test file
npm test -- src/modules/invoices/service.spec.ts

# Pattern matching
npm test -- --testNamePattern="should create invoice"

# Update snapshots
npm test -- -u
```

### Coverage Requirements
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

## Environment Configuration

### Required Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=fluxion_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# AWS (for production)
AWS_REGION=us-east-1
NOTIFICATION_QUEUE_URL=https://sqs...
```

### Local Development Setup
1. Copy `.env.example` to `.env` in main-lambda
2. Start Docker services: `docker-compose -f docker-compose.dev.yml up -d`
3. Run migrations: `cd main-lambda && npm run migration:run`
4. Seed data: `npm run seed:run`
5. Start dev server: `npm run start:dev`

## Blockchain Integration

### Supported Networks (Configurable via Database)
- Ethereum Mainnet (Chain ID: 1)
- Polygon (Chain ID: 137)
- Arbitrum One (Chain ID: 42161)
- Base (Chain ID: 8453)

### Payment Verification Flow
1. User submits transaction hash via `/invoices/:id/pay`
2. Backend queries blockchain via RPC to verify transaction
3. Validates: amount, recipient, token contract, network
4. Updates invoice status and creates payment record
5. Triggers notification via SQS queue

### Adding New Networks/Tokens
Networks and tokens are managed via database, not hardcoded. Use admin endpoints or direct database insertion to add new configurations.

## Development Workflow Best Practices

### Before Making Changes
1. Ensure Docker services are running
2. Pull latest migrations: `npm run migration:run`
3. Verify tests pass: `npm test`

### When Adding Features
1. Create TypeORM entity if new data model needed
2. Generate migration: `npm run migration:generate`
3. Implement repository with BaseRepository extension
4. Add service layer with business logic
5. Create handlers with proper validation (Zod schemas)
6. Write comprehensive tests (aim for >80% coverage)
7. Update API documentation (Swagger annotations)

### Before Committing
1. Run linter: `npm run lint:fix`
2. Run tests: `npm test`
3. Build TypeScript: `npm run build`
4. Test migrations on fresh database if schema changed

## Common Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.dev.yml ps

# Test connection
psql postgresql://postgres:password@localhost:5432/fluxion_dev

# View PostgreSQL logs
docker-compose -f docker-compose.dev.yml logs postgres
```

### Migration Problems
```bash
# Check migration status
npm run typeorm -- migration:show

# Revert if needed
npm run migration:revert

# Clean slate (DEVELOPMENT ONLY)
npm run db:reset
```

### Test Failures
```bash
# Run with verbose output
npm test -- --verbose

# Check test database
psql postgresql://postgres:password@localhost:5432/fluxion_test
```

## Key Files to Understand

1. **main-lambda/src/database/data-source.ts** - TypeORM configuration
2. **main-lambda/src/database/repositories/BaseRepository.ts** - Repository pattern implementation
3. **main-lambda/src/shared/middleware/index.ts** - Authentication & tenant middleware
4. **main-lambda/src/modules/invoices/handlers.ts** - Example of API endpoint implementation
5. **main-lambda/src/shared/blockchain/enhanced-client.ts** - Blockchain interaction layer
6. **docker-compose.dev.yml** - Local development environment setup

## Production Considerations

1. **Database**: Uses RDS Aurora PostgreSQL with connection pooling via PgBouncer
2. **Caching**: ElastiCache Redis for session and data caching
3. **Monitoring**: CloudWatch logs with structured JSON logging
4. **Security**: Row-level security, JWT auth, input validation, rate limiting
5. **Scaling**: Lambda concurrency limits, database connection pooling
6. **Migrations**: Run via Lambda invocation or ECS task in production