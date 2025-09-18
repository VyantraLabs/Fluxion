# Fluxion Development Guide

**Version**: 3.0.0 - Consolidated Development Guide  
**Last Updated**: September 18, 2025  
**Status**: Complete Developer Onboarding and Workflow Documentation

Comprehensive developer guide for the Fluxion Web3 payment platform, covering setup, workflows, testing, and contribution guidelines.

## 🚀 Quick Start

### Prerequisites
- **Node.js**: 20.x or later
- **Docker & Docker Compose**: For database services
- **Git**: Version control
- **PostgreSQL Client**: For database management (optional)
- **Redis CLI**: For cache debugging (optional)

### Option A: Docker Development (Recommended)

```bash
# 1. Clone and setup
git clone https://github.com/yourorg/fluxion
cd fluxion

# 2. Start all services with Docker
docker-compose -f docker-compose.dev.yml up -d

# 3. Install dependencies
cd main-lambda && npm install && cd ..
cd notification-lambda && npm install && cd ..
cd frontend && npm install && cd ..

# 4. Run database migrations
cd main-lambda
npm run migration:run
npm run seed:run

# 5. Start development servers
npm run start:dev  # Backend API (port 3000)
cd ../frontend && npm run dev  # Frontend (port 3001)
```

### Option B: Microservices Development

```bash
# 1. Start all microservices
./scripts/start-services.sh

# 2. Or start services individually
cd services/main-service && npm run start:dev  # Port 3000
cd services/admin-service && PORT=3001 npm run start:dev  # Port 3001
cd frontend && npm run dev  # Port 3002
```

### 🎯 Quick Verification
```bash
# Health check
curl http://localhost:3000/health

# View available blockchain networks
curl http://localhost:3000/networks

# Access API documentation
open http://localhost:3000/api-docs
```

## 🏗️ Project Structure

### **Main Lambda Architecture**
```
main-lambda/
├── src/
│   ├── config/              # Application configuration & Swagger
│   ├── database/           # TypeORM entities, migrations, repositories
│   │   ├── entities/       # Domain models (User, Invoice, Payment, etc.)
│   │   ├── migrations/     # Database schema migrations
│   │   ├── repositories/   # Data access layer with business logic
│   │   └── seeds/          # Initial data seeding
│   ├── modules/            # Feature modules (invoices, payments, users)
│   │   ├── invoices/
│   │   │   ├── handlers.ts # Express route handlers
│   │   │   ├── service.ts  # Business logic layer
│   │   │   └── types.ts    # TypeScript type definitions
│   │   ├── payments/       # Payment processing
│   │   ├── users/          # User management  
│   │   ├── templates/      # Template management
│   │   ├── organizations/  # Organization management
│   │   ├── admin/          # Admin functionality
│   │   └── notifications/  # Notification handling
│   ├── shared/             # Cross-cutting concerns
│   │   ├── blockchain/     # Ethers.js blockchain client
│   │   ├── cache/          # Redis caching layer
│   │   ├── middleware/     # Express middleware (auth, tenant)
│   │   ├── services/       # Shared business services
│   │   ├── validation/     # Zod schemas for request validation
│   │   └── utils/          # Helper functions & utilities
│   └── types/              # Global TypeScript type definitions
└── tests/                  # Jest test suites
    ├── unit/               # Unit tests for services
    ├── integration/        # API endpoint tests
    └── setup.ts            # Test environment configuration
```

### **Frontend Architecture**
```
frontend/
├── src/
│   ├── app/                # Next.js 14 App Router
│   │   ├── dashboard/      # Main dashboard pages
│   │   │   ├── organizations/ # Multi-org dashboard
│   │   │   ├── invoices/   # Invoice management
│   │   │   ├── templates/  # Template gallery
│   │   │   └── users/      # User management
│   │   ├── invoice/        # Public invoice portal
│   │   └── globals.css     # Global styles
│   ├── components/         # Reusable React components
│   │   ├── dashboard/      # Dashboard-specific components
│   │   ├── invoices/       # Invoice components
│   │   ├── templates/      # Template components
│   │   ├── users/          # User management components
│   │   └── web3/           # Web3 integration components
│   ├── contexts/           # React contexts (Auth, Web3, Config)
│   ├── utils/              # Helper functions & API client
│   └── types/              # TypeScript type definitions
└── public/                 # Static assets
```

