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
} from '@/types/common';
import { Logger } from '@/shared/utils/logger';
import { config } from '@/config';
import { v4 as uuidv4 } from 'uuid';

// Import PostgreSQL infrastructure
import { dbManager } from '@/database/data-source';
import { repositories } from '@/database/repositories';
import {
  transformUserToDynamoDB,
  transformInvoiceToDynamoDB,
  transformPaymentToDynamoDB,
  transformPaginationToDynamoDB,
  transformArrayToDynamoDB,
  parseDynamoDBNextToken,
  DynamoDBCompatibilityHelper,
} from '@/database/compatibility/DynamoDBCompatibility';

// Import entities
import { User } from '@/database/entities/User';
import { Invoice } from '@/database/entities/Invoice';
import { Payment } from '@/database/entities/Payment';
import { Organization } from '@/database/entities/Organization';

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
   */
  async findById(PK: string, SK: string): Promise<FluxionRecord | null> {
    const params: GetCommandInput = {
      TableName: this.tableName,
      Key: { PK, SK }
    };

    this.logger.info('Finding record by ID', { PK, SK });

    try {
      const result = await this.client.send(new GetCommand(params));
      
      if (!result.Item) {
        this.logger.info('Record not found', { PK, SK });
        return null;
      }

      this.logger.info('Record found', { PK, SK, entityType: result.Item.entityType });
      return result.Item as FluxionRecord;
    } catch (error: any) {
      this.logger.error('Failed to find record', { error: error.message, PK, SK });
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
   */
  async queryByPK(PK: string, options: {
    limit?: number;
    nextToken?: string;
    sortKeyCondition?: string;
    sortKeyValue?: string;
    scanIndexForward?: boolean;
  } = {}): Promise<{ items: FluxionRecord[]; nextToken?: string }> {
    let keyConditionExpression = 'PK = :pk';
    const expressionAttributeValues: Record<string, any> = { ':pk': PK };

    if (options.sortKeyCondition && options.sortKeyValue) {
      keyConditionExpression += ` AND SK ${options.sortKeyCondition} :sk`;
      expressionAttributeValues[':sk'] = options.sortKeyValue;
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: options.limit || 50,
      ScanIndexForward: options.scanIndexForward !== false
    };

    if (options.nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(options.nextToken, 'base64').toString());
    }

    this.logger.info('Querying by PK', { PK, options });

    try {
      const result = await this.client.send(new QueryCommand(params));
      
      const nextToken = result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined;

      this.logger.info('Query completed', { 
        PK, 
        itemCount: result.Items?.length || 0, 
        hasMore: !!nextToken 
      });

      return {
        items: (result.Items || []) as FluxionRecord[],
        nextToken
      };
    } catch (error: any) {
      this.logger.error('Failed to query by PK', { error: error.message, PK, options });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to query records',
        500,
        error
      );
    }
  }

  /**
   * Query records using GSI1
   */
  async queryGSI1(GSI1PK: string, options: {
    GSI1SK?: string;
    sortKeyCondition?: string;
    limit?: number;
    nextToken?: string;
    scanIndexForward?: boolean;
  } = {}): Promise<{ items: FluxionRecord[]; nextToken?: string }> {
    let keyConditionExpression = 'GSI1PK = :gsi1pk';
    const expressionAttributeValues: Record<string, any> = { ':gsi1pk': GSI1PK };

    if (options.GSI1SK && options.sortKeyCondition) {
      keyConditionExpression += ` AND GSI1SK ${options.sortKeyCondition} :gsi1sk`;
      expressionAttributeValues[':gsi1sk'] = options.GSI1SK;
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: options.limit || 50,
      ScanIndexForward: options.scanIndexForward !== false
    };

    if (options.nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(options.nextToken, 'base64').toString());
    }

    this.logger.info('Querying GSI1', { GSI1PK, options });

    try {
      const result = await this.client.send(new QueryCommand(params));
      
      const nextToken = result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined;

      this.logger.info('GSI1 query completed', { 
        GSI1PK, 
        itemCount: result.Items?.length || 0, 
        hasMore: !!nextToken 
      });

      return {
        items: (result.Items || []) as FluxionRecord[],
        nextToken
      };
    } catch (error: any) {
      this.logger.error('Failed to query GSI1', { error: error.message, GSI1PK, options });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to query GSI1',
        500,
        error
      );
    }
  }

  /**
   * Query records using GSI2
   */
  async queryGSI2(GSI2PK: string, options: {
    GSI2SK?: string;
    sortKeyCondition?: string;
    limit?: number;
    nextToken?: string;
    scanIndexForward?: boolean;
  } = {}): Promise<{ items: FluxionRecord[]; nextToken?: string }> {
    let keyConditionExpression = 'GSI2PK = :gsi2pk';
    const expressionAttributeValues: Record<string, any> = { ':gsi2pk': GSI2PK };

    if (options.GSI2SK && options.sortKeyCondition) {
      keyConditionExpression += ` AND GSI2SK ${options.sortKeyCondition} :gsi2sk`;
      expressionAttributeValues[':gsi2sk'] = options.GSI2SK;
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: options.limit || 50,
      ScanIndexForward: options.scanIndexForward !== false
    };

    if (options.nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(options.nextToken, 'base64').toString());
    }

    this.logger.info('Querying GSI2', { GSI2PK, options });

    try {
      const result = await this.client.send(new QueryCommand(params));
      
      const nextToken = result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined;

      this.logger.info('GSI2 query completed', { 
        GSI2PK, 
        itemCount: result.Items?.length || 0, 
        hasMore: !!nextToken 
      });

      return {
        items: (result.Items || []) as FluxionRecord[],
        nextToken
      };
    } catch (error: any) {
      this.logger.error('Failed to query GSI2', { error: error.message, GSI2PK, options });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to query GSI2',
        500,
        error
      );
    }
  }

  /**
   * Update a record
   */
  async update(
    PK: string, 
    SK: string, 
    updates: Partial<FluxionRecord>
  ): Promise<FluxionRecord> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Build update expression
    Object.keys(updates).forEach((key, index) => {
      if (key !== 'PK' && key !== 'SK' && updates[key as keyof FluxionRecord] !== undefined) {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = updates[key as keyof FluxionRecord];
      }
    });

    // Always update the updated_at timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const params: UpdateCommandInput = {
      TableName: this.tableName,
      Key: { PK, SK },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    this.logger.info('Updating record', { PK, SK, updateCount: updateExpressions.length });

    try {
      const result = await this.client.send(new UpdateCommand(params));
      this.logger.info('Record updated successfully', { PK, SK });
      return result.Attributes as FluxionRecord;
    } catch (error: any) {
      this.logger.error('Failed to update record', { error: error.message, PK, SK });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update record',
        500,
        error
      );
    }
  }

  /**
   * Delete a record
   */
  async delete(PK: string, SK: string): Promise<void> {
    const params: DeleteCommandInput = {
      TableName: this.tableName,
      Key: { PK, SK }
    };

    this.logger.info('Deleting record', { PK, SK });

    try {
      await this.client.send(new DeleteCommand(params));
      this.logger.info('Record deleted successfully', { PK, SK });
    } catch (error: any) {
      this.logger.error('Failed to delete record', { error: error.message, PK, SK });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to delete record',
        500,
        error
      );
    }
  }

  /**
   * Batch write records
   */
  async batchWrite(records: FluxionRecord[]): Promise<void> {
    if (records.length === 0) return;
    
    // DynamoDB batch write limit is 25 items
    const batches = [];
    for (let i = 0; i < records.length; i += 25) {
      batches.push(records.slice(i, i + 25));
    }

    this.logger.info('Starting batch write', { totalRecords: records.length, batches: batches.length });

    for (const batch of batches) {
      const params = {
        RequestItems: {
          [this.tableName]: batch.map(record => ({
            PutRequest: {
              Item: {
                ...record,
                updated_at: new Date().toISOString()
              }
            }
          }))
        }
      };

      try {
        await this.client.send(new BatchWriteCommand(params));
        this.logger.info('Batch write completed', { batchSize: batch.length });
      } catch (error: any) {
        this.logger.error('Batch write failed', { error: error.message, batchSize: batch.length });
        throw new FluxionError(
          ErrorCodes.DATABASE_ERROR,
          'Batch write failed',
          500,
          error
        );
      }
    }
  }

  /**
   * Generate unique ID
   */
  generateId(): string {
    return uuidv4();
  }

  // ================================
  // Multi-Table Operations
  // ================================

  /**
   * Create a user in the Users table
   */
  async createUser(_tenantContext: TenantContext, userData: Omit<UserRecord, 'id' | 'created_at' | 'updated_at'>): Promise<UserRecord> {
    const now = new Date().toISOString();
    const user: UserRecord = {
      ...userData,
      id: this.generateId(),
      created_at: now,
      updated_at: now
    };

    const params: PutCommandInput = {
      TableName: this.usersTableName,
      Item: user,
      ConditionExpression: 'attribute_not_exists(id)'
    };

    this.logger.info('Creating user', { userId: user.id, tenantId: user.tenant_id, walletAddress: user.wallet_address });

    try {
      await this.client.send(new PutCommand(params));
      this.logger.info('User created successfully', { userId: user.id });
      return user;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new FluxionError(
          ErrorCodes.CONFLICT,
          'User already exists',
          409,
          { userId: user.id }
        );
      }
      this.logger.error('Failed to create user', { error: error.message, userId: user.id });
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
   */
  async getUserById(tenantContext: TenantContext, userId: string): Promise<UserRecord | null> {
    const params: GetCommandInput = {
      TableName: this.usersTableName,
      Key: { id: userId, tenant_id: tenantContext.tenantId }
    };

    this.logger.info('Getting user by ID', { userId, tenantId: tenantContext.tenantId });

    try {
      const result = await this.client.send(new GetCommand(params));
      if (!result.Item) {
        this.logger.info('User not found', { userId, tenantId: tenantContext.tenantId });
        return null;
      }
      return result.Item as UserRecord;
    } catch (error: any) {
      this.logger.error('Failed to get user', { error: error.message, userId });
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
   */
  async getUserByWallet(tenantContext: TenantContext, walletAddress: string): Promise<UserRecord | null> {
    const params: QueryCommandInput = {
      TableName: this.usersTableName,
      IndexName: 'WalletAddressIndex',
      KeyConditionExpression: 'tenant_id = :tenantId AND wallet_address = :walletAddress',
      ExpressionAttributeValues: {
        ':tenantId': tenantContext.tenantId,
        ':walletAddress': walletAddress
      },
      Limit: 1
    };

    this.logger.info('Getting user by wallet', { walletAddress, tenantId: tenantContext.tenantId });

    try {
      const result = await this.client.send(new QueryCommand(params));
      if (!result.Items || result.Items.length === 0) {
        this.logger.info('User not found by wallet', { walletAddress, tenantId: tenantContext.tenantId });
        return null;
      }
      return result.Items[0] as UserRecord;
    } catch (error: any) {
      this.logger.error('Failed to get user by wallet', { error: error.message, walletAddress });
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
   */
  async updateUser(tenantContext: TenantContext, userId: string, updates: Partial<Omit<UserRecord, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<UserRecord> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.keys(updates).forEach((key, index) => {
      if (updates[key as keyof typeof updates] !== undefined) {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = updates[key as keyof typeof updates];
      }
    });

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const params: UpdateCommandInput = {
      TableName: this.usersTableName,
      Key: { id: userId, tenant_id: tenantContext.tenantId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    this.logger.info('Updating user', { userId, tenantId: tenantContext.tenantId, updateCount: updateExpressions.length });

    try {
      const result = await this.client.send(new UpdateCommand(params));
      this.logger.info('User updated successfully', { userId });
      return result.Attributes as UserRecord;
    } catch (error: any) {
      this.logger.error('Failed to update user', { error: error.message, userId });
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
   */
  async createInvoice(tenantContext: TenantContext, invoiceData: Omit<InvoiceRecord, 'id' | 'created_at' | 'updated_at'>): Promise<InvoiceRecord> {
    const now = new Date().toISOString();
    const invoice: InvoiceRecord = {
      ...invoiceData,
      id: this.generateId(),
      tenant_id: tenantContext.tenantId,
      created_at: now,
      updated_at: now
    };

    const params: PutCommandInput = {
      TableName: this.invoicesTableName,
      Item: invoice,
      ConditionExpression: 'attribute_not_exists(id)'
    };

    this.logger.info('Creating invoice', { invoiceId: invoice.id, tenantId: invoice.tenant_id, userId: invoice.user_id });

    try {
      await this.client.send(new PutCommand(params));
      this.logger.info('Invoice created successfully', { invoiceId: invoice.id });
      return invoice;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new FluxionError(
          ErrorCodes.CONFLICT,
          'Invoice already exists',
          409,
          { invoiceId: invoice.id }
        );
      }
      this.logger.error('Failed to create invoice', { error: error.message, invoiceId: invoice.id });
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
   */
  async getInvoiceById(tenantContext: TenantContext, invoiceId: string): Promise<InvoiceRecord | null> {
    const params: GetCommandInput = {
      TableName: this.invoicesTableName,
      Key: { id: invoiceId, tenant_id: tenantContext.tenantId }
    };

    this.logger.info('Getting invoice by ID', { invoiceId, tenantId: tenantContext.tenantId });

    try {
      const result = await this.client.send(new GetCommand(params));
      if (!result.Item) {
        this.logger.info('Invoice not found', { invoiceId, tenantId: tenantContext.tenantId });
        return null;
      }
      return result.Item as InvoiceRecord;
    } catch (error: any) {
      this.logger.error('Failed to get invoice', { error: error.message, invoiceId });
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
   */
  async getInvoicesByUser(tenantContext: TenantContext, userId: string, options: QueryOptions = {}): Promise<MultiTableQueryResult<InvoiceRecord>> {
    const params: QueryCommandInput = {
      TableName: this.invoicesTableName,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'tenant_id = :tenantId AND user_id = :userId',
      ExpressionAttributeValues: {
        ':tenantId': tenantContext.tenantId,
        ':userId': userId
      },
      Limit: options.limit || 50,
      ScanIndexForward: options.sortDirection !== 'desc'
    };

    if (options.nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(options.nextToken, 'base64').toString());
    }

    this.logger.info('Getting invoices by user', { userId, tenantId: tenantContext.tenantId, options });

    try {
      const result = await this.client.send(new QueryCommand(params));
      
      const nextToken = result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined;

      this.logger.info('Invoices query completed', { 
        userId, 
        itemCount: result.Items?.length || 0, 
        hasMore: !!nextToken 
      });

      return {
        items: (result.Items || []) as InvoiceRecord[],
        nextToken
      };
    } catch (error: any) {
      this.logger.error('Failed to query invoices by user', { error: error.message, userId });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to query invoices',
        500,
        error
      );
    }
  }

  /**
   * Update invoice
   */
  async updateInvoice(tenantContext: TenantContext, invoiceId: string, updates: Partial<Omit<InvoiceRecord, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<InvoiceRecord> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.keys(updates).forEach((key, index) => {
      if (updates[key as keyof typeof updates] !== undefined) {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = updates[key as keyof typeof updates];
      }
    });

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const params: UpdateCommandInput = {
      TableName: this.invoicesTableName,
      Key: { id: invoiceId, tenant_id: tenantContext.tenantId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    this.logger.info('Updating invoice', { invoiceId, tenantId: tenantContext.tenantId, updateCount: updateExpressions.length });

    try {
      const result = await this.client.send(new UpdateCommand(params));
      this.logger.info('Invoice updated successfully', { invoiceId });
      return result.Attributes as InvoiceRecord;
    } catch (error: any) {
      this.logger.error('Failed to update invoice', { error: error.message, invoiceId });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update invoice',
        500,
        error
      );
    }
  }

  /**
   * Create a payment in the Payments table
   */
  async createPayment(tenantContext: TenantContext, paymentData: Omit<PaymentRecord, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentRecord> {
    const now = new Date().toISOString();
    const payment: PaymentRecord = {
      ...paymentData,
      id: this.generateId(),
      tenant_id: tenantContext.tenantId,
      created_at: now,
      updated_at: now
    };

    const params: PutCommandInput = {
      TableName: this.paymentsTableName,
      Item: payment,
      ConditionExpression: 'attribute_not_exists(id)'
    };

    this.logger.info('Creating payment', { paymentId: payment.id, tenantId: payment.tenant_id, invoiceId: payment.invoice_id });

    try {
      await this.client.send(new PutCommand(params));
      this.logger.info('Payment created successfully', { paymentId: payment.id });
      return payment;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new FluxionError(
          ErrorCodes.CONFLICT,
          'Payment already exists',
          409,
          { paymentId: payment.id }
        );
      }
      this.logger.error('Failed to create payment', { error: error.message, paymentId: payment.id });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create payment',
        500,
        error
      );
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(tenantContext: TenantContext, paymentId: string): Promise<PaymentRecord | null> {
    const params: GetCommandInput = {
      TableName: this.paymentsTableName,
      Key: { id: paymentId, tenant_id: tenantContext.tenantId }
    };

    this.logger.info('Getting payment by ID', { paymentId, tenantId: tenantContext.tenantId });

    try {
      const result = await this.client.send(new GetCommand(params));
      if (!result.Item) {
        this.logger.info('Payment not found', { paymentId, tenantId: tenantContext.tenantId });
        return null;
      }
      return result.Item as PaymentRecord;
    } catch (error: any) {
      this.logger.error('Failed to get payment', { error: error.message, paymentId });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to retrieve payment',
        500,
        error
      );
    }
  }

  /**
   * Get payments by invoice ID
   */
  async getPaymentsByInvoice(tenantContext: TenantContext, invoiceId: string, options: QueryOptions = {}): Promise<MultiTableQueryResult<PaymentRecord>> {
    const params: QueryCommandInput = {
      TableName: this.paymentsTableName,
      IndexName: 'InvoiceIdIndex',
      KeyConditionExpression: 'tenant_id = :tenantId AND invoice_id = :invoiceId',
      ExpressionAttributeValues: {
        ':tenantId': tenantContext.tenantId,
        ':invoiceId': invoiceId
      },
      Limit: options.limit || 50,
      ScanIndexForward: options.sortDirection !== 'desc'
    };

    if (options.nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(options.nextToken, 'base64').toString());
    }

    this.logger.info('Getting payments by invoice', { invoiceId, tenantId: tenantContext.tenantId, options });

    try {
      const result = await this.client.send(new QueryCommand(params));
      
      const nextToken = result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined;

      this.logger.info('Payments query completed', { 
        invoiceId, 
        itemCount: result.Items?.length || 0, 
        hasMore: !!nextToken 
      });

      return {
        items: (result.Items || []) as PaymentRecord[],
        nextToken
      };
    } catch (error: any) {
      this.logger.error('Failed to query payments by invoice', { error: error.message, invoiceId });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to query payments',
        500,
        error
      );
    }
  }

  /**
   * Update payment
   */
  async updatePayment(tenantContext: TenantContext, paymentId: string, updates: Partial<Omit<PaymentRecord, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<PaymentRecord> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.keys(updates).forEach((key, index) => {
      if (updates[key as keyof typeof updates] !== undefined) {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = updates[key as keyof typeof updates];
      }
    });

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const params: UpdateCommandInput = {
      TableName: this.paymentsTableName,
      Key: { id: paymentId, tenant_id: tenantContext.tenantId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    this.logger.info('Updating payment', { paymentId, tenantId: tenantContext.tenantId, updateCount: updateExpressions.length });

    try {
      const result = await this.client.send(new UpdateCommand(params));
      this.logger.info('Payment updated successfully', { paymentId });
      return result.Attributes as PaymentRecord;
    } catch (error: any) {
      this.logger.error('Failed to update payment', { error: error.message, paymentId });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update payment',
        500,
        error
      );
    }
  }

  /**
   * Dual-write method for gradual migration
   */
  async dualWrite<T>(
    legacyOperation: () => Promise<T>,
    newOperation: () => Promise<T>
  ): Promise<T> {
    if (this.useMultiTable) {
      try {
        const result = await newOperation();
        // Async legacy write for data consistency (fire and forget)
        legacyOperation().catch(error => {
          this.logger.warn('Legacy write failed during dual-write', { error: error.message });
        });
        return result;
      } catch (error) {
        this.logger.error('New table operation failed, falling back to legacy', { error });
        return await legacyOperation();
      }
    } else {
      const result = await legacyOperation();
      // Async new table write for preparation (fire and forget)
      newOperation().catch(error => {
        this.logger.warn('New table write failed during dual-write preparation', { error: error.message });
      });
      return result;
    }
  }

  /**
   * Health check for database connectivity
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        Limit: 1
      });
      
      await this.client.send(command);
      
      const latency = Date.now() - startTime;
      
      this.logger.debug('Database health check passed', { latency });
      return { status: 'healthy', latency };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('Database health check failed', { error: error.message, latency });
      return { 
        status: 'unhealthy', 
        latency,
        error: error.message 
      };
    }
  }

  /**
   * Create record with condition check
   */
  async createIfNotExists(record: FluxionRecord): Promise<FluxionRecord> {
    const params: PutCommandInput = {
      TableName: this.tableName,
      Item: {
        ...record,
        created_at: record.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      ConditionExpression: 'attribute_not_exists(PK)'
    };

    try {
      await this.client.send(new PutCommand(params));
      return params.Item as FluxionRecord;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new FluxionError(
          ErrorCodes.CONFLICT,
          'Record already exists',
          409,
          { PK: record.PK, SK: record.SK }
        );
      }
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create record',
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