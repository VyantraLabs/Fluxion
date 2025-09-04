# Fluxion PostgreSQL Database Architecture

## Overview
This document outlines the complete PostgreSQL schema design for the Fluxion Web3 payment platform, transitioning from DynamoDB to a multi-tenant, multi-blockchain architecture.

## Multi-Tenancy Strategy
**Approach**: Row-Level Security (RLS) with tenant_id column
- Single database with tenant isolation through RLS policies
- Better resource utilization than schema-per-tenant
- Easier maintenance and cross-tenant analytics
- Scalable with proper indexing and partitioning

## Core Tables Overview

| Table | Purpose | Primary Key | Multi-Tenant | Blockchain Support |
|-------|---------|-------------|--------------|-------------------|
| **organizations** | Store tenant/company metadata | UUID | Root entity | Configuration |
| **users** | User profiles with wallet links | UUID | organization_id | Wallet addresses |
| **blockchain_networks** | Network configurations | UUID | Global | Chain configs |
| **tokens** | Token definitions per network | UUID | Global | Per-network tokens |
| **smart_contracts** | Contract addresses & ABIs | UUID | Global | Network-specific |
| **invoices** | Payment requests | UUID | organization_id | Network + token |
| **payments** | Transaction records | UUID | organization_id | Full blockchain data |
| **payroll_batches** | Bulk payment operations | UUID | organization_id | Network + token |
| **organization_settings** | Tenant configurations | UUID | organization_id | Blockchain preferences |
| **audit_logs** | Compliance tracking | UUID | organization_id | All operations |

## Complete Database Schema

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Organizations/Tenants Table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'basic',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT organizations_slug_format CHECK (slug ~* '^[a-z0-9-]+$')
);

-- 2. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    wallet_address VARCHAR(42),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'member',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT users_email_org_unique UNIQUE (email, organization_id),
    CONSTRAINT users_wallet_format CHECK (wallet_address ~* '^0x[a-fA-F0-9]{40}$' OR wallet_address IS NULL)
);

-- 3. Blockchain Networks Table
CREATE TABLE blockchain_networks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    rpc_url VARCHAR(500) NOT NULL,
    explorer_url VARCHAR(500),
    is_testnet BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    gas_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tokens Table
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES blockchain_networks(id) ON DELETE CASCADE,
    contract_address VARCHAR(42),
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 18,
    is_native BOOLEAN DEFAULT false,
    is_stablecoin BOOLEAN DEFAULT false,
    logo_url VARCHAR(500),
    price_feed_id VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT tokens_address_network_unique UNIQUE (contract_address, network_id),
    CONSTRAINT tokens_native_address CHECK (
        (is_native = true AND contract_address IS NULL) OR 
        (is_native = false AND contract_address IS NOT NULL)
    )
);

-- 5. Smart Contracts Table
CREATE TABLE smart_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES blockchain_networks(id) ON DELETE CASCADE,
    contract_address VARCHAR(42) NOT NULL,
    contract_type VARCHAR(50) NOT NULL, -- 'payment', 'escrow', 'subscription'
    abi JSONB NOT NULL,
    version VARCHAR(20) DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,
    deployed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT contracts_address_network_unique UNIQUE (contract_address, network_id)
);

-- 6. Invoices Table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    invoice_number VARCHAR(50) NOT NULL,
    
    -- Invoice details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    
    -- Client information
    client_name VARCHAR(255),
    client_email VARCHAR(320),
    client_wallet VARCHAR(42),
    
    -- Payment details
    network_id UUID NOT NULL REFERENCES blockchain_networks(id),
    token_id UUID NOT NULL REFERENCES tokens(id),
    amount DECIMAL(36, 18) NOT NULL,
    amount_paid DECIMAL(36, 18) DEFAULT 0,
    
    -- Status and metadata
    status VARCHAR(20) DEFAULT 'draft', -- draft, sent, paid, overdue, cancelled
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- Constraints
    CONSTRAINT invoices_number_org_unique UNIQUE (invoice_number, organization_id),
    CONSTRAINT invoices_amount_positive CHECK (amount > 0),
    CONSTRAINT invoices_client_wallet_format CHECK (client_wallet ~* '^0x[a-fA-F0-9]{40}$' OR client_wallet IS NULL),
    CONSTRAINT invoices_status_valid CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'))
);

