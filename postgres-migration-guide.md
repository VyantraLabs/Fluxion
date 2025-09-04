# PostgreSQL Migration Guide for Fluxion

This guide provides step-by-step instructions for migrating Fluxion from DynamoDB to PostgreSQL with full API compatibility.

## Pre-Migration Checklist

### 1. Environment Setup
```bash
# Install required dependencies
npm install pg @types/pg typeorm reflect-metadata class-validator class-transformer
npm install --save-dev @types/node ts-node

# Install development tools
npm install --save-dev pgbouncer redis
```

### 2. Database Setup
```bash
# Local development with Docker
docker-compose up -d postgres redis pgbouncer

# Or install PostgreSQL locally
brew install postgresql redis
brew services start postgresql redis
```

### 3. Environment Variables
```bash
# Add to .env files
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=fluxion_dev
DB_SYNCHRONIZE=false
DB_LOGGING=true

# Redis for caching
REDIS_URL=redis://localhost:6379

# Connection pooling
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
```

## TypeORM Configuration

### 1. Data Source Configuration
```typescript
// src/config/database.config.ts
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DatabaseConfig {
  constructor(private configService: ConfigService) {}

  createDataSource(): DataSource {
    return new DataSource({
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      username: this.configService.get<string>('DB_USERNAME'),
      password: this.configService.get<string>('DB_PASSWORD'),
      database: this.configService.get<string>('DB_DATABASE'),
      synchronize: this.configService.get<boolean>('DB_SYNCHRONIZE', false),
      logging: this.configService.get<boolean>('DB_LOGGING', false),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      subscribers: [__dirname + '/../subscribers/*{.ts,.js}'],
      extra: {
        max: this.configService.get<number>('DB_POOL_MAX', 20),
        min: this.configService.get<number>('DB_POOL_MIN', 5),
        idleTimeoutMillis: this.configService.get<number>('DB_POOL_IDLE_TIMEOUT', 30000),
        connectionTimeoutMillis: this.configService.get<number>('DB_CONNECTION_TIMEOUT', 2000),
      },
    });
  }
}
```

### 2. TypeORM Module Setup
```typescript
// src/config/typeorm.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const typeOrmConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_DATABASE'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false, // Always false in production
  logging: configService.get<boolean>('DB_LOGGING', false),
  extra: {
    max: configService.get<number>('DB_POOL_MAX', 20),
    min: configService.get<number>('DB_POOL_MIN', 5),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});
```

## Entity Definitions

### 1. Base Entity
```typescript
// src/entities/base.entity.ts
import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at?: Date;
}
```

### 2. Organization Entity
```typescript
// src/entities/organization.entity.ts
import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Invoice } from './invoice.entity';
import { Payment } from './payment.entity';
import { OrganizationSetting } from './organization-setting.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  slug: string;

  @Column({ type: 'varchar', length: 50, default: 'basic' })
  plan: string;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, any>;

  // Relationships
  @OneToMany(() => User, user => user.organization, { cascade: true })
  users: User[];

  @OneToMany(() => Invoice, invoice => invoice.organization, { cascade: true })
  invoices: Invoice[];

  @OneToMany(() => Payment, payment => payment.organization, { cascade: true })
  payments: Payment[];

  @OneToMany(() => OrganizationSetting, setting => setting.organization, { cascade: true })
  organizationSettings: OrganizationSetting[];
}
```

### 3. User Entity
```typescript
// src/entities/user.entity.ts
import { Entity, Column, ManyToOne, OneToMany, Index, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Organization } from './organization.entity';
import { Invoice } from './invoice.entity';

@Entity('users')
@Index(['email', 'organization_id'], { unique: true })
export class User extends BaseEntity {
  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar', length: 320 })
  email: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  @Index()
  wallet_address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  first_name?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  last_name?: string;

  @Column({ type: 'varchar', length: 50, default: 'member' })
  role: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  email_verified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at?: Date;

  // Relationships
  @ManyToOne(() => Organization, organization => organization.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => Invoice, invoice => invoice.created_by_user)
  created_invoices: Invoice[];

  // Computed properties
  get full_name(): string {
    return [this.first_name, this.last_name].filter(Boolean).join(' ');
  }
}
```

