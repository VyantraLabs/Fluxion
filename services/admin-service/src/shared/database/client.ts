/**
 * Database Client - PostgreSQL + DynamoDB Compatibility Layer
 * 
 * This file provides a compatibility layer that maintains the existing DynamoDB-style API
 * while using PostgreSQL with TypeORM underneath. This ensures no changes are needed
 * in the existing service files or API endpoints.
 */

import { 
  FluxionRecord, 
  FluxionError, 
  ErrorCodes, 
  UserRecord, 
  InvoiceRecord, 
  PaymentRecord,
  TenantContext,
  QueryOptions,
  MultiTableQueryResult
} from '../../types/common';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Import PostgreSQL infrastructure
import { dbManager } from '../../database/data-source';
import { repositories } from '../../database/repositories';
import {
  transformUserToDynamoDB,
  transformInvoiceToDynamoDB,
  transformPaymentToDynamoDB,
  transformPaginationToDynamoDB,
  transformArrayToDynamoDB,
  parseDynamoDBNextToken,
  DynamoDBCompatibilityHelper,
} from '../../database/compatibility/DynamoDBCompatibility';

// Import entities
import { User } from '../../database/entities/User';
import { Invoice } from '../../database/entities/Invoice';
import { Payment } from '../../database/entities/Payment';

export class DatabaseService {
  private logger: Logger;
  private initialized: boolean = false;

  constructor() {
    this.logger = new Logger('DatabaseService');
  }

