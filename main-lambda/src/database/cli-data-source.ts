import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import * as path from 'path';

// Load environment variables
loadEnv({ path: path.resolve(process.cwd(), '.env') });

// Simple config for CLI usage
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

// Import entities with relative paths for CLI compatibility
import { Organization } from './entities/Organization';
import { User } from './entities/User';
import { BlockchainNetwork } from './entities/BlockchainNetwork';
import { Token } from './entities/Token';
import { SmartContract } from './entities/SmartContract';
import { Invoice } from './entities/Invoice';
import { Payment } from './entities/Payment';
import { PayrollBatch } from './entities/PayrollBatch';
import { PayrollRecipient } from './entities/PayrollRecipient';
import { OrganizationSetting } from './entities/OrganizationSetting';
import { AuditLog } from './entities/AuditLog';
// Production feature entities
import { Template } from './entities/Template';
import { TemplateCategory } from './entities/TemplateCategory';
import { InvoiceAccessToken } from './entities/InvoiceAccessToken';
import { NotificationQueue } from './entities/NotificationQueue';
import { NotificationSettings } from './entities/NotificationSettings';
import { PaymentVerificationJob } from './entities/PaymentVerificationJob';
import { ReminderJob } from './entities/ReminderJob';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || (isDevelopment ? 'localhost' : 'postgres'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || (isDevelopment ? 'postgres' : 'fluxion_app'),
  password: process.env.DB_PASSWORD || (isDevelopment ? 'password' : 'password'),
  database: process.env.DB_DATABASE || (isDevelopment ? 'fluxion_local' : 'fluxion_prod'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  
  entities: [
    Organization,
    User,
    BlockchainNetwork,
    Token,
    SmartContract,
    Invoice,
    Payment,
    PayrollBatch,
    PayrollRecipient,
    OrganizationSetting,
    AuditLog,
    // Production feature entities
    Template,
    TemplateCategory,
    InvoiceAccessToken,
    NotificationQueue,
    NotificationSettings,
    PaymentVerificationJob,
    ReminderJob,
  ],
  
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'fluxion_migrations',
  
  synchronize: false, // Never use synchronize in CLI
  logging: process.env.DB_LOGGING === 'true' || isDevelopment,
  logger: 'advanced-console',
});

export default dataSource;