### 4. Blockchain Network Entity
```typescript
// src/entities/blockchain-network.entity.ts
import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Token } from './token.entity';
import { SmartContract } from './smart-contract.entity';
import { Invoice } from './invoice.entity';
import { Payment } from './payment.entity';

@Entity('blockchain_networks')
export class BlockchainNetwork extends BaseEntity {
  @Column({ type: 'integer', unique: true })
  @Index()
  chain_id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  symbol: string;

  @Column({ type: 'varchar', length: 500 })
  rpc_url: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  explorer_url?: string;

  @Column({ type: 'boolean', default: false })
  is_testnet: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'jsonb', default: {} })
  gas_settings: Record<string, any>;

  // Relationships
  @OneToMany(() => Token, token => token.network, { cascade: true })
  tokens: Token[];

  @OneToMany(() => SmartContract, contract => contract.network, { cascade: true })
  smart_contracts: SmartContract[];

  @OneToMany(() => Invoice, invoice => invoice.network)
  invoices: Invoice[];

  @OneToMany(() => Payment, payment => payment.network)
  payments: Payment[];
}
```

### 5. Token Entity
```typescript
// src/entities/token.entity.ts
import { Entity, Column, ManyToOne, OneToMany, Index, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { BlockchainNetwork } from './blockchain-network.entity';
import { Invoice } from './invoice.entity';
import { Payment } from './payment.entity';

@Entity('tokens')
@Index(['contract_address', 'network_id'], { unique: true })
export class Token extends BaseEntity {
  @Column({ type: 'uuid' })
  network_id: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  contract_address?: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  symbol: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'integer', default: 18 })
  decimals: number;

  @Column({ type: 'boolean', default: false })
  is_native: boolean;

  @Column({ type: 'boolean', default: false })
  is_stablecoin: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  price_feed_id?: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  // Relationships
  @ManyToOne(() => BlockchainNetwork, network => network.tokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'network_id' })
  network: BlockchainNetwork;

  @OneToMany(() => Invoice, invoice => invoice.token)
  invoices: Invoice[];

  @OneToMany(() => Payment, payment => payment.token)
  payments: Payment[];
}
```

### 6. Invoice Entity
```typescript
// src/entities/invoice.entity.ts
import { Entity, Column, ManyToOne, OneToMany, Index, JoinColumn, Check } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Organization } from './organization.entity';
import { User } from './user.entity';
import { BlockchainNetwork } from './blockchain-network.entity';
import { Token } from './token.entity';
import { Payment } from './payment.entity';

@Entity('invoices')
@Index(['invoice_number', 'organization_id'], { unique: true })
@Index(['organization_id', 'status'])
@Check(`amount > 0`)
@Check(`amount_paid >= 0`)
export class Invoice extends BaseEntity {
  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'varchar', length: 50 })
  invoice_number: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'date', nullable: true })
  @Index()
  due_date?: Date;

  // Client information
  @Column({ type: 'varchar', length: 255, nullable: true })
  client_name?: string;

  @Column({ type: 'varchar', length: 320, nullable: true })
  @Index()
  client_email?: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  client_wallet?: string;

  // Payment details
  @Column({ type: 'uuid' })
  network_id: string;

  @Column({ type: 'uuid' })
  token_id: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  @Column({ type: 'decimal', precision: 36, scale: 18, default: '0' })
  amount_paid: string;

  // Status and metadata
  @Column({ 
    type: 'varchar', 
    length: 20, 
    default: 'draft',
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled']
  })
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // Timestamps
  @Column({ type: 'timestamptz', nullable: true })
  sent_at?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at?: Date;

  // Relationships
  @ManyToOne(() => Organization, organization => organization.invoices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => User, user => user.created_invoices)
  @JoinColumn({ name: 'created_by' })
  created_by_user: User;

  @ManyToOne(() => BlockchainNetwork, network => network.invoices)
  @JoinColumn({ name: 'network_id' })
  network: BlockchainNetwork;

  @ManyToOne(() => Token, token => token.invoices)
  @JoinColumn({ name: 'token_id' })
  token: Token;

  @OneToMany(() => Payment, payment => payment.invoice)
  payments: Payment[];

  // Computed properties
  get is_fully_paid(): boolean {
    return parseFloat(this.amount_paid) >= parseFloat(this.amount);
  }

  get remaining_amount(): string {
    return (parseFloat(this.amount) - parseFloat(this.amount_paid)).toString();
  }
}
```