-- 7. Payments Table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    
    -- Transaction details
    tx_hash VARCHAR(66) NOT NULL,
    network_id UUID NOT NULL REFERENCES blockchain_networks(id),
    token_id UUID NOT NULL REFERENCES tokens(id),
    
    -- Payment details
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    gas_used BIGINT,
    gas_price DECIMAL(36, 18),
    
    -- Status and confirmation
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, failed
    block_number BIGINT,
    confirmations INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT payments_tx_network_unique UNIQUE (tx_hash, network_id),
    CONSTRAINT payments_amount_positive CHECK (amount > 0),
    CONSTRAINT payments_status_valid CHECK (status IN ('pending', 'confirmed', 'failed'))
);

-- 8. Payroll Batches Table
CREATE TABLE payroll_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- Batch details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    network_id UUID NOT NULL REFERENCES blockchain_networks(id),
    token_id UUID NOT NULL REFERENCES tokens(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, processing, completed, failed
    total_amount DECIMAL(36, 18) NOT NULL DEFAULT 0,
    recipients_count INTEGER NOT NULL DEFAULT 0,
    
    -- Transaction details
    tx_hash VARCHAR(66),
    gas_used BIGINT,
    gas_price DECIMAL(36, 18),
    
    -- Timestamps
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT payroll_status_valid CHECK (status IN ('draft', 'processing', 'completed', 'failed'))
);

-- 9. Payroll Recipients Table
CREATE TABLE payroll_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES payroll_batches(id) ON DELETE CASCADE,
    
    -- Recipient details
    name VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT payroll_recipients_amount_positive CHECK (amount > 0),
    CONSTRAINT payroll_recipients_wallet_format CHECK (wallet_address ~* '^0x[a-fA-F0-9]{40}$')
);

-- 10. Organization Settings Table (for tenant-specific configurations)
CREATE TABLE organization_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT org_settings_unique UNIQUE (organization_id, setting_key)
);

-- 11. Audit Log Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Audit details
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT audit_action_valid CHECK (action IN ('CREATE', 'UPDATE', 'DELETE'))
);
```

## Sample Queries

### Common Operations

```sql
-- 1. Get all invoices for an organization with payment status
SELECT 
    i.id,
    i.invoice_number,
    i.title,
    i.amount,
    i.amount_paid,
    i.status,
    t.symbol as token_symbol,
    n.name as network_name,
    COALESCE(SUM(p.amount), 0) as total_payments
FROM invoices i
    JOIN tokens t ON i.token_id = t.id
    JOIN blockchain_networks n ON i.network_id = n.id
    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'confirmed'
WHERE i.organization_id = $1 
    AND i.deleted_at IS NULL
GROUP BY i.id, t.symbol, n.name
ORDER BY i.created_at DESC;

-- 2. Get pending payments with network details
SELECT 
    p.id,
    p.tx_hash,
    p.amount,
    p.from_address,
    p.to_address,
    t.symbol,
    n.name as network_name,
    n.chain_id,
    p.created_at
FROM payments p
    JOIN tokens t ON p.token_id = t.id
    JOIN blockchain_networks n ON p.network_id = n.id
WHERE p.organization_id = $1 
    AND p.status = 'pending'
ORDER BY p.created_at DESC;

-- 3. Get organization settings with blockchain configs
SELECT 
    os.setting_key,
    os.setting_value,
    n.name as network_name,
    array_agg(t.symbol) as available_tokens