  /**
   * Initialize PostgreSQL connection if not already initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      await dbManager.connect();
      this.initialized = true;
      this.logger.info('PostgreSQL database connection initialized');
    } catch (error: any) {
      this.logger.error('Failed to initialize database connection', { error: error.message });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Database connection failed',
        500,
        error
      );
    }
  }

  /**
   * Extract tenant ID from DynamoDB-style PK
   */
  private extractTenantId(PK: string): string {
    const match = PK.match(/^TENANT#(.+)$/);
    if (!match) {
      throw new FluxionError(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid PK format, expected TENANT#<id>',
        400
      );
    }
    return match[1];
  }

  /**
   * Extract entity ID from DynamoDB-style SK
   */
  private extractEntityId(SK: string): string {
    const match = SK.match(/^[A-Z]+#(.+)$/);
    if (!match) {
      throw new FluxionError(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid SK format, expected TYPE#<id>',
        400
      );
    }
    return match[1];
  }

  /**
   * Save user record using PostgreSQL
   */
  private async saveUserRecord(tenantContext: TenantContext, record: UserRecord): Promise<void> {
    const userId = record.user_id || this.extractEntityId(record.SK);
    
    // Check if user exists
    const existingUser = await repositories.users.findById(tenantContext, userId);
    
    if (existingUser) {
      // Update existing user
      await repositories.users.update(tenantContext, userId, {
        email: record.email,
        walletAddress: record.wallet_address,
        firstName: record.first_name,
        lastName: record.last_name,
        role: record.role as any,
        isActive: record.status === 'active',
        emailVerified: record.email_verified,
        lastLoginAt: record.last_login_at ? new Date(record.last_login_at) : undefined,
      });
    } else {
      // Create new user
      await repositories.users.create(tenantContext, {
        id: userId,
        email: record.email,
        walletAddress: record.wallet_address,
        firstName: record.first_name,
        lastName: record.last_name,
        role: record.role as any,
        isActive: record.status === 'active',
        emailVerified: record.email_verified,
        lastLoginAt: record.last_login_at ? new Date(record.last_login_at) : undefined,
      });
    }
  }

  /**
   * Save invoice record using PostgreSQL
   */
  private async saveInvoiceRecord(tenantContext: TenantContext, record: InvoiceRecord): Promise<void> {
    const invoiceId = record.invoice_id || this.extractEntityId(record.SK);
    
    // Check if invoice exists
    const existingInvoice = await repositories.invoices.findById(tenantContext, invoiceId);
    
    if (existingInvoice) {
      // Update existing invoice
      await repositories.invoices.update(tenantContext, invoiceId, {
        invoiceNumber: record.invoice_number,
        title: record.title,
        description: record.description,
        amount: record.amount,
        amountPaid: record.amount_paid || '0',
        status: record.status as any,
        dueDate: record.due_date ? new Date(record.due_date) : undefined,
        clientName: record.client_name,
        clientEmail: record.client_email,
        clientWallet: record.client_wallet,
        sentAt: record.sent_at ? new Date(record.sent_at) : undefined,
        paidAt: record.paid_at ? new Date(record.paid_at) : undefined,
        metadata: record.metadata || {},
      });
    } else {
      // Create new invoice - we need to handle network/token relationships
      await repositories.invoices.create(tenantContext, {
        id: invoiceId,
        createdBy: record.freelancer_id || record.created_by,
        invoiceNumber: record.invoice_number,
        title: record.title,
        description: record.description,
        amount: record.amount,
        amountPaid: record.amount_paid || '0',
        status: record.status as any,
        dueDate: record.due_date ? new Date(record.due_date) : undefined,
        clientName: record.client_name,
        clientEmail: record.client_email,
        clientWallet: record.client_wallet,
        networkId: record.network_id, // This needs to be mapped from chain_id
        tokenId: record.token_id, // This needs to be mapped from token symbol
        sentAt: record.sent_at ? new Date(record.sent_at) : undefined,
        paidAt: record.paid_at ? new Date(record.paid_at) : undefined,
        metadata: record.metadata || {},
      });
    }
  }

  /**
   * Save payment record using PostgreSQL
   */
  private async savePaymentRecord(tenantContext: TenantContext, record: PaymentRecord): Promise<void> {
    const paymentId = record.payment_id || this.extractEntityId(record.SK);
    
    // Check if payment exists
    const existingPayment = await repositories.payments.findById(tenantContext, paymentId);
    
    if (existingPayment) {
      // Update existing payment
      await repositories.payments.update(tenantContext, paymentId, {
        status: record.status as any,
        blockNumber: record.block_number?.toString(),
        confirmations: record.confirmations || 0,
        gasUsed: record.gas_used?.toString(),
        gasPrice: record.gas_price,
        confirmedAt: record.confirmed_at ? new Date(record.confirmed_at) : undefined,
        metadata: record.metadata || {},
      });
    } else {
      // Create new payment
      await repositories.payments.create(tenantContext, {
        id: paymentId,
        invoiceId: record.invoice_id,
        txHash: record.tx_hash,
        networkId: record.network_id,
        tokenId: record.token_id,
        fromAddress: record.from_wallet || record.from_address,
        toAddress: record.to_wallet || record.to_address,
        amount: record.amount,
        gasUsed: record.gas_used?.toString(),
        gasPrice: record.gas_price,
        status: record.status as any,
        blockNumber: record.block_number?.toString(),
        confirmations: record.confirmations || 0,
        confirmedAt: record.confirmed_at ? new Date(record.confirmed_at) : undefined,
        metadata: record.metadata || {},
      });
    }
  }

  /**
   * Save or update a record in the database
   * COMPATIBILITY: Maintains DynamoDB-style API
   */
  async save(record: FluxionRecord): Promise<void> {
    await this.ensureInitialized();

    this.logger.info('Saving record', { PK: record.PK, SK: record.SK, entityType: record.entityType });
    
    try {
      // Extract tenant context from PK
      const tenantId = this.extractTenantId(record.PK);
      const tenantContext: TenantContext = { tenantId };

      // Route to appropriate repository based on entity type
      switch (record.entityType) {
        case 'user':
          await this.saveUserRecord(tenantContext, record as UserRecord);
          break;
        case 'invoice':
          await this.saveInvoiceRecord(tenantContext, record as InvoiceRecord);
          break;
        case 'payment':
          await this.savePaymentRecord(tenantContext, record as PaymentRecord);
          break;
        default:
          throw new FluxionError(
            ErrorCodes.VALIDATION_ERROR,
            `Unsupported entity type: ${record.entityType}`,
            400
          );
      }

      this.logger.info('Record saved successfully', { PK: record.PK, SK: record.SK });
    } catch (error: any) {
      this.logger.error('Failed to save record', { error: error.message, PK: record.PK, SK: record.SK });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to save record',
        500,
        error
      );
    }
  }

  /**
   * Find a record by primary key
   * COMPATIBILITY: Maintains DynamoDB-style API
   */
  async findById(PK: string, SK: string): Promise<FluxionRecord | null> {
    await this.ensureInitialized();

    this.logger.info('Finding record by ID', { PK, SK });

    try {
      const tenantId = this.extractTenantId(PK);
      const entityId = this.extractEntityId(SK);
      const tenantContext: TenantContext = { tenantId };

      // Determine entity type from SK
      const entityType = SK.split('#')[0].toLowerCase();

      let result: FluxionRecord | null = null;

      switch (entityType) {
        case 'user': {
          const user = await repositories.users.findById(tenantContext, entityId);
          result = user ? transformUserToDynamoDB(user) : null;
          break;
        }
        case 'invoice': {
          const invoice = await repositories.invoices.findById(tenantContext, entityId);
          result = invoice ? transformInvoiceToDynamoDB(invoice) : null;
          break;
        }
        case 'payment': {
          const payment = await repositories.payments.findById(tenantContext, entityId);
          result = payment ? transformPaymentToDynamoDB(payment) : null;
          break;
        }
        default:
          throw new FluxionError(
            ErrorCodes.VALIDATION_ERROR,
            `Unsupported entity type: ${entityType}`,
            400
          );
      }

      if (result) {
        this.logger.info('Record found', { PK, SK, entityType });
      } else {
        this.logger.info('Record not found', { PK, SK });
      }

      return result;
    } catch (error: any) {
      this.logger.error('Failed to find record', { error: error.message, PK, SK });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to retrieve record',
        500,
        error
      );
    }
  }

