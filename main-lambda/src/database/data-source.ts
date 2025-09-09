import { DataSource } from 'typeorm';
import { config } from '@/config';
import { Logger } from '@/shared/utils/logger';

// Import entities
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

const logger = new Logger('DataSource');

/**
 * TypeORM Data Source Configuration
 * Handles PostgreSQL connection with multi-tenancy support
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  ssl: config.database.ssl,
  
  // Connection pool settings
  extra: {
    max: config.database.pool.max,
    min: config.database.pool.min,
    idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
    connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
  },
  
  // Entity configuration
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
  
  // Migration configuration
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'fluxion_migrations',
  
  // Development settings
  synchronize: false, // Disabled to use migrations instead
  logging: config.database.logging,
  logger: config.database.logging ? new (require('../shared/utils/typeorm-logger').CustomTypeOrmLogger)() : false,
  
  // Performance settings
  cache: config.features.enableRedisCache ? {
    type: 'ioredis',
    options: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.cacheDb,
    },
    duration: 30000, // 30 seconds default cache
  } : false,
});

/**
 * Database connection manager with retry logic
 */
class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  async connect(retryCount = 0, maxRetries = 5): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.performConnection(retryCount, maxRetries);
    return this.connectionPromise;
  }

  private async performConnection(retryCount: number, maxRetries: number): Promise<void> {
    try {
      logger.info('Connecting to PostgreSQL database...', {
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
        attempt: retryCount + 1,
      });

      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      // Set up multi-tenancy session variables
      await this.setupMultiTenancy();

      this.isConnected = true;
      this.connectionPromise = null;
      
      logger.info('PostgreSQL database connected successfully');
    } catch (error: any) {
      this.connectionPromise = null;
      
      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
        
        logger.warn('Database connection failed, retrying...', {
          error: error.message,
          retryIn: delay,
          attempt: retryCount + 1,
          maxRetries: maxRetries + 1,
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect(retryCount + 1, maxRetries);
      } else {
        logger.error('Failed to connect to database after all retries', {
          error: error.message,
          totalAttempts: maxRetries + 1,
        });
        throw error;
      }
    }
  }

  private async setupMultiTenancy(): Promise<void> {
    try {
      // Enable row-level security for all multi-tenant tables
      const queryRunner = AppDataSource.createQueryRunner();
      
      const multiTenantTables = [
        'users',
        'invoices', 
        'payments',
        'payroll_batches',
        'payroll_recipients',
        'organization_settings',
        'audit_logs',
        'invoice_templates',
        'notification_queue',
        'notification_settings',
        'reminder_jobs',
      ];

      for (const tableName of multiTenantTables) {
        // Enable RLS
        await queryRunner.query(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`);
        
        // Create policy for tenant isolation
        await queryRunner.query(`
          CREATE POLICY IF NOT EXISTS tenant_isolation_${tableName} ON ${tableName}
          USING (organization_id = current_setting('app.current_tenant_id', true)::uuid)
        `);
      }
      
      await queryRunner.release();
      
      logger.debug('Multi-tenancy row-level security policies configured');
    } catch (error: any) {
      // Policies might already exist, which is fine
      if (!error.message.includes('already exists')) {
        logger.warn('Failed to set up multi-tenancy policies', { error: error.message });
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected && AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      this.isConnected = false;
      logger.info('Database disconnected');
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected');
      }

      await AppDataSource.query('SELECT 1');
      
      const latency = Date.now() - startTime;
      
      logger.debug('Database health check passed', { latency });
      return { status: 'healthy', latency };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      logger.error('Database health check failed', { error: error.message, latency });
      return { 
        status: 'unhealthy', 
        latency,
        error: error.message 
      };
    }
  }

  get isConnectedStatus(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const dbManager = DatabaseConnectionManager.getInstance();

/**
 * Helper function to set tenant context for queries
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  try {
    // PostgreSQL SET LOCAL doesn't support parameterized queries
    // Validate that tenantId is a ULID or UUID to prevent SQL injection
    const ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!ulidRegex.test(tenantId) && !uuidRegex.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }
    
    await AppDataSource.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
  } catch (error: any) {
    logger.error('Failed to set tenant context', { error: error.message, tenantId });
    throw error;
  }
}

/**
 * Helper function to clear tenant context
 */
export async function clearTenantContext(): Promise<void> {
  try {
    await AppDataSource.query('SET LOCAL app.current_tenant_id = NULL');
  } catch (error: any) {
    logger.error('Failed to clear tenant context', { error: error.message });
    throw error;
  }
}

/**
 * Helper function to set user context for audit logging
 */
export async function setUserContext(userId: string): Promise<void> {
  try {
    // PostgreSQL SET LOCAL doesn't support parameterized queries
    // Validate that userId is safe to prevent SQL injection
    if (!userId || typeof userId !== 'string' || userId.length > 100) {
      throw new Error('Invalid user ID format');
    }
    
    // Escape single quotes to prevent SQL injection
    const safeuserid = userId.replace(/'/g, "''");
    await AppDataSource.query(`SET LOCAL app.current_user_id = '${safeuserid}'`);
  } catch (error: any) {
    logger.error('Failed to set user context', { error: error.message, userId });
    throw error;
  }
}

export default AppDataSource;