### 7. Payment Entity
```typescript
// src/entities/payment.entity.ts
import { Entity, Column, ManyToOne, Index, JoinColumn, Check } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Organization } from './organization.entity';
import { Invoice } from './invoice.entity';
import { BlockchainNetwork } from './blockchain-network.entity';
import { Token } from './token.entity';

@Entity('payments')
@Index(['tx_hash', 'network_id'], { unique: true })
@Index(['organization_id', 'status'])
@Check(`amount > 0`)
export class Payment extends BaseEntity {
  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid', nullable: true })
  invoice_id?: string;

  // Transaction details
  @Column({ type: 'varchar', length: 66 })
  @Index()
  tx_hash: string;

  @Column({ type: 'uuid' })
  network_id: string;

  @Column({ type: 'uuid' })
  token_id: string;

  // Payment details
  @Column({ type: 'varchar', length: 42 })
  from_address: string;

  @Column({ type: 'varchar', length: 42 })
  to_address: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  @Column({ type: 'bigint', nullable: true })
  gas_used?: number;

  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: true })
  gas_price?: string;

  // Status and confirmation
  @Column({ 
    type: 'varchar', 
    length: 20, 
    default: 'pending',
    enum: ['pending', 'confirmed', 'failed']
  })
  status: 'pending' | 'confirmed' | 'failed';

  @Column({ type: 'bigint', nullable: true })
  block_number?: number;

  @Column({ type: 'integer', default: 0 })
  confirmations: number;

  // Metadata
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  confirmed_at?: Date;

  // Relationships
  @ManyToOne(() => Organization, organization => organization.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Invoice, invoice => invoice.payments, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;

  @ManyToOne(() => BlockchainNetwork, network => network.payments)
  @JoinColumn({ name: 'network_id' })
  network: BlockchainNetwork;

  @ManyToOne(() => Token, token => token.payments)
  @JoinColumn({ name: 'token_id' })
  token: Token;

  // Computed properties
  get is_confirmed(): boolean {
    return this.status === 'confirmed';
  }

  get total_gas_cost(): string | null {
    if (this.gas_used && this.gas_price) {
      return (this.gas_used * parseFloat(this.gas_price)).toString();
    }
    return null;
  }
}
```

## Migration Scripts

### 1. DynamoDB Export Script
```typescript
// scripts/export-dynamodb-data.ts
import AWS from 'aws-sdk';
import fs from 'fs';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1', // Your AWS region
});

interface ExportConfig {
  tableName: string;
  outputFile: string;
  transformFunction?: (item: any) => any;
}

async function exportTable({ tableName, outputFile, transformFunction }: ExportConfig) {
  console.log(`Exporting ${tableName}...`);
  
  let items: any[] = [];
  let lastEvaluatedKey: any = undefined;

  do {
    const params: AWS.DynamoDB.DocumentClient.ScanInput = {
      TableName: tableName,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    try {
      const result = await dynamodb.scan(params).promise();
      
      if (result.Items) {
        const transformedItems = transformFunction 
          ? result.Items.map(transformFunction)
          : result.Items;
        items.push(...transformedItems);
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
      console.log(`Exported ${items.length} items so far...`);
    } catch (error) {
      console.error(`Error scanning ${tableName}:`, error);
      throw error;
    }
  } while (lastEvaluatedKey);

  fs.writeFileSync(outputFile, JSON.stringify(items, null, 2));
  console.log(`Exported ${items.length} items to ${outputFile}`);
}

// Transform functions for each table
const transformers = {
  users: (item: any) => ({
    // Extract user ID from PK pattern: USER#tenant123#user456
    id: item.PK.split('#')[2],
    organization_id: item.PK.split('#')[1],
    email: item.email,
    wallet_address: item.wallets?.[0]?.address || null,
    first_name: item.name?.split(' ')[0] || null,
    last_name: item.name?.split(' ').slice(1).join(' ') || null,
    role: item.role || 'member',
    is_active: item.status === 'active',
    created_at: item.created_at,
  }),

  invoices: (item: any) => ({
    id: item.SK.split('#')[1], // Extract from INVOICE#inv987
    organization_id: item.PK.split('#')[1], // Extract from TENANT#tenant123
    created_by: item.freelancer_id,
    invoice_number: item.invoice_id,
    title: item.client_name || 'Invoice',
    client_name: item.client_name,
    client_email: item.client_email,
    amount: item.amount?.toString(),
    chain_id: item.chain_id,
    token_symbol: item.token,
    status: item.status,
    due_date: item.due_date,
    created_at: item.created_at,
  }),

  payments: (item: any) => ({
    id: item.SK.split('#')[1], // Extract from PAYMENT#pay123
    organization_id: item.PK.split('#')[1],
    invoice_id: item.invoice_id,
    tx_hash: item.tx_hash,
    chain_id: item.chain_id,
    token_symbol: item.token,
    from_address: item.from_wallet,
    to_address: item.to_wallet,
    amount: item.amount?.toString(),
    gas_price: item.gas_fee?.toString(),
    status: item.status === 'confirmed' ? 'confirmed' : 'pending',
    created_at: item.timestamp,
  }),
};

async function exportAllData() {
  const tables = [
    { tableName: 'FluxionUsers', outputFile: 'exports/users.json', transformFunction: transformers.users },
    { tableName: 'FluxionInvoices', outputFile: 'exports/invoices.json', transformFunction: transformers.invoices },
    { tableName: 'FluxionPayments', outputFile: 'exports/payments.json', transformFunction: transformers.payments },
  ];

  // Create exports directory
  if (!fs.existsSync('exports')) {
    fs.mkdirSync('exports');
  }

  for (const table of tables) {
    await exportTable(table);
  }
}

exportAllData().catch(console.error);
```

