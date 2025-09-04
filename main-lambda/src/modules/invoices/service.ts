import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/shared/database/client';
import { getNotificationService } from '@/shared/notifications/client';
import { Logger } from '@/shared/utils/logger';
import { 
  createNotFoundError, 
  createValidationError, 
  createForbiddenError 
} from '@/shared/errors';
import { 
  Invoice, 
  InvoiceEntity, 
  CreateInvoiceDTO, 
  UpdateInvoiceDTO,
  InvoiceWithPayments 
} from '@/types/invoice';
import { PaginationParams, InvoiceData, PaymentData, UserData, NotificationData } from '@/types/common';

// Type guard for payment data
const isPaymentData = (data: InvoiceData | PaymentData | UserData | NotificationData): data is PaymentData => {
  return 'payment_id' in data && 'tx_hash' in data;
};

export class InvoiceService {
  private db = getDatabase();
  private notifications = getNotificationService();
  private logger = new Logger('InvoiceService');

  /**
   * Create a new invoice
   */
  async create(data: CreateInvoiceDTO, creatorName?: string): Promise<Invoice> {
    this.logger.info('Creating invoice', { 
      creator_wallet: data.creator_wallet,
      amount: data.amount 
    });

    const invoiceId = uuidv4();
    const now = new Date().toISOString();
    
    // Generate payment URL
    const paymentUrl = `${process.env.FRONTEND_URL || 'https://app.fluxion.pay'}/pay/${invoiceId}`;

    // Calculate line items if provided
    let calculatedAmount = data.amount;
    if (data.line_items && data.line_items.length > 0) {
      calculatedAmount = data.line_items.reduce((total, item) => {
        const itemAmount = item.quantity * item.rate;
        return total + itemAmount;
      }, 0);
    }

    const invoiceData: Invoice = {
      invoice_id: invoiceId,
      creator_wallet: data.creator_wallet,
      client_email: data.client_email,
      client_name: data.client_name,
      amount: calculatedAmount,
      description: data.description,
      line_items: data.line_items?.map(item => ({
        ...item,
        id: item.id || uuidv4(),
        amount: item.quantity * item.rate
      })),
      status: 'draft',
      due_date: data.due_date,
      payment_url: paymentUrl,
      created_at: now,
      updated_at: now
    };

    // Create database entity
    const entity: InvoiceEntity = {
      PK: `INV#${invoiceId}`,
      SK: 'METADATA',
      GSI1PK: `USER#${data.creator_wallet}`,
      GSI1SK: now,
      GSI2PK: 'STATUS#draft',
      GSI2SK: now,
      entityType: 'INVOICE',
      created_at: now,
      updated_at: now,
      data: {
        invoice_id: invoiceId,
        creator_wallet: data.creator_wallet,
        client_email: data.client_email,
        client_name: data.client_name,
        amount: calculatedAmount,
        description: data.description,
        line_items: invoiceData.line_items,
        status: 'draft',
        due_date: data.due_date,
        payment_url: paymentUrl
      }
    };

    try {
      await this.db.save(entity);
      
      this.logger.info('Invoice created successfully', { 
        invoice_id: invoiceId,
        amount: calculatedAmount 
      });

      // Send notification if invoice is not in draft status
      if (entity.data.status === 'pending') {
        await this.notifications.sendInvoiceCreated(invoiceData, creatorName);
      }

      return invoiceData;
    } catch (error) {
      this.logger.error('Failed to create invoice', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async findById(invoiceId: string, walletAddress?: string): Promise<Invoice> {
    this.logger.info('Finding invoice by ID', { invoice_id: invoiceId });

    const entity = await this.db.findById(`INV#${invoiceId}`, 'METADATA');
    
    if (!entity || entity.entityType !== 'INVOICE') {
      throw createNotFoundError('Invoice', invoiceId);
    }

    const invoiceEntity = entity as InvoiceEntity;

    // Check access permissions if wallet address is provided
    if (walletAddress && invoiceEntity.data.creator_wallet !== walletAddress) {
      throw createForbiddenError('You do not have permission to access this invoice');
    }

    const invoice: Invoice = {
      invoice_id: invoiceEntity.data.invoice_id,
      creator_wallet: invoiceEntity.data.creator_wallet,
      client_email: invoiceEntity.data.client_email,
      client_name: invoiceEntity.data.client_name,
      amount: invoiceEntity.data.amount,
      description: invoiceEntity.data.description,
      line_items: invoiceEntity.data.line_items,
      status: invoiceEntity.data.status,
      due_date: invoiceEntity.data.due_date,
      paid_at: invoiceEntity.data.paid_at,
      payment_tx_hash: invoiceEntity.data.payment_tx_hash,
      payment_url: invoiceEntity.data.payment_url,
      pdf_url: invoiceEntity.data.pdf_url,
      created_at: invoiceEntity.created_at,
      updated_at: invoiceEntity.updated_at
    };

    this.logger.info('Invoice found', { 
      invoice_id: invoiceId,
      status: invoice.status 
    });

    return invoice;
  }

  /**
   * Get invoice with payment information
   */
  async findByIdWithPayments(invoiceId: string, walletAddress?: string): Promise<InvoiceWithPayments> {
    const invoice = await this.findById(invoiceId, walletAddress);

    // Get related payments
    const paymentsResult = await this.db.queryGSI1(`INV#${invoiceId}`, {
      limit: 10,
      scanIndexForward: false
    });

    const payments = paymentsResult.items
      .filter(item => item.entityType === 'PAYMENT')
      .map(item => {
        const paymentData = item.data;
        if (!isPaymentData(paymentData)) {
          throw new Error('Expected payment data but got different type');
        }
        return {
          payment_id: paymentData.payment_id,
          tx_hash: paymentData.tx_hash,
          amount: paymentData.amount,
          status: paymentData.status,
          created_at: item.created_at
        };
      });

    return {
      ...invoice,
      payments
    };
  }

  /**
   * Get invoices for a user
   */
  async findByUser(
    walletAddress: string, 
    options: PaginationParams & { status?: string } = {}
  ): Promise<{ items: Invoice[]; nextToken?: string; hasMore: boolean }> {
    this.logger.info('Finding invoices by user', { 
      wallet_address: walletAddress,
      options 
    });

    let queryResult;

    if (options.status) {
      // Query by status using GSI2
      queryResult = await this.db.queryGSI2(`STATUS#${options.status}`, {
        limit: options.limit || 20,
        nextToken: options.nextToken,
        scanIndexForward: false
      });

      // Filter by user (since GSI2 is by status, not user)
      queryResult.items = queryResult.items.filter(item => 
        item.entityType === 'INVOICE' && 
        (item as InvoiceEntity).data.creator_wallet === walletAddress
      );
    } else {
      // Query by user using GSI1
      queryResult = await this.db.queryGSI1(`USER#${walletAddress}`, {
        limit: options.limit || 20,
        nextToken: options.nextToken,
        scanIndexForward: false
      });

      // Filter only invoices
      queryResult.items = queryResult.items.filter(item => item.entityType === 'INVOICE');
    }

    const invoices: Invoice[] = queryResult.items.map(item => {
      const invoiceEntity = item as InvoiceEntity;
      return {
        invoice_id: invoiceEntity.data.invoice_id,
        creator_wallet: invoiceEntity.data.creator_wallet,
        client_email: invoiceEntity.data.client_email,
        client_name: invoiceEntity.data.client_name,
        amount: invoiceEntity.data.amount,
        description: invoiceEntity.data.description,
        line_items: invoiceEntity.data.line_items,
        status: invoiceEntity.data.status,
        due_date: invoiceEntity.data.due_date,
        paid_at: invoiceEntity.data.paid_at,
        payment_tx_hash: invoiceEntity.data.payment_tx_hash,
        payment_url: invoiceEntity.data.payment_url,
        pdf_url: invoiceEntity.data.pdf_url,
        created_at: invoiceEntity.created_at,
        updated_at: invoiceEntity.updated_at
      };
    });

    this.logger.info('Invoices found', { 
      wallet_address: walletAddress,
      count: invoices.length 
    });

    return {
      items: invoices,
      nextToken: queryResult.nextToken,
      hasMore: !!queryResult.nextToken
    };
  }

  /**
   * Update an invoice
   */
  async update(
    invoiceId: string, 
    data: UpdateInvoiceDTO, 
    walletAddress: string
  ): Promise<Invoice> {
    this.logger.info('Updating invoice', { 
      invoice_id: invoiceId,
      wallet_address: walletAddress 
    });

    // First, get the existing invoice to check permissions
    const existingInvoice = await this.findById(invoiceId, walletAddress);

    // Don't allow updates to paid invoices
    if (existingInvoice.status === 'paid') {
      throw createValidationError('Cannot update paid invoices');
    }

    const now = new Date().toISOString();
    const updates: Partial<InvoiceEntity> = {};

    // Prepare updates - start with existing invoice data
    let updatedInvoiceData = { ...existingInvoice } as InvoiceData;
    
    // Apply updates
    if (data.client_email) updatedInvoiceData.client_email = data.client_email;
    if (data.client_name) updatedInvoiceData.client_name = data.client_name;
    if (data.description) updatedInvoiceData.description = data.description;
    if (data.due_date) updatedInvoiceData.due_date = data.due_date;
    if (data.line_items) {
      const lineItems = data.line_items.map(item => ({
        ...item,
        id: item.id || uuidv4(),
        amount: item.quantity * item.rate
      }));
      const calculatedAmount = lineItems.reduce((total, item) => total + item.amount, 0);
      updatedInvoiceData.line_items = lineItems;
      updatedInvoiceData.amount = calculatedAmount;
    }

    // Handle status change
    if (data.status && data.status !== existingInvoice.status) {
      updatedInvoiceData.status = data.status;
      updates.GSI2PK = `STATUS#${data.status}`;
      updates.GSI2SK = now;
    }
    
    // Set the updated data
    updates.data = updatedInvoiceData;

    if (Object.keys(updates).length === 0) {
      return existingInvoice;
    }

    updates.updated_at = now;

    try {
      await this.db.update(
        `INV#${invoiceId}`, 
        'METADATA', 
        updates
      );

      const updatedInvoice = await this.findById(invoiceId);

      this.logger.info('Invoice updated successfully', { 
        invoice_id: invoiceId 
      });

      // Send notification if status changed to pending
      if (data.status === 'pending' && existingInvoice.status !== 'pending') {
        await this.notifications.sendInvoiceCreated(updatedInvoice);
      }

      return updatedInvoice;
    } catch (error) {
      this.logger.error('Failed to update invoice', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Mark invoice as paid
   */
  async markAsPaid(
    invoiceId: string, 
    paymentTxHash: string,
    paidAmount: number
  ): Promise<Invoice> {
    this.logger.info('Marking invoice as paid', { 
      invoice_id: invoiceId,
      tx_hash: paymentTxHash,
      amount: paidAmount 
    });

    const now = new Date().toISOString();

    const updates: Partial<InvoiceEntity> = {
      GSI2PK: 'STATUS#paid',
      GSI2SK: now,
      updated_at: now
    };

    // Update invoice data
    const existingInvoice = await this.findById(invoiceId);
    updates.data = {
      ...existingInvoice,
      status: 'paid',
      paid_at: now,
      payment_tx_hash: paymentTxHash,
      amount: paidAmount // Update with actual paid amount
    };

    try {
      await this.db.update(`INV#${invoiceId}`, 'METADATA', updates);

      const updatedInvoice = await this.findById(invoiceId);

      this.logger.info('Invoice marked as paid', { 
        invoice_id: invoiceId,
        tx_hash: paymentTxHash 
      });

      return updatedInvoice;
    } catch (error) {
      this.logger.error('Failed to mark invoice as paid', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Delete an invoice (soft delete by changing status)
   */
  async delete(invoiceId: string, walletAddress: string): Promise<void> {
    this.logger.info('Deleting invoice', { 
      invoice_id: invoiceId,
      wallet_address: walletAddress 
    });

    // Check permissions
    await this.findById(invoiceId, walletAddress);

    await this.update(invoiceId, { status: 'cancelled' }, walletAddress);

    this.logger.info('Invoice deleted (cancelled)', { invoice_id: invoiceId });
  }

  /**
   * Get invoice by ID for public access (without wallet authentication)
   */
  async findPublicById(invoiceId: string): Promise<Invoice> {
    this.logger.info('Finding invoice by ID (public)', { invoice_id: invoiceId });

    const entity = await this.db.findById(`INV#${invoiceId}`, 'METADATA');
    
    if (!entity || entity.entityType !== 'INVOICE') {
      throw createNotFoundError('Invoice', invoiceId);
    }

    const invoiceEntity = entity as InvoiceEntity;

    const invoice: Invoice = {
      invoice_id: invoiceEntity.data.invoice_id,
      creator_wallet: invoiceEntity.data.creator_wallet,
      client_email: invoiceEntity.data.client_email,
      client_name: invoiceEntity.data.client_name,
      amount: invoiceEntity.data.amount,
      description: invoiceEntity.data.description,
      line_items: invoiceEntity.data.line_items,
      status: invoiceEntity.data.status,
      due_date: invoiceEntity.data.due_date,
      paid_at: invoiceEntity.data.paid_at,
      payment_tx_hash: invoiceEntity.data.payment_tx_hash,
      payment_url: invoiceEntity.data.payment_url,
      pdf_url: invoiceEntity.data.pdf_url,
      created_at: invoiceEntity.created_at,
      updated_at: invoiceEntity.updated_at
    };

    this.logger.info('Invoice found (public)', { 
      invoice_id: invoiceId,
      status: invoice.status 
    });

    return invoice;
  }

  /**
   * Cancel an invoice
   */
  async cancel(invoiceId: string, walletAddress: string): Promise<Invoice> {
    this.logger.info('Cancelling invoice', { 
      invoice_id: invoiceId,
      wallet_address: walletAddress 
    });

    const invoice = await this.findById(invoiceId, walletAddress);
    
    // Don't allow cancellation of paid invoices
    if (invoice.status === 'paid') {
      throw createValidationError('Cannot cancel paid invoices');
    }

    if (invoice.status === 'cancelled') {
      throw createValidationError('Invoice is already cancelled');
    }

    return await this.update(invoiceId, { status: 'cancelled' }, walletAddress);
  }

  /**
   * Send an invoice (mark as pending and send notification)
   */
  async send(invoiceId: string, walletAddress: string): Promise<Invoice> {
    this.logger.info('Sending invoice', { 
      invoice_id: invoiceId,
      wallet_address: walletAddress 
    });

    const invoice = await this.findById(invoiceId, walletAddress);
    
    // Only allow sending of draft invoices
    if (invoice.status !== 'draft') {
      throw createValidationError('Only draft invoices can be sent');
    }

    const updatedInvoice = await this.update(invoiceId, { status: 'pending' }, walletAddress);
    
    // Send notification
    await this.notifications.sendInvoiceCreated(updatedInvoice);

    this.logger.info('Invoice sent successfully', { invoice_id: invoiceId });
    
    return updatedInvoice;
  }

  /**
   * Get dashboard statistics for a user
   */
  async getDashboardStats(walletAddress: string): Promise<{
    total_invoices: number;
    total_amount: number;
    total_paid: number;
    pending_amount: number;
    recent_invoices: Invoice[];
  }> {
    this.logger.info('Getting dashboard stats', { wallet_address: walletAddress });

    // Get all user invoices
    const result = await this.db.queryGSI1(`USER#${walletAddress}`, {
      limit: 100,
      scanIndexForward: false
    });

    const invoices = result.items
      .filter(item => item.entityType === 'INVOICE')
      .map(item => {
        const invoiceEntity = item as InvoiceEntity;
        return {
          invoice_id: invoiceEntity.data.invoice_id,
          creator_wallet: invoiceEntity.data.creator_wallet,
          client_email: invoiceEntity.data.client_email,
          client_name: invoiceEntity.data.client_name,
          amount: invoiceEntity.data.amount,
          description: invoiceEntity.data.description,
          line_items: invoiceEntity.data.line_items,
          status: invoiceEntity.data.status,
          due_date: invoiceEntity.data.due_date,
          paid_at: invoiceEntity.data.paid_at,
          payment_tx_hash: invoiceEntity.data.payment_tx_hash,
          payment_url: invoiceEntity.data.payment_url,
          pdf_url: invoiceEntity.data.pdf_url,
          created_at: invoiceEntity.created_at,
          updated_at: invoiceEntity.updated_at
        };
      });

    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
    const pendingAmount = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount, 0);
    const recentInvoices = invoices.slice(0, 5);

    const stats = {
      total_invoices: totalInvoices,
      total_amount: totalAmount,
      total_paid: totalPaid,
      pending_amount: pendingAmount,
      recent_invoices: recentInvoices
    };

    this.logger.info('Dashboard stats retrieved', { 
      wallet_address: walletAddress,
      total_invoices: totalInvoices 
    });

    return stats;
  }

  /**
   * Get invoice status
   */
  async getStatus(invoiceId: string): Promise<{ status: string; last_updated: string }> {
    this.logger.info('Getting invoice status', { invoice_id: invoiceId });

    const invoice = await this.findPublicById(invoiceId);
    
    return {
      status: invoice.status,
      last_updated: invoice.updated_at
    };
  }

  /**
   * Get invoices that need reminders
   */
  async getOverdueInvoices(): Promise<Invoice[]> {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    this.logger.info('Finding overdue invoices');

    const result = await this.db.queryGSI2('STATUS#pending', {
      GSI2SK: threeDaysAgo,
      sortKeyCondition: '<',
      limit: 50,
      scanIndexForward: true
    });

    const overdueInvoices = result.items
      .filter(item => item.entityType === 'INVOICE')
      .map(item => {
        const invoiceEntity = item as InvoiceEntity;
        return {
          invoice_id: invoiceEntity.data.invoice_id,
          creator_wallet: invoiceEntity.data.creator_wallet,
          client_email: invoiceEntity.data.client_email,
          client_name: invoiceEntity.data.client_name,
          amount: invoiceEntity.data.amount,
          description: invoiceEntity.data.description,
          line_items: invoiceEntity.data.line_items,
          status: invoiceEntity.data.status,
          due_date: invoiceEntity.data.due_date,
          paid_at: invoiceEntity.data.paid_at,
          payment_tx_hash: invoiceEntity.data.payment_tx_hash,
          payment_url: invoiceEntity.data.payment_url,
          pdf_url: invoiceEntity.data.pdf_url,
          created_at: invoiceEntity.created_at,
          updated_at: invoiceEntity.updated_at
        };
      })
      .filter(invoice => new Date(invoice.due_date) < now);

    this.logger.info('Overdue invoices found', { count: overdueInvoices.length });

    return overdueInvoices;
  }
}