FROM organization_settings os
    LEFT JOIN blockchain_networks n ON true
    LEFT JOIN tokens t ON n.id = t.network_id
WHERE os.organization_id = $1 
    AND n.is_active = true
    AND t.is_active = true
GROUP BY os.id, os.setting_key, os.setting_value, n.name;
```

## Cross-Table Relationships

```
Organizations ── (1:many) ──> Users
Organizations ── (1:many) ──> Invoices
Organizations ── (1:many) ──> Payments
Organizations ── (1:many) ──> Payroll Batches
Organizations ── (1:many) ──> Organization Settings

Blockchain Networks ── (1:many) ──> Tokens
Blockchain Networks ── (1:many) ──> Smart Contracts
Blockchain Networks ── (1:many) ──> Invoices (payment network)
Blockchain Networks ── (1:many) ──> Payments

Invoices ── (1:many) ──> Payments
Payroll Batches ── (1:many) ──> Payroll Recipients

Users ── (1:many) ──> Invoices (created_by)
Users ── (1:many) ──> Payroll Batches (created_by)
```

## Multi-Chain Support Strategy

The new architecture provides comprehensive blockchain support through:

### 1. Dynamic Network Configuration
- **blockchain_networks** table stores all supported networks
- Network details configurable without code changes
- Support for mainnet and testnet environments
- Gas settings stored per network

### 2. Token Management
- **tokens** table linked to specific networks
- Support for native tokens and ERC20 contracts
- Stablecoin identification for payment preferences
- Token metadata (decimals, logos, price feeds)

### 3. Smart Contract Registry
- **smart_contracts** table for contract deployments
- ABI storage for contract interaction
- Version management for contract upgrades
- Contract type categorization (payment, escrow, subscription)

## Tenant Isolation Implementation

### Row-Level Security (RLS)
```sql
-- Set tenant context for database session
SET LOCAL app.current_tenant_id = 'organization-uuid-here';

-- All queries automatically filtered by tenant
SELECT * FROM invoices; -- Only returns current tenant's invoices
```

### Application-Level Isolation
- All multi-tenant tables include `organization_id` column
- Middleware sets tenant context from JWT/session
- Database policies enforce isolation at row level
- API endpoints validate tenant access permissions

## Migration Strategy from DynamoDB

### 1. Data Mapping
```javascript
// DynamoDB to PostgreSQL field mapping
const fieldMapping = {
  // Users table
  'PK': 'id', // Extract user ID from PK pattern
  'tenant_id': 'organization_id',
  'name': ['first_name', 'last_name'], // Split full name
  'wallets': 'wallet_address', // Take primary wallet
  'status': 'is_active',
  
  // Invoices table  
  'SK': 'id', // Extract invoice ID from SK pattern
  'freelancer_id': 'created_by',
  'token': 'token_id', // Map to token table lookup
  'chain_id': 'network_id', // Map to blockchain_networks table
  
  // Payments table
  'from_wallet': 'from_address',
  'to_wallet': 'to_address',
  'gas_fee': 'gas_price',
  'timestamp': 'created_at'
};
```

### 2. Migration Scripts
```bash
# Step 1: Export DynamoDB data
aws dynamodb scan --table-name FluxionUsers --output json > users.json
aws dynamodb scan --table-name FluxionInvoices --output json > invoices.json

# Step 2: Transform and import to PostgreSQL
node scripts/migrate-dynamodb-to-postgresql.js