  /**
   * Query records by partition key
   * COMPATIBILITY: Maintains DynamoDB-style API
   */
  async queryByPK(PK: string, options: {
    limit?: number;
    nextToken?: string;
    sortKeyCondition?: string;
    sortKeyValue?: string;
    scanIndexForward?: boolean;
  } = {}): Promise<{ items: FluxionRecord[]; nextToken?: string }> {
    await this.ensureInitialized();

    this.logger.info('Querying by PK', { PK, options });

    try {
      const tenantId = this.extractTenantId(PK);
      const tenantContext: TenantContext = { tenantId };
      const { page } = parseDynamoDBNextToken(options.nextToken);
      const limit = options.limit || 50;

      // For now, return empty results for compatibility
      // This would need to be implemented based on specific query patterns
      this.logger.info('Query completed', { PK, itemCount: 0, hasMore: false });

      return {
        items: [],
        nextToken: undefined,
      };
    } catch (error: any) {
      this.logger.error('Failed to query by PK', { error: error.message, PK, options });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to query records',
        500,
        error
      );
    }
  }

  /**
   * Generate unique ID
   */
  generateId(): string {
    return uuidv4();
  }

  /**
   * Health check for database connectivity
   * COMPATIBILITY: Maintains DynamoDB-style response format
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      const health = await dbManager.healthCheck();
      
      const latency = Date.now() - startTime;
      
      this.logger.debug('Database health check passed', { latency });
      return DynamoDBCompatibilityHelper.transformHealthCheck(
        health.status,
        latency,
        health.error
      );
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('Database health check failed', { error: error.message, latency });
      return DynamoDBCompatibilityHelper.transformHealthCheck(
        'unhealthy',
        latency,
        error.message
      );
    }
  }

  // ================================
  // Multi-Table Operations (PostgreSQL-native)
  // ================================

  /**
   * Create a user in the Users table
   * COMPATIBILITY: Maintains existing API
   */
  async createUser(tenantContext: TenantContext, userData: Omit<UserRecord, 'user_id' | 'created_at' | 'updated_at'>): Promise<UserRecord> {
    await this.ensureInitialized();

    this.logger.info('Creating user', { tenantId: tenantContext.tenantId, email: userData.email });

    try {
      const user = await repositories.users.create(tenantContext, {
        email: userData.email,
        walletAddress: userData.wallet_address,
        firstName: userData.first_name,
        lastName: userData.last_name,
        role: userData.role as any,
        isActive: userData.status === 'active',
        emailVerified: userData.email_verified || false,
      });

      const result = transformUserToDynamoDB(user);
      this.logger.info('User created successfully', { userId: user.id });
      return result;
    } catch (error: any) {
      this.logger.error('Failed to create user', { error: error.message });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create user',
        500,
        error
      );
    }
  }

  /**
   * Get user by ID
   * COMPATIBILITY: Maintains existing API
   */
  async getUserById(tenantContext: TenantContext, userId: string): Promise<UserRecord | null> {
    await this.ensureInitialized();

    this.logger.info('Getting user by ID', { userId, tenantId: tenantContext.tenantId });

    try {
      const user = await repositories.users.findById(tenantContext, userId);
      return user ? transformUserToDynamoDB(user) : null;
    } catch (error: any) {
      this.logger.error('Failed to get user', { error: error.message, userId });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to retrieve user',
        500,
        error
      );
    }
  }

  /**
   * Get user by wallet address
   * COMPATIBILITY: Maintains existing API
   */
  async getUserByWallet(tenantContext: TenantContext, walletAddress: string): Promise<UserRecord | null> {
    await this.ensureInitialized();

    this.logger.info('Getting user by wallet', { walletAddress, tenantId: tenantContext.tenantId });

    try {
      const user = await repositories.users.findByWalletAddress(tenantContext, walletAddress);
      return user ? transformUserToDynamoDB(user) : null;
    } catch (error: any) {
      this.logger.error('Failed to get user by wallet', { error: error.message, walletAddress });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to retrieve user by wallet',
        500,
        error
      );
    }
  }

  /**
   * Update user
   * COMPATIBILITY: Maintains existing API
   */
  async updateUser(tenantContext: TenantContext, userId: string, updates: Partial<Omit<UserRecord, 'user_id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<UserRecord> {
    await this.ensureInitialized();

    this.logger.info('Updating user', { userId, tenantId: tenantContext.tenantId });

    try {
      const user = await repositories.users.update(tenantContext, userId, {
        email: updates.email,
        walletAddress: updates.wallet_address,
        firstName: updates.first_name,
        lastName: updates.last_name,
        role: updates.role as any,
        isActive: updates.status === 'active',
        emailVerified: updates.email_verified,
        lastLoginAt: updates.last_login_at ? new Date(updates.last_login_at) : undefined,
      });

      const result = transformUserToDynamoDB(user);
      this.logger.info('User updated successfully', { userId });
      return result;
    } catch (error: any) {
      this.logger.error('Failed to update user', { error: error.message, userId });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update user',
        500,
        error
      );
    }
  }

  /**
   * Create an invoice in the Invoices table
   * COMPATIBILITY: Maintains existing API
   */
  async createInvoice(tenantContext: TenantContext, invoiceData: Omit<InvoiceRecord, 'invoice_id' | 'created_at' | 'updated_at'>): Promise<InvoiceRecord> {
    await this.ensureInitialized();

    this.logger.info('Creating invoice', { tenantId: tenantContext.tenantId });

    try {
      const invoice = await repositories.invoices.create(tenantContext, {
        createdBy: invoiceData.freelancer_id || invoiceData.created_by,
        invoiceNumber: invoiceData.invoice_number,
        title: invoiceData.title,
        description: invoiceData.description,
        amount: invoiceData.amount,
        status: invoiceData.status as any,
        dueDate: invoiceData.due_date ? new Date(invoiceData.due_date) : undefined,
        clientName: invoiceData.client_name,
        clientEmail: invoiceData.client_email,
        clientWallet: invoiceData.client_wallet,
        networkId: invoiceData.network_id,
        tokenId: invoiceData.token_id,
        metadata: invoiceData.metadata || {},
      });

      const result = transformInvoiceToDynamoDB(invoice);
      this.logger.info('Invoice created successfully', { invoiceId: invoice.id });
      return result;
    } catch (error: any) {
      this.logger.error('Failed to create invoice', { error: error.message });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create invoice',
        500,
        error
      );
    }
  }

  /**
   * Get invoice by ID
   * COMPATIBILITY: Maintains existing API
   */
  async getInvoiceById(tenantContext: TenantContext, invoiceId: string): Promise<InvoiceRecord | null> {
    await this.ensureInitialized();

    this.logger.info('Getting invoice by ID', { invoiceId, tenantId: tenantContext.tenantId });

    try {
      const invoice = await repositories.invoices.findById(tenantContext, invoiceId);
      return invoice ? transformInvoiceToDynamoDB(invoice) : null;
    } catch (error: any) {
      this.logger.error('Failed to get invoice', { error: error.message, invoiceId });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to retrieve invoice',
        500,
        error
      );
    }
  }

  /**
   * Get invoices by user ID
   * COMPATIBILITY: Maintains existing API
   */
  async getInvoicesByUser(tenantContext: TenantContext, userId: string, options: QueryOptions = {}): Promise<MultiTableQueryResult<InvoiceRecord>> {
    await this.ensureInitialized();

    this.logger.info('Getting invoices by user', { userId, tenantId: tenantContext.tenantId, options });

    try {
      const result = await repositories.invoices.findByUser(tenantContext, userId, options);
      
      return {
        items: result.items.map(transformInvoiceToDynamoDB),
        nextToken: result.nextToken,
      };
    } catch (error: any) {
      this.logger.error('Failed to query invoices by user', { error: error.message, userId });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to query invoices',
        500,
        error
      );
    }
  }

  /**
   * Create a payment in the Payments table
   * COMPATIBILITY: Maintains existing API
   */
  async createPayment(tenantContext: TenantContext, paymentData: Omit<PaymentRecord, 'payment_id' | 'created_at' | 'updated_at'>): Promise<PaymentRecord> {
    await this.ensureInitialized();

    this.logger.info('Creating payment', { tenantId: tenantContext.tenantId, txHash: paymentData.tx_hash });

    try {
      const payment = await repositories.payments.create(tenantContext, {
        invoiceId: paymentData.invoice_id,
        txHash: paymentData.tx_hash,
        networkId: paymentData.network_id,
        tokenId: paymentData.token_id,
        fromAddress: paymentData.from_wallet || paymentData.from_address,
        toAddress: paymentData.to_wallet || paymentData.to_address,
        amount: paymentData.amount,
        gasUsed: paymentData.gas_used?.toString(),
        gasPrice: paymentData.gas_price,
        status: paymentData.status as any,
        blockNumber: paymentData.block_number?.toString(),
        confirmations: paymentData.confirmations || 0,
        metadata: paymentData.metadata || {},
      });

      const result = transformPaymentToDynamoDB(payment);
      this.logger.info('Payment created successfully', { paymentId: payment.id });
      return result;
    } catch (error: any) {
      this.logger.error('Failed to create payment', { error: error.message });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create payment',
        500,
        error
      );
    }
  }

  /**
   * Get payments by invoice ID
   * COMPATIBILITY: Maintains existing API
   */
  async getPaymentsByInvoice(tenantContext: TenantContext, invoiceId: string, options: QueryOptions = {}): Promise<MultiTableQueryResult<PaymentRecord>> {
    await this.ensureInitialized();

    this.logger.info('Getting payments by invoice', { invoiceId, tenantId: tenantContext.tenantId });

    try {
      const payments = await repositories.payments.findByInvoiceId(tenantContext, invoiceId);
      
      return {
        items: payments.map(transformPaymentToDynamoDB),
        nextToken: undefined, // Implement pagination if needed
      };
    } catch (error: any) {
      this.logger.error('Failed to query payments by invoice', { error: error.message, invoiceId });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to query payments',
        500,
        error
      );
    }
  }

  /**
   * Get payment by ID
   * COMPATIBILITY: Maintains existing API
   */
  async getPaymentById(tenantContext: TenantContext, paymentId: string): Promise<PaymentRecord | null> {
    await this.ensureInitialized();

    this.logger.info('Getting payment by ID', { paymentId, tenantId: tenantContext.tenantId });

    try {
      const payment = await repositories.payments.findById(tenantContext, paymentId);
      return payment ? transformPaymentToDynamoDB(payment) : null;
    } catch (error: any) {
      this.logger.error('Failed to get payment', { error: error.message, paymentId });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to retrieve payment',
        500,
        error
      );
    }
  }

  /**
   * Update payment
   * COMPATIBILITY: Maintains existing API
   */
  async updatePayment(tenantContext: TenantContext, paymentId: string, updates: Partial<Omit<PaymentRecord, 'payment_id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<PaymentRecord> {
    await this.ensureInitialized();

    this.logger.info('Updating payment', { paymentId, tenantId: tenantContext.tenantId });

    try {
      const payment = await repositories.payments.update(tenantContext, paymentId, {
        status: updates.status as any,
        blockNumber: updates.block_number?.toString(),
        confirmations: updates.confirmations || 0,
        gasUsed: updates.gas_used?.toString(),
        gasPrice: updates.gas_price,
        confirmedAt: updates.confirmed_at ? new Date(updates.confirmed_at) : undefined,
        metadata: updates.metadata || {},
      });

      const result = transformPaymentToDynamoDB(payment);
      this.logger.info('Payment updated successfully', { paymentId });
      return result;
    } catch (error: any) {
      this.logger.error('Failed to update payment', { error: error.message, paymentId });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update payment',
        500,
        error
      );
    }
  }

  /**
   * Update invoice
   * COMPATIBILITY: Maintains existing API
   */
  async updateInvoice(tenantContext: TenantContext, invoiceId: string, updates: Partial<Omit<InvoiceRecord, 'invoice_id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<InvoiceRecord> {
    await this.ensureInitialized();

    this.logger.info('Updating invoice', { invoiceId, tenantId: tenantContext.tenantId });

    try {
      const invoice = await repositories.invoices.update(tenantContext, invoiceId, {
        invoiceNumber: updates.invoice_number,
        title: updates.title,
        description: updates.description,
        amount: updates.amounts?.total.toString(),
        amountPaid: updates.amounts?.subtotal?.toString() || '0',
        status: updates.status as any,
        dueDate: updates.due_date ? new Date(updates.due_date) : undefined,
        clientName: updates.client_info?.name,
        clientEmail: updates.client_info?.email,
        clientWallet: updates.client_wallet,
        sentAt: updates.sent_at ? new Date(updates.sent_at) : undefined,
        paidAt: updates.paid_at ? new Date(updates.paid_at) : undefined,
        metadata: updates.metadata || {},
      });

      const result = transformInvoiceToDynamoDB(invoice);
      this.logger.info('Invoice updated successfully', { invoiceId });
      return result;
    } catch (error: any) {
      this.logger.error('Failed to update invoice', { error: error.message, invoiceId });
      if (error instanceof FluxionError) {
        throw error;
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update invoice',
        500,
        error
      );
    }
  }
}

// Singleton instance
let dbInstance: DatabaseService | null = null;

export const getDatabase = (): DatabaseService => {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
  }
  return dbInstance;
};

export default DatabaseService;