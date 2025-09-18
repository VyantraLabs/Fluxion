"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbManager = exports.AppDataSource = void 0;
exports.setTenantContext = setTenantContext;
exports.clearTenantContext = clearTenantContext;
exports.setUserContext = setUserContext;
const typeorm_1 = require("typeorm");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
// Import entities
const Organization_1 = require("./entities/Organization");
const User_1 = require("./entities/User");
const BlockchainNetwork_1 = require("./entities/BlockchainNetwork");
const Token_1 = require("./entities/Token");
const SmartContract_1 = require("./entities/SmartContract");
const Invoice_1 = require("./entities/Invoice");
const Payment_1 = require("./entities/Payment");
const PayrollBatch_1 = require("./entities/PayrollBatch");
const PayrollRecipient_1 = require("./entities/PayrollRecipient");
const OrganizationSetting_1 = require("./entities/OrganizationSetting");
const AuditLog_1 = require("./entities/AuditLog");
// Production feature entities
const Template_1 = require("./entities/Template");
const TemplateCategory_1 = require("./entities/TemplateCategory");
const InvoiceAccessToken_1 = require("./entities/InvoiceAccessToken");
const NotificationQueue_1 = require("./entities/NotificationQueue");
const NotificationSettings_1 = require("./entities/NotificationSettings");
const PaymentVerificationJob_1 = require("./entities/PaymentVerificationJob");
const ReminderJob_1 = require("./entities/ReminderJob");
const SystemSettings_1 = require("./entities/SystemSettings");
// RBAC entities
const Role_1 = require("./entities/Role");
const Permission_1 = require("./entities/Permission");
const RolePermission_1 = require("./entities/RolePermission");
const UserRole_1 = require("./entities/UserRole");
const logger = new logger_1.Logger('DataSource');
/**
 * TypeORM Data Source Configuration
 * Handles PostgreSQL connection with multi-tenancy support
 */
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: config_1.config.database.host,
    port: config_1.config.database.port,
    username: config_1.config.database.username,
    password: config_1.config.database.password,
    database: config_1.config.database.database,
    ssl: config_1.config.database.ssl,
    // Connection pool settings
    extra: {
        max: config_1.config.database.pool.max,
        min: config_1.config.database.pool.min,
        idleTimeoutMillis: config_1.config.database.pool.idleTimeoutMillis,
        connectionTimeoutMillis: config_1.config.database.pool.connectionTimeoutMillis,
    },
    // Entity configuration
    entities: [
        Organization_1.Organization,
        User_1.User,
        BlockchainNetwork_1.BlockchainNetwork,
        Token_1.Token,
        SmartContract_1.SmartContract,
        Invoice_1.Invoice,
        Payment_1.Payment,
        PayrollBatch_1.PayrollBatch,
        PayrollRecipient_1.PayrollRecipient,
        OrganizationSetting_1.OrganizationSetting,
        AuditLog_1.AuditLog,
        // Production feature entities
        Template_1.Template,
        TemplateCategory_1.TemplateCategory,
        InvoiceAccessToken_1.InvoiceAccessToken,
        NotificationQueue_1.NotificationQueue,
        NotificationSettings_1.NotificationSettings,
        PaymentVerificationJob_1.PaymentVerificationJob,
        ReminderJob_1.ReminderJob,
        SystemSettings_1.SystemSettings,
        // RBAC entities
        Role_1.Role,
        Permission_1.Permission,
        RolePermission_1.RolePermission,
        UserRole_1.UserRole,
    ],
    // Migration configuration
    migrations: ['src/database/migrations/*.ts'],
    migrationsTableName: 'fluxion_migrations',
    // Development settings
    synchronize: false, // Disabled to use migrations instead
    logging: config_1.config.database.logging,
    logger: config_1.config.database.logging ? new (require('../shared/utils/typeorm-logger').CustomTypeOrmLogger)() : false,
    // Performance settings
    cache: config_1.config.features.enableRedisCache ? {
        type: 'ioredis',
        options: {
            host: config_1.config.redis.host,
            port: config_1.config.redis.port,
            password: config_1.config.redis.password,
            db: config_1.config.redis.cacheDb,
        },
        duration: 30000, // 30 seconds default cache
    } : false,
});
/**
 * Database connection manager with retry logic
 */