# Step 3: Validate data integrity
npm run test:migration-validation
```

### 3. API Compatibility Layer
Maintain existing REST endpoints by creating compatibility functions:

```typescript
// Legacy DynamoDB-style response transformation
export const transformInvoiceResponse = (pgResult: Invoice): LegacyInvoiceResponse => ({
  PK: `TENANT#${pgResult.organization_id}`,
  SK: `INVOICE#${pgResult.id}`,
  invoice_id: pgResult.id,
  amount: pgResult.amount,
  token: pgResult.token.symbol,
  chain_id: pgResult.network.chain_id,
  // ... other field mappings
});
```

## Performance Optimizations and Scaling

### 1. Connection Pooling
```typescript
// Use pgbouncer for production connection pooling
const dbConfig = {
  host: process.env.PGBOUNCER_HOST,
  port: 6432, // pgbouncer port
  max: 20, // connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
```

### 2. Caching Strategy
```typescript
// Redis caching for frequently accessed data
const cacheConfig = {
  // Cache blockchain network data (rarely changes)
  networks: { ttl: 3600 }, // 1 hour
  
  // Cache token data (stable)  
  tokens: { ttl: 1800 }, // 30 minutes
  
  // Cache user sessions
  sessions: { ttl: 900 }, // 15 minutes
  
  // Cache organization settings
  settings: { ttl: 300 }, // 5 minutes
};
```

### 3. Query Optimization
```sql
-- Use materialized views for complex aggregations
CREATE MATERIALIZED VIEW organization_stats AS
SELECT 
  o.id,
  o.name,
  COUNT(i.id) as total_invoices,
  SUM(i.amount) as total_invoice_amount,
  COUNT(p.id) as total_payments,
  SUM(p.amount) as total_payment_amount
FROM organizations o
LEFT JOIN invoices i ON o.id = i.organization_id
LEFT JOIN payments p ON o.id = p.organization_id
GROUP BY o.id, o.name;

-- Refresh materialized view periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY organization_stats;
```

### 4. Partitioning for Large Tables
```sql
-- Partition audit logs by month for better performance
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Partition payments by organization for multi-tenancy
CREATE TABLE payments_large_orgs PARTITION OF payments
    FOR VALUES IN ('org-uuid-1', 'org-uuid-2', 'org-uuid-3');
```

## Security Configurations

### 1. Database Security
```sql
-- Create role for application with minimal permissions
CREATE ROLE fluxion_app;
GRANT CONNECT ON DATABASE fluxion TO fluxion_app;
GRANT USAGE ON SCHEMA public TO fluxion_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fluxion_app;

-- Restrict access to sensitive functions
REVOKE EXECUTE ON FUNCTION pgp_sym_decrypt FROM fluxion_app;
```

### 2. Encryption at Rest
```sql
-- Encrypt sensitive organization settings
CREATE OR REPLACE FUNCTION encrypt_setting(value JSONB, key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_encrypt(value::text, key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Audit Trail
```sql
-- Trigger function for audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        organization_id, 
        user_id,
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        ip_address
    ) VALUES (
        COALESCE(NEW.organization_id, OLD.organization_id),
        current_setting('app.current_user_id', true)::UUID,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) END,
        inet_client_addr()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

## Environment Configuration

### Local Development
```bash
# Docker Compose for local development
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: fluxion_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./seed.sql:/docker-entrypoint-initdb.d/02-seed.sql
      
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    
  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_USER: postgres
      DATABASES_PASSWORD: password
    ports:
      - "6432:6432"
```

### Production Environment
```bash
# Environment variables for production
DB_HOST=postgres-primary.internal
DB_PORT=5432
DB_NAME=fluxion_prod
DB_USER=fluxion_app
DB_PASSWORD=${DB_PASSWORD} # From AWS Secrets Manager
DB_SSL=true

PGBOUNCER_HOST=pgbouncer.internal
PGBOUNCER_PORT=6432

REDIS_CLUSTER_ENDPOINT=redis-cluster.internal:6379
REDIS_PASSWORD=${REDIS_PASSWORD} # From AWS Secrets Manager

# Connection pool settings
DB_POOL_MIN=10
DB_POOL_MAX=100
DB_POOL_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000
```

This architecture provides a robust, scalable foundation for Fluxion's Web3 payment platform with proper multi-tenancy, blockchain configuration management, performance optimization, and maintains API compatibility for seamless migration from DynamoDB.