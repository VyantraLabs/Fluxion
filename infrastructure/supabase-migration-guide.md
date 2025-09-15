# Supabase Migration Strategy for Fluxion

## Overview
This guide details the migration strategy from local PostgreSQL to Supabase for production deployment, including data migration, connection pooling, and Row Level Security (RLS) configuration.

## Migration Strategy

### Phase 1: Supabase Project Setup

#### 1. Create Supabase Projects
```bash
# Create three projects for different environments
# 1. fluxion-dev (Development)
# 2. fluxion-staging (Staging) 
# 3. fluxion-prod (Production)
```

#### 2. Environment Configuration
```bash
# Development
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-key

# Staging
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-key

# Production
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key
```

### Phase 2: Schema Migration

#### 1. Export Current Schema
```bash
# From your local PostgreSQL, export the current schema
cd main-lambda
npm run typeorm -- schema:log > schema-export.sql

# Or use pg_dump for complete schema
pg_dump -h localhost -U postgres -d fluxion_dev --schema-only > fluxion-schema.sql
```

#### 2. Adapt Schema for Supabase
Create Supabase-specific migration files:

```sql
-- /infrastructure/supabase/migrations/01_initial_schema.sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Users table with RLS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    email VARCHAR(255),
    display_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Invoices table with RLS
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    title VARCHAR(500) NOT NULL,
    description TEXT,
    amount DECIMAL(20,8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    token_address VARCHAR(42),
    chain_id INTEGER,
    recipient_address VARCHAR(42),
    due_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_invoice_number_per_org UNIQUE(organization_id, invoice_number)
);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Continue with other tables...
-- (Add all your existing tables here)

-- Indexes for performance
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 3. Row Level Security Policies
```sql
-- /infrastructure/supabase/migrations/02_rls_policies.sql

-- RLS Policies for Users table
CREATE POLICY "Users can view their organization members" ON users
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own record" ON users
    FOR UPDATE USING (id = auth.uid());

-- RLS Policies for Invoices table
CREATE POLICY "Users can view their organization invoices" ON invoices
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create invoices in their organization" ON invoices
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update invoices in their organization" ON invoices
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

-- Service role bypass (for Lambda functions)
CREATE POLICY "Service role can access all data" ON users
    FOR ALL USING (
        current_setting('role') = 'service_role'
    );

CREATE POLICY "Service role can access all invoices" ON invoices
    FOR ALL USING (
        current_setting('role') = 'service_role'
    );
```

### Phase 3: Data Migration

#### 1. Data Export from Local
```bash
# Export data from local PostgreSQL
pg_dump -h localhost -U postgres -d fluxion_dev --data-only --inserts > fluxion-data.sql

# Or use specific table exports
pg_dump -h localhost -U postgres -d fluxion_dev -t organizations --data-only --inserts > organizations.sql
pg_dump -h localhost -U postgres -d fluxion_dev -t users --data-only --inserts > users.sql
pg_dump -h localhost -U postgres -d fluxion_dev -t invoices --data-only --inserts > invoices.sql
```

#### 2. Data Import to Supabase
```bash
# Connect to Supabase and import data
psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" < fluxion-data.sql

# Or use Supabase CLI
supabase db reset --db-url "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
```

### Phase 4: Connection Configuration

#### 1. TypeORM Configuration for Supabase
```typescript
// main-lambda/src/database/supabase-data-source.ts
import { DataSource } from 'typeorm';
import { config } from '../config';