### **Microservices Architecture (Optional)**
```
services/
├── main-service/           # User-facing APIs
├── admin-service/          # Admin-only APIs
└── shared/                 # Shared library

packages/
└── fluxion-shared/         # Reusable components
    ├── config/             # Common configuration
    ├── types/              # TypeScript interfaces
    ├── utils/              # Utility functions
    ├── validation/         # Zod schemas
    └── swagger/            # API documentation
```

## 🛠️ Development Commands

### **Backend Development (main-lambda)**
```bash
# Development server with hot reload
npm run start:dev

# Build for production
npm run build

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

# TypeScript type checking
npm run type-check
```

### **Database Management**
```bash
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

# Check migration status
npm run typeorm -- migration:show
```

### **Frontend Development**
```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Run tests (if configured)
npm test
```

### **Docker Services**
```bash
# Start all services (PostgreSQL, Redis, PgBouncer, etc.)
docker-compose -f docker-compose.dev.yml up -d

# Stop all services
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f postgres

# Reset volumes (clean database)
docker-compose -f docker-compose.dev.yml down -v

# Check service status
docker-compose -f docker-compose.dev.yml ps
```

## 🧪 Testing Strategy

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

# Run integration tests
npm run test:integration

# Run unit tests only
npm run test:unit
```

### **Test Organization**
- **Unit Tests**: `src/**/*.spec.ts` - Service and utility testing
- **Integration Tests**: `tests/integration/` - API endpoint testing
- **Database Tests**: Repository and migration testing
- **Setup**: `tests/setup.ts` - Test database configuration

### **Test Coverage Requirements**
- **Branches**: >80%
- **Functions**: >80%
- **Lines**: >80%
- **Statements**: >80%

### **Writing Tests**
```typescript
// Service testing pattern
describe('InvoiceService', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    await seedTestData();
  });
  
  afterEach(async () => {
    await cleanupTestDatabase();
  });
  
  describe('createInvoice', () => {
    it('should create invoice with valid data', async () => {
      const result = await invoiceService.createInvoice(validInvoiceData);
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
    });
    
    it('should reject invalid invoice data', async () => {
      await expect(
        invoiceService.createInvoice(invalidInvoiceData)
      ).rejects.toThrow('Invalid invoice data');
    });
  });
});

// API endpoint testing
describe('POST /invoices', () => {
  it('should create invoice with authentication', async () => {
    const response = await request(app)
      .post('/invoices')
      .set('Authorization', `Bearer ${validJwtToken}`)
      .send(validInvoiceData)
      .expect(201);
      
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
  });
});
```

## 🔄 Development Workflow

### **Feature Development Process**

1. **Create Feature Branch**
```bash
git checkout -b feature/payment-verification
```

2. **Implement Changes**
   - Create/modify entities if needed
   - Generate migration if schema changes
   - Implement service layer with business logic
   - Create handlers with proper validation
   - Write comprehensive tests
   - Update API documentation

3. **Database Changes**
```bash
# If you modified entities
npm run migration:generate -- src/database/migrations/AddPaymentVerification

# Test migration
npm run migration:run
```

4. **Testing**
```bash
# Run all tests
npm test

# Check coverage
npm run test:cov

# Integration testing
npm run test:integration
```

5. **Code Quality**
```bash
# Lint and format
npm run lint:fix

# Type checking
npm run build

# Verify all checks pass
npm run test && npm run lint && npm run build
```

### **Adding New Features**

#### 1. Database Schema Changes
```bash
# 1. Modify entity in src/database/entities/
# 2. Generate migration
npm run migration:generate -- src/database/migrations/AddNewFeature

# 3. Review generated migration
# 4. Apply migration
npm run migration:run

# 5. Update repository if needed
# 6. Update seed data if required
```

#### 2. API Endpoint Creation
```typescript
// 1. Add to module handlers (e.g., src/modules/invoices/handlers.ts)
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const validatedData = validateInvoiceData(req.body);
    const result = await invoiceService.createInvoice(validatedData);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(error, res);
  }
};

// 2. Add validation schema (src/shared/validation/)
export const invoiceCreateSchema = z.object({
  title: z.string().min(1).max(255),
  amount: z.number().positive(),
  clientEmail: z.string().email(),
  dueDate: z.string().datetime()
});

// 3. Add service method (src/modules/invoices/service.ts)
export class InvoiceService {
  async createInvoice(data: CreateInvoiceData): Promise<Invoice> {
    // Business logic implementation
    return this.invoiceRepository.create(data);
  }
}