class DatabaseConnectionManager {
    constructor() {
        this.isConnected = false;
        this.connectionPromise = null;
    }
    static getInstance() {
        if (!DatabaseConnectionManager.instance) {
            DatabaseConnectionManager.instance = new DatabaseConnectionManager();
        }
        return DatabaseConnectionManager.instance;
    }
    async connect(retryCount = 0, maxRetries = 5) {
        if (this.isConnected) {
            return;
        }
        if (this.connectionPromise) {
            return this.connectionPromise;
        }
        this.connectionPromise = this.performConnection(retryCount, maxRetries);
        return this.connectionPromise;
    }
    async performConnection(retryCount, maxRetries) {
        try {
            logger.info('Connecting to PostgreSQL database...', {
                host: config_1.config.database.host,
                port: config_1.config.database.port,
                database: config_1.config.database.database,
                attempt: retryCount + 1,
            });
            if (!exports.AppDataSource.isInitialized) {
                await exports.AppDataSource.initialize();
            }
            // Set up multi-tenancy session variables
            await this.setupMultiTenancy();
            this.isConnected = true;
            this.connectionPromise = null;
            logger.info('PostgreSQL database connected successfully');
        }
        catch (error) {
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
            }
            else {
                logger.error('Failed to connect to database after all retries', {
                    error: error.message,
                    totalAttempts: maxRetries + 1,
                });
                throw error;
            }
        }
    }
    async setupMultiTenancy() {
        try {
            // Enable row-level security for all multi-tenant tables
            const queryRunner = exports.AppDataSource.createQueryRunner();
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
        }
        catch (error) {
            // Policies might already exist, which is fine
            if (!error.message.includes('already exists')) {
                logger.warn('Failed to set up multi-tenancy policies', { error: error.message });
            }
        }
    }
    async disconnect() {
        if (this.isConnected && exports.AppDataSource.isInitialized) {
            await exports.AppDataSource.destroy();
            this.isConnected = false;
            logger.info('Database disconnected');
        }
    }
    async healthCheck() {
        const startTime = Date.now();
        try {
            if (!this.isConnected) {
                throw new Error('Database not connected');
            }
            await exports.AppDataSource.query('SELECT 1');
            const latency = Date.now() - startTime;
            logger.debug('Database health check passed', { latency });
            return { status: 'healthy', latency };
        }
        catch (error) {
            const latency = Date.now() - startTime;
            logger.error('Database health check failed', { error: error.message, latency });
            return {
                status: 'unhealthy',
                latency,
                error: error.message
            };
        }
    }
    get isConnectedStatus() {
        return this.isConnected;
    }
}
// Export singleton instance
exports.dbManager = DatabaseConnectionManager.getInstance();
/**
 * Helper function to set tenant context for queries
 */
async function setTenantContext(tenantId) {
    try {
        // PostgreSQL SET LOCAL doesn't support parameterized queries
        // Validate that tenantId is a ULID or UUID to prevent SQL injection
        const ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!ulidRegex.test(tenantId) && !uuidRegex.test(tenantId)) {
            throw new Error('Invalid tenant ID format');
        }
        await exports.AppDataSource.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    }
    catch (error) {
        logger.error('Failed to set tenant context', { error: error.message, tenantId });
        throw error;
    }
}
/**
 * Helper function to clear tenant context
 */
async function clearTenantContext() {
    try {
        await exports.AppDataSource.query('SET LOCAL app.current_tenant_id = NULL');
    }
    catch (error) {
        logger.error('Failed to clear tenant context', { error: error.message });
        throw error;
    }
}
/**
 * Helper function to set user context for audit logging
 */
async function setUserContext(userId) {
    try {
        // PostgreSQL SET LOCAL doesn't support parameterized queries
        // Validate that userId is safe to prevent SQL injection
        if (!userId || typeof userId !== 'string' || userId.length > 100) {
            throw new Error('Invalid user ID format');
        }
        // Escape single quotes to prevent SQL injection
        const safeuserid = userId.replace(/'/g, "''");
        await exports.AppDataSource.query(`SET LOCAL app.current_user_id = '${safeuserid}'`);
    }
    catch (error) {
        logger.error('Failed to set user context', { error: error.message, userId });
        throw error;
    }
}
exports.default = exports.AppDataSource;
//# sourceMappingURL=data-source.js.map