export const SupabaseDataSource = new DataSource({
  type: 'postgres',
  url: config.supabase.url.replace('https://', 'postgresql://postgres:' + config.supabase.serviceRoleKey + '@').replace('.supabase.co', '.supabase.co:5432/postgres'),
  
  // Connection pooling configuration
  extra: {
    max: 10,              // Maximum pool size
    min: 2,               // Minimum pool size
    idle_timeout: 30000,  // 30 seconds
    connection_timeout: 5000, // 5 seconds
    statement_timeout: 30000, // 30 seconds
    
    // SSL configuration for Supabase
    ssl: {
      rejectUnauthorized: false
    }
  },
  
  // Entity configuration
  entities: [
    __dirname + '/entities/*.{js,ts}'
  ],
  migrations: [
    __dirname + '/migrations/*.{js,ts}'
  ],
  
  // Logging configuration
  logging: config.environment === 'development' ? ['query', 'error'] : ['error'],
  synchronize: false,
  migrationsRun: false,
  
  // Cache configuration
  cache: {
    type: 'database',
    duration: 30000 // 30 seconds
  }
});
```

#### 2. Environment-Specific Configuration
```typescript
// main-lambda/src/config/database.ts
export const getDatabaseConfig = () => {
  const environment = process.env.NODE_ENV || 'development';
  
  switch (environment) {
    case 'production':
      return {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        maxConnections: 10,
        connectionTimeout: 5000
      };
    
    case 'staging':
      return {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        maxConnections: 5,
        connectionTimeout: 5000
      };
    
    default: // development
      return {
        url: process.env.SUPABASE_URL || 'postgresql://postgres:password@localhost:5432/fluxion_dev',
        key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        maxConnections: 3,
        connectionTimeout: 5000
      };
  }
};
```

### Phase 5: Authentication Integration

#### 1. Supabase Auth Configuration
```typescript
// main-lambda/src/shared/middleware/supabase-auth.ts
import { createClient } from '@supabase/supabase-js';
import { Request, Response, NextFunction } from 'express';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const supabaseAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Add user context to request
    req.user = {
      id: user.id,
      wallet_address: user.user_metadata?.wallet_address,
      organization_id: user.user_metadata?.organization_id
    };

    next();
  } catch (error) {
    console.error('Supabase auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
```

### Phase 6: Performance Optimization

#### 1. Connection Pooling with PgBouncer
Supabase includes built-in connection pooling, but you can optimize further:

```typescript
// main-lambda/src/database/connection-pool.ts
import { Pool } from 'pg';

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10,                    // Max connections
  min: 2,                     // Min connections
  idle_timeout: 30000,        // 30 seconds
  connection_timeout: 5000,   // 5 seconds
  statement_timeout: 30000,   // 30 seconds
  
  // Supabase-specific optimizations
  ssl: { rejectUnauthorized: false },
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};

export const pool = new Pool(poolConfig);

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
```

#### 2. Query Optimization
```typescript
// main-lambda/src/database/repositories/OptimizedBaseRepository.ts
import { Repository, SelectQueryBuilder } from 'typeorm';

export class OptimizedBaseRepository<T> extends Repository<T> {
  
  // Add organization-scoped queries with proper indexing
  createOrganizationQuery(): SelectQueryBuilder<T> {
    return this.createQueryBuilder()
      .where('organization_id = :organizationId', { 
        organizationId: this.getOrganizationId() 
      })
      .addOrderBy('created_at', 'DESC');
  }
  
  // Implement efficient pagination
  async findPaginated(page: number, limit: number = 20) {
    const offset = (page - 1) * limit;
    
    return this.createOrganizationQuery()
      .limit(limit)
      .offset(offset)
      .getManyAndCount();
  }
  
  // Use prepared statements for better performance
  async findByStatusOptimized(status: string) {
    return this.query(
      'SELECT * FROM $1 WHERE organization_id = $2 AND status = $3 ORDER BY created_at DESC',
      [this.metadata.tableName, this.getOrganizationId(), status]
    );
  }
  
  private getOrganizationId(): string {
    // Get from request context
    return this.manager.connection.getMetadata('organization_id');
  }
}
```

## Migration Checklist

### Pre-Migration
- [ ] Set up Supabase projects (dev, staging, prod)
- [ ] Configure environment variables
- [ ] Test connection from local development
- [ ] Backup existing local database

### Schema Migration
- [ ] Run schema migration scripts on Supabase
- [ ] Set up Row Level Security policies
- [ ] Create necessary indexes
- [ ] Test RLS policies with sample data

### Data Migration
- [ ] Export data from local PostgreSQL
- [ ] Clean and validate data
- [ ] Import data to Supabase development
- [ ] Verify data integrity
- [ ] Test application with migrated data

### Application Updates
- [ ] Update TypeORM configuration
- [ ] Implement Supabase connection pooling
- [ ] Update authentication middleware
- [ ] Test all API endpoints
- [ ] Run full test suite

### Performance Testing
- [ ] Load test database connections
- [ ] Monitor query performance
- [ ] Optimize slow queries
- [ ] Test connection pooling limits

### Production Deployment
- [ ] Deploy to staging environment
- [ ] Run integration tests
- [ ] Monitor performance metrics
- [ ] Deploy to production
- [ ] Monitor production metrics

## Rollback Strategy

### Emergency Rollback
```bash
# Quick rollback to local PostgreSQL
# 1. Update environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=postgres
export DB_PASSWORD=password

# 2. Restart application
npm run start:prod

# 3. Verify connectivity
npm run typeorm -- query "SELECT COUNT(*) FROM users"
```

### Data Recovery
```bash
# If data loss occurs, restore from backup
supabase db reset --db-url "your-supabase-url"
psql "your-supabase-url" < backup-data.sql
```

This migration strategy provides a comprehensive approach to moving from local PostgreSQL to Supabase while maintaining data integrity, performance, and security.