// 4. Add tests
describe('createInvoice', () => {
  it('should create invoice successfully', async () => {
    // Test implementation
  });
});
```

#### 3. Frontend Component Development
```typescript
// 1. Create component (src/components/invoices/InvoiceForm.tsx)
interface InvoiceFormProps {
  onSubmit: (data: InvoiceFormData) => void;
  initialData?: Invoice;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ onSubmit, initialData }) => {
  // Component implementation
};

// 2. Add to page (src/app/dashboard/invoices/create/page.tsx)
export default function CreateInvoicePage() {
  const handleSubmit = async (data: InvoiceFormData) => {
    const result = await apiClient.invoices.create(data);
    // Handle result
  };

  return <InvoiceForm onSubmit={handleSubmit} />;
}

// 3. Update API client (src/utils/api.ts)
export const apiClient = {
  invoices: {
    create: (data: InvoiceFormData) => 
      fetch('/api/invoices', { method: 'POST', body: JSON.stringify(data) })
  }
};
```

### **Multi-Organization Development**

When working with multi-tenant features:

```typescript
// 1. Ensure organization context in middleware
export const requireOrganizationContext = (req: Request, res: Response, next: NextFunction) => {
  const organizationId = req.user.organizationId;
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization context required' });
  }
  req.organizationId = organizationId;
  next();
};

// 2. Use organization-scoped repositories
export class InvoiceRepository extends BaseRepository<Invoice> {
  async findByOrganization(organizationId: string): Promise<Invoice[]> {
    return this.find({ where: { organizationId } });
  }
}

// 3. Test with multiple organizations
describe('Multi-tenant invoice access', () => {
  it('should only return invoices for user organization', async () => {
    const org1Invoices = await invoiceService.findByOrganization(org1.id);
    const org2Invoices = await invoiceService.findByOrganization(org2.id);
    
    expect(org1Invoices).not.toContainEqual(
      expect.objectContaining({ organizationId: org2.id })
    );
  });
});
```

## 🔧 Development Environment

### **Environment Variables**

Create `.env` files for different components:

#### main-lambda/.env
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=fluxion_user
DB_PASSWORD=fluxion_password
DB_DATABASE=fluxion_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
NODE_ENV=development
PORT=3000
JWT_SECRET=development-secret

# Blockchain RPCs
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-key
POLYGON_RPC_URL=https://polygon-mainnet.alchemyapi.io/v2/your-key
```

#### frontend/.env.local
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_MAIN_SERVICE_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_SERVICE_URL=http://localhost:3001

# Web3 Configuration
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-project-id
```

### **IDE Configuration**

#### VS Code Settings (.vscode/settings.json)
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/*.js.map": true
  }
}
```

#### Recommended Extensions
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- REST Client
- PostgreSQL Explorer
- Docker

## 🚨 Debugging & Troubleshooting

### **Backend Debugging**

#### Database Connection Issues
```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.dev.yml ps

# Test connection directly
psql postgresql://fluxion_user:fluxion_password@localhost:5432/fluxion_dev

# View PostgreSQL logs
docker-compose -f docker-compose.dev.yml logs postgres

# Check database tables
npm run typeorm -- query "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

#### API Debugging
```bash
# Enable debug logging
DEBUG=fluxion:* npm run start:dev

# Test specific endpoints
curl -v http://localhost:3000/health
curl -X POST http://localhost:3000/users/auth/message -H "Content-Type: application/json" -d '{"wallet_address":"0x123..."}'

# Check logs
tail -f logs/app.log
```

#### Migration Issues
```bash
# Check migration status
npm run typeorm -- migration:show

# Manually revert if needed
npm run migration:revert

# Clean slate (DEVELOPMENT ONLY)
npm run db:reset
```

### **Frontend Debugging**

#### Common Issues
```bash
# Clear Next.js cache
rm -rf .next

# Check environment variables
echo $NEXT_PUBLIC_API_URL

# Test API connectivity
curl http://localhost:3000/health

# Check browser console for errors
# Network tab for API calls
```

#### Authentication Issues
```javascript
// Debug JWT token in browser console
const token = localStorage.getItem('auth_token');
console.log('Token:', token);

// Decode JWT (for debugging only)
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Token payload:', payload);
```

### **Common Development Issues**

#### 1. Port Conflicts
```bash
# Check what's running on ports
lsof -i :3000
lsof -i :3001

# Kill processes if needed
pkill -f "node.*3000"
```

#### 2. Database Connection Pool Exhaustion
```bash
# Check active connections
npm run typeorm -- query "SELECT count(*) FROM pg_stat_activity;"