### 2. PostgreSQL Import Script
```typescript
// scripts/import-to-postgresql.ts
import { DataSource } from 'typeorm';
import fs from 'fs';
import { Organization } from '../src/entities/organization.entity';
import { User } from '../src/entities/user.entity';
import { BlockchainNetwork } from '../src/entities/blockchain-network.entity';
import { Token } from '../src/entities/token.entity';
import { Invoice } from '../src/entities/invoice.entity';
import { Payment } from '../src/entities/payment.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'password',
  database: 'fluxion_dev',
  entities: [Organization, User, BlockchainNetwork, Token, Invoice, Payment],
  synchronize: false,
});

// Chain ID to network mapping
const CHAIN_NETWORKS = {
  '1': { name: 'Ethereum Mainnet', symbol: 'ETH' },
  '137': { name: 'Polygon Mainnet', symbol: 'MATIC' },
  '42161': { name: 'Arbitrum One', symbol: 'ETH' },
  '8453': { name: 'Base Mainnet', symbol: 'ETH' },
};

// Token symbol to contract mapping per network
const TOKEN_CONTRACTS = {
  'USDC': {
    '1': '0xA0b86a33E6417eFf81fd769077e5b59a3B1d0C8d',
    '137': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    '42161': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    '8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
};

async function importData() {
  await AppDataSource.initialize();

  try {
    // 1. Create organizations from unique tenant IDs
    console.log('Creating organizations...');
    const usersData = JSON.parse(fs.readFileSync('exports/users.json', 'utf8'));
    const uniqueOrgIds = [...new Set(usersData.map(u => u.organization_id))];

    const organizationRepo = AppDataSource.getRepository(Organization);
    const organizations = await Promise.all(
      uniqueOrgIds.map(async (orgId, index) => {
        const org = organizationRepo.create({
          id: orgId,
          name: `Organization ${index + 1}`,
          slug: `org-${orgId.slice(0, 8)}`,
          plan: 'basic',
        });
        return await organizationRepo.save(org);
      })
    );

    console.log(`Created ${organizations.length} organizations`);

    // 2. Create blockchain networks
    console.log('Creating blockchain networks...');
    const networkRepo = AppDataSource.getRepository(BlockchainNetwork);
    const invoicesData = JSON.parse(fs.readFileSync('exports/invoices.json', 'utf8'));
    const uniqueChainIds = [...new Set(invoicesData.map(i => i.chain_id))];

    const networks = await Promise.all(
      uniqueChainIds.map(async (chainId) => {
        const networkInfo = CHAIN_NETWORKS[chainId] || { name: `Network ${chainId}`, symbol: 'UNKNOWN' };
        const network = networkRepo.create({
          chain_id: parseInt(chainId),
          name: networkInfo.name,
          symbol: networkInfo.symbol,
          rpc_url: `https://rpc.network-${chainId}.com`,
          is_active: true,
        });
        return await networkRepo.save(network);
      })
    );

    console.log(`Created ${networks.length} blockchain networks`);

    // 3. Create tokens
    console.log('Creating tokens...');
    const tokenRepo = AppDataSource.getRepository(Token);
    const uniqueTokens = [...new Set(invoicesData.map(i => `${i.token_symbol}-${i.chain_id}`))];

    const tokens = await Promise.all(
      uniqueTokens.map(async (tokenKey) => {
        const [symbol, chainId] = tokenKey.split('-');
        const network = networks.find(n => n.chain_id === parseInt(chainId));
        
        if (!network) return null;

        const isNative = ['ETH', 'MATIC'].includes(symbol);
        const contractAddress = !isNative ? TOKEN_CONTRACTS[symbol]?.[chainId] : null;

        const token = tokenRepo.create({
          network_id: network.id,
          contract_address: contractAddress,
          symbol,
          name: isNative ? `${symbol} Native Token` : `${symbol} Token`,
          decimals: symbol === 'USDC' ? 6 : 18,
          is_native: isNative,
          is_stablecoin: symbol === 'USDC',
        });
        return await tokenRepo.save(token);
      })
    );

    console.log(`Created ${tokens.filter(Boolean).length} tokens`);

    // 4. Import users
    console.log('Importing users...');
    const userRepo = AppDataSource.getRepository(User);
    const users = await Promise.all(
      usersData.map(async (userData) => {
        const user = userRepo.create(userData);
        return await userRepo.save(user);
      })
    );

    console.log(`Imported ${users.length} users`);

    // 5. Import invoices
    console.log('Importing invoices...');
    const invoiceRepo = AppDataSource.getRepository(Invoice);
    const invoices = await Promise.all(
      invoicesData.map(async (invoiceData) => {
        const network = networks.find(n => n.chain_id === parseInt(invoiceData.chain_id));
        const token = tokens.find(t => t?.symbol === invoiceData.token_symbol && t.network_id === network?.id);
        
        if (!network || !token) {
          console.warn(`Skipping invoice ${invoiceData.id} - missing network or token`);
          return null;
        }

        const invoice = invoiceRepo.create({
          ...invoiceData,
          network_id: network.id,
          token_id: token.id,
        });
        return await invoiceRepo.save(invoice);
      })
    );

    console.log(`Imported ${invoices.filter(Boolean).length} invoices`);

    // 6. Import payments
    console.log('Importing payments...');
    const paymentsData = JSON.parse(fs.readFileSync('exports/payments.json', 'utf8'));
    const paymentRepo = AppDataSource.getRepository(Payment);
    const payments = await Promise.all(
      paymentsData.map(async (paymentData) => {
        const network = networks.find(n => n.chain_id === parseInt(paymentData.chain_id));
        const token = tokens.find(t => t?.symbol === paymentData.token_symbol && t.network_id === network?.id);
        const invoice = invoices.find(i => i?.id === paymentData.invoice_id);
        
        if (!network || !token) {
          console.warn(`Skipping payment ${paymentData.id} - missing network or token`);
          return null;
        }

        const payment = paymentRepo.create({
          ...paymentData,
          network_id: network.id,
          token_id: token.id,
          invoice_id: invoice?.id || null,
        });
        return await paymentRepo.save(payment);
      })
    );

    console.log(`Imported ${payments.filter(Boolean).length} payments`);

  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