# Reset connection pool
docker-compose -f docker-compose.dev.yml restart postgres
```

#### 3. Redis Cache Issues
```bash
# Connect to Redis
redis-cli -p 6379

# Clear cache
FLUSHALL

# Check memory usage
INFO memory
```

## 📚 Code Style & Standards

### **TypeScript Configuration**
- Strict type checking enabled
- Path mapping for clean imports
- Consistent tsconfig across projects

### **Linting and Formatting**
- ESLint with TypeScript support
- Prettier for code formatting
- Husky git hooks for pre-commit checks

### **Naming Conventions**
```typescript
// Files: kebab-case
user-service.ts
invoice-repository.ts

// Classes: PascalCase
class InvoiceService {}
class UserRepository {}

// Functions/Variables: camelCase
const createInvoice = () => {};
const userEmail = 'user@example.com';

// Constants: SCREAMING_SNAKE_CASE
const MAX_INVOICE_AMOUNT = 1000000;
const DEFAULT_PAGINATION_LIMIT = 20;

// Interfaces: PascalCase with descriptive names
interface CreateInvoiceRequest {}
interface InvoiceCreatedEvent {}
```

### **Import Organization**
```typescript
// 1. Node modules
import express from 'express';
import { Repository } from 'typeorm';

// 2. Internal modules (absolute paths)
import { InvoiceService } from '@/modules/invoices/service';
import { validateInvoiceData } from '@/shared/validation';

// 3. Relative imports
import { InvoiceEntity } from './entities/Invoice';
import { calculateInvoiceTotal } from '../utils/calculations';
```

## 🤝 Contributing Guidelines

### **Pull Request Process**

1. **Create Feature Branch**
```bash
git checkout -b feature/description
```

2. **Make Changes**
   - Follow coding standards
   - Write comprehensive tests
   - Update documentation
   - Ensure all checks pass

3. **Commit Guidelines**
```bash
# Use conventional commit format
git commit -m "feat: add payment verification endpoint"
git commit -m "fix: resolve database connection pool issue"
git commit -m "docs: update API documentation"
git commit -m "test: add integration tests for invoice creation"
```

4. **Pre-commit Checklist**
   - [ ] All tests pass (`npm test`)
   - [ ] Linting passes (`npm run lint`)
   - [ ] Build succeeds (`npm run build`)
   - [ ] Documentation updated
   - [ ] Migration created if schema changed

5. **Create Pull Request**
   - Clear title and description
   - Link to relevant issues
   - Include testing instructions
   - Request appropriate reviewers

### **Code Review Guidelines**

**For Authors:**
- Provide clear PR description
- Include screenshots for UI changes
- Test all edge cases
- Consider security implications

**For Reviewers:**
- Check for security vulnerabilities
- Verify test coverage
- Ensure documentation is updated
- Test functionality locally

## 📖 Additional Resources

### **Documentation**
- [Architecture Documentation](./ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](./API.md)
- [Security Documentation](./SECURITY.md)

### **External Resources**
- [TypeORM Documentation](https://typeorm.io/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Ethers.js Documentation](https://docs.ethers.io/)
- [Jest Testing Framework](https://jestjs.io/docs)
- [Zod Validation](https://zod.dev/)

### **Team Communication**
- **Daily Standups**: 9:00 AM UTC
- **Sprint Planning**: Bi-weekly Mondays
- **Code Reviews**: Within 24 hours
- **Emergency Contact**: Slack #fluxion-dev

---

## 🎯 Development Checklist

### **New Developer Onboarding**
- [ ] Repository cloned and dependencies installed
- [ ] Development environment running successfully
- [ ] Database migrations executed and seeded
- [ ] Health endpoints returning success
- [ ] API documentation accessible
- [ ] First test passing
- [ ] IDE configured with recommended extensions

### **Feature Development Checklist**
- [ ] Feature branch created from latest main
- [ ] Database schema changes (if needed) with migration
- [ ] Service layer implementation with business logic
- [ ] API handlers with proper validation
- [ ] Comprehensive test coverage (>80%)
- [ ] Frontend components (if needed)
- [ ] API documentation updated
- [ ] Code review completed
- [ ] All checks passing (tests, lint, build)

### **Release Preparation Checklist**
- [ ] All features tested end-to-end
- [ ] Database migrations tested on staging
- [ ] Performance testing completed
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Deployment process verified
- [ ] Rollback plan prepared
- [ ] Team trained on new features

---

**This development guide provides everything needed to contribute effectively to the Fluxion platform. The codebase is designed for maintainability, testability, and scalability.**

*Development Documentation - September 2025*