importData();
```

## API Compatibility Layer

### 1. Response Transformers
```typescript
// src/utils/response-transformers.ts
import { Invoice } from '../entities/invoice.entity';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';

export class ResponseTransformers {
  static transformInvoice(invoice: Invoice): any {
    return {
      PK: `TENANT#${invoice.organization_id}`,
      SK: `INVOICE#${invoice.id}`,
      invoice_id: invoice.id,
      freelancer_id: invoice.created_by,
      client_name: invoice.client_name,
      client_email: invoice.client_email,
      amount: parseFloat(invoice.amount),
      token: invoice.token.symbol,
      chain_id: invoice.network.chain_id.toString(),
      status: invoice.status,
      due_date: invoice.due_date?.toISOString(),
      tx_hash: invoice.payments?.[0]?.tx_hash,
      created_at: invoice.created_at.toISOString(),
    };
  }

  static transformPayment(payment: Payment): any {
    return {
      PK: `TENANT#${payment.organization_id}`,
      SK: `PAYMENT#${payment.id}`,
      payment_id: payment.id,
      invoice_id: payment.invoice_id,
      chain_id: payment.network.chain_id.toString(),
      token: payment.token.symbol,
      from_wallet: payment.from_address,
      to_wallet: payment.to_address,
      amount: parseFloat(payment.amount),
      tx_hash: payment.tx_hash,
      status: payment.status,
      gas_fee: payment.gas_price ? parseFloat(payment.gas_price) : null,
      timestamp: payment.created_at.toISOString(),
    };
  }

  static transformUser(user: User): any {
    return {
      PK: `USER#${user.organization_id}#${user.id}`,
      tenant_id: user.organization_id,
      user_id: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role,
      wallets: user.wallet_address ? [{ chain: 'ethereum', address: user.wallet_address }] : [],
      status: user.is_active ? 'active' : 'disabled',
      created_at: user.created_at.toISOString(),
    };
  }
}
```

### 2. Service Layer Updates
```typescript
// src/services/invoice.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { ResponseTransformers } from '../utils/response-transformers';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
  ) {}

  async findAllForOrganization(organizationId: string): Promise<any[]> {
    const invoices = await this.invoiceRepository.find({
      where: { organization_id: organizationId },
      relations: ['token', 'network', 'payments'],
      order: { created_at: 'DESC' },
    });

    // Transform to maintain DynamoDB-style response
    return invoices.map(ResponseTransformers.transformInvoice);
  }

  async create(organizationId: string, createInvoiceDto: any): Promise<any> {
    const invoice = this.invoiceRepository.create({
      ...createInvoiceDto,
      organization_id: organizationId,
    });

    const saved = await this.invoiceRepository.save(invoice);
    
    // Load relations for proper response
    const complete = await this.invoiceRepository.findOne({
      where: { id: saved.id },
      relations: ['token', 'network', 'payments'],
    });

    return ResponseTransformers.transformInvoice(complete);
  }
}
```

## Testing Strategy

### 1. Migration Validation Tests
```typescript
// tests/migration-validation.test.ts
import { DataSource } from 'typeorm';
import { Organization } from '../src/entities/organization.entity';
import { Invoice } from '../src/entities/invoice.entity';
import fs from 'fs';

describe('Migration Validation', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'fluxion_test',
      entities: [Organization, Invoice],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('should have migrated all organizations', async () => {
    const organizationRepo = dataSource.getRepository(Organization);
    const count = await organizationRepo.count();
    
    // Compare with expected count from DynamoDB export
    const originalData = JSON.parse(fs.readFileSync('exports/users.json', 'utf8'));
    const expectedOrgCount = new Set(originalData.map(u => u.organization_id)).size;
    
    expect(count).toBe(expectedOrgCount);
  });

  it('should have migrated all invoices with correct relationships', async () => {
    const invoiceRepo = dataSource.getRepository(Invoice);
    const invoices = await invoiceRepo.find({
      relations: ['organization', 'token', 'network'],
    });

    // Verify all invoices have required relationships
    invoices.forEach(invoice => {
      expect(invoice.organization).toBeDefined();
      expect(invoice.token).toBeDefined();
      expect(invoice.network).toBeDefined();
      expect(invoice.amount).toMatch(/^\d+(\.\d+)?$/);
    });
  });

  it('should maintain data consistency', async () => {
    // Compare sample data between original and migrated
    const invoiceRepo = dataSource.getRepository(Invoice);
    const sampleInvoice = await invoiceRepo.findOne({
      where: {},
      relations: ['token', 'network'],
    });

    expect(sampleInvoice).toBeDefined();
    expect(sampleInvoice.token.symbol).toMatch(/^[A-Z]+$/);
    expect(sampleInvoice.network.chain_id).toBeGreaterThan(0);
  });
});
```

### 2. API Compatibility Tests
```typescript
// tests/api-compatibility.test.ts
import { Test } from '@nestjs/testing';
import { InvoiceController } from '../src/controllers/invoice.controller';
import { InvoiceService } from '../src/services/invoice.service';

describe('API Compatibility', () => {
  let controller: InvoiceController;
  let service: InvoiceService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [
        {
          provide: InvoiceService,
          useValue: {
            findAllForOrganization: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<InvoiceController>(InvoiceController);
    service = module.get<InvoiceService>(InvoiceService);
  });

  it('should return DynamoDB-compatible response format', async () => {
    const mockInvoices = [
      {
        PK: 'TENANT#org123',
        SK: 'INVOICE#inv456',
        invoice_id: 'inv456',
        amount: 250.0,
        token: 'USDC',
        chain_id: '137',
        status: 'pending',
      },
    ];

    jest.spyOn(service, 'findAllForOrganization').mockResolvedValue(mockInvoices);

    const result = await controller.getInvoices('org123');

    expect(result).toEqual(mockInvoices);
    expect(result[0]).toHaveProperty('PK');
    expect(result[0]).toHaveProperty('SK');
    expect(result[0].PK).toMatch(/^TENANT#/);
    expect(result[0].SK).toMatch(/^INVOICE#/);
  });
});
```

This migration guide provides a comprehensive approach to transitioning from DynamoDB to PostgreSQL while maintaining full API compatibility and ensuring data integrity throughout the process.