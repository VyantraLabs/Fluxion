import { DatabaseService } from '@/shared/database/client';
import { InvoiceRecord, TenantContext, FluxionError, ErrorCodes, LineItem, InvoiceStatus, QueryOptions, MultiTableQueryResult } from '@/types/common';
import { Logger } from '@/shared/utils/logger';
import { UsersService } from './users.service';

export class InvoicesService {
  private db: DatabaseService;
  private usersService: UsersService;
  private logger: Logger;

  constructor(db: DatabaseService, usersService: UsersService) {
    this.db = db;
    this.usersService = usersService;
    this.logger = new Logger('InvoicesService');
  }

  /**
   * Create a new invoice
   */
  async createInvoice(tenantContext: TenantContext, invoiceData: {
    user_id: string;
    client_info: {
      name: string;
      email: string;
      address?: string;
    };
    line_items: LineItem[];
    amounts: {
      subtotal: number;
      tax_rate?: number;
      tax_amount?: number;
      discount_amount?: number;
      total: number;
    };
    due_date: string;
    blockchain_data?: {
      network: string;
      token_address: string;
      recipient_address: string;
      payment_url: string;
    };
    metadata?: {
      notes?: string;
    };
  }): Promise<InvoiceRecord> {
    this.logger.info('Creating invoice', { 
      tenantId: tenantContext.tenantId, 
      userId: invoiceData.user_id,
      amount: invoiceData.amounts.total
    });

    // Validate user exists
    await this.usersService.validateUserAccess(tenantContext, invoiceData.user_id);

    // Validate line items and amounts
    this.validateInvoiceAmounts(invoiceData.line_items, invoiceData.amounts);

    const invoiceToCreate: Omit<InvoiceRecord, 'id' | 'created_at' | 'updated_at'> = {
      tenant_id: tenantContext.tenantId,
      user_id: invoiceData.user_id,
      client_info: invoiceData.client_info,
      line_items: invoiceData.line_items,
      amounts: invoiceData.amounts,
      due_date: invoiceData.due_date,
      status: 'draft' as InvoiceStatus,
      blockchain_data: invoiceData.blockchain_data,
      metadata: invoiceData.metadata
    };

    try {
      const invoice = await this.db.createInvoice(tenantContext, invoiceToCreate);
      
      // Update user invoice count
      await this.usersService.updateUserStats(tenantContext, invoiceData.user_id, {
        invoice_count_delta: 1
      });

      this.logger.info('Invoice created successfully', { invoiceId: invoice.id });
      return invoice;
    } catch (error: any) {
      this.logger.error('Failed to create invoice', { error: error.message });
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(tenantContext: TenantContext, invoiceId: string): Promise<InvoiceRecord> {
    this.logger.info('Getting invoice by ID', { invoiceId, tenantId: tenantContext.tenantId });

    const invoice = await this.db.getInvoiceById(tenantContext, invoiceId);
    if (!invoice) {
      throw new FluxionError(
        ErrorCodes.NOT_FOUND,
        'Invoice not found',
        404,
        { invoiceId }
      );
    }

    return invoice;
  }

  /**
   * Get invoices by user ID
   */
  async getInvoicesByUser(
    tenantContext: TenantContext, 
    userId: string, 
    options: QueryOptions & { status?: InvoiceStatus } = {}
  ): Promise<MultiTableQueryResult<InvoiceRecord>> {
    this.logger.info('Getting invoices by user', { 
      userId, 
      tenantId: tenantContext.tenantId, 
      options 
    });

    // Validate user exists
    await this.usersService.validateUserAccess(tenantContext, userId);

    const result = await this.db.getInvoicesByUser(tenantContext, userId, options);

    // Filter by status if specified
    if (options.status) {
      result.items = result.items.filter(invoice => invoice.status === options.status);
    }

    return result;
  }

  /**
   * Update invoice
   */
  async updateInvoice(tenantContext: TenantContext, invoiceId: string, updates: {
    client_info?: Partial<{
      name: string;
      email: string;
      address?: string;
    }>;
    line_items?: LineItem[];
    amounts?: {
      subtotal: number;
      tax_rate?: number;
      tax_amount?: number;
      discount_amount?: number;
      total: number;
    };
    status?: InvoiceStatus;
    due_date?: string;
    paid_at?: string;
    blockchain_data?: {
      network: string;
      token_address: string;
      recipient_address: string;
      payment_url: string;
    };
    metadata?: {
      pdf_url?: string;
      public_url?: string;
      notes?: string;
    };
  }): Promise<InvoiceRecord> {
    this.logger.info('Updating invoice', { invoiceId, tenantId: tenantContext.tenantId });

    // Get current invoice
    const currentInvoice = await this.getInvoiceById(tenantContext, invoiceId);
    
    const updateData: any = {};

    if (updates.client_info) {
      updateData.client_info = {
        ...currentInvoice.client_info,
        ...updates.client_info
      };
    }

    if (updates.line_items && updates.amounts) {
      this.validateInvoiceAmounts(updates.line_items, updates.amounts);
      updateData.line_items = updates.line_items;
      updateData.amounts = updates.amounts;
    }

    if (updates.status) {
      updateData.status = updates.status;
    }

    if (updates.due_date) {
      updateData.due_date = updates.due_date;
    }

    if (updates.paid_at) {
      updateData.paid_at = updates.paid_at;
    }

    if (updates.blockchain_data) {
      updateData.blockchain_data = {
        ...currentInvoice.blockchain_data,
        ...updates.blockchain_data
      };
    }

    if (updates.metadata) {
      updateData.metadata = {
        ...currentInvoice.metadata,
        ...updates.metadata
      };
    }

    try {
      const updatedInvoice = await this.db.updateInvoice(tenantContext, invoiceId, updateData);
      
      // If invoice is marked as paid, update user total received
      if (updates.status === 'paid' && currentInvoice.status !== 'paid') {
        await this.usersService.updateUserStats(tenantContext, currentInvoice.user_id, {
          total_received_delta: updatedInvoice.amounts.total
        });
      }

      this.logger.info('Invoice updated successfully', { invoiceId });
      return updatedInvoice;
    } catch (error: any) {
      this.logger.error('Failed to update invoice', { error: error.message, invoiceId });
      throw error;
    }
  }

  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(
    tenantContext: TenantContext, 
    invoiceId: string, 
    _paymentData?: {
      transaction_hash?: string;
      amount?: number;
    }
  ): Promise<InvoiceRecord> {
    this.logger.info('Marking invoice as paid', { invoiceId, tenantId: tenantContext.tenantId });

    const updates: any = {
      status: 'paid' as InvoiceStatus,
      paid_at: new Date().toISOString()
    };

    return await this.updateInvoice(tenantContext, invoiceId, updates);
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(tenantContext: TenantContext, invoiceId: string): Promise<InvoiceRecord> {
    this.logger.info('Cancelling invoice', { invoiceId, tenantId: tenantContext.tenantId });

    const invoice = await this.getInvoiceById(tenantContext, invoiceId);
    
    if (invoice.status === 'paid') {
      throw new FluxionError(
        ErrorCodes.VALIDATION_ERROR,
        'Cannot cancel a paid invoice',
        400,
        { invoiceId, status: invoice.status }
      );
    }

    return await this.updateInvoice(tenantContext, invoiceId, {
      status: 'cancelled' as InvoiceStatus
    });
  }

  /**
   * Check if invoice is expired
   */
  isInvoiceExpired(invoice: InvoiceRecord): boolean {
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return false;
    }

    const dueDate = new Date(invoice.due_date);
    const now = new Date();
    
    return now > dueDate;
  }

  /**
   * Mark expired invoices
   */
  async markExpiredInvoices(tenantContext: TenantContext): Promise<void> {
    this.logger.info('Checking for expired invoices', { tenantId: tenantContext.tenantId });

    // This would typically be run as a background job
    // For now, we'll leave this as a placeholder for the implementation
    // In a real system, you'd query for pending invoices past due date
    // and update their status to 'expired'
  }

  /**
   * Get invoice statistics for a user
   */
  async getInvoiceStats(tenantContext: TenantContext, userId: string): Promise<{
    total_invoices: number;
    paid_invoices: number;
    pending_invoices: number;
    total_amount: number;
    paid_amount: number;
  }> {
    this.logger.info('Getting invoice stats', { userId, tenantId: tenantContext.tenantId });

    const invoicesResult = await this.getInvoicesByUser(tenantContext, userId, { limit: 1000 });
    const invoices = invoicesResult.items;

    const stats = {
      total_invoices: invoices.length,
      paid_invoices: invoices.filter(inv => inv.status === 'paid').length,
      pending_invoices: invoices.filter(inv => inv.status === 'pending').length,
      total_amount: invoices.reduce((sum, inv) => sum + inv.amounts.total, 0),
      paid_amount: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amounts.total, 0)
    };

    return stats;
  }

  /**
   * Validate invoice amounts calculation
   */
  private validateInvoiceAmounts(lineItems: LineItem[], amounts: InvoiceRecord['amounts']): void {
    const calculatedSubtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    
    if (Math.abs(calculatedSubtotal - amounts.subtotal) > 0.01) {
      throw new FluxionError(
        ErrorCodes.VALIDATION_ERROR,
        'Subtotal does not match line items total',
        400,
        { calculated: calculatedSubtotal, provided: amounts.subtotal }
      );
    }

    let calculatedTotal = amounts.subtotal;
    
    if (amounts.tax_amount) {
      calculatedTotal += amounts.tax_amount;
    }
    
    if (amounts.discount_amount) {
      calculatedTotal -= amounts.discount_amount;
    }

    if (Math.abs(calculatedTotal - amounts.total) > 0.01) {
      throw new FluxionError(
        ErrorCodes.VALIDATION_ERROR,
        'Total amount calculation is incorrect',
        400,
        { calculated: calculatedTotal, provided: amounts.total }
      );
    }
  }

  /**
   * Generate public invoice URL
   */
  generatePublicUrl(invoiceId: string): string {
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://app.fluxion.dev';
    return `${baseUrl}/invoice/${invoiceId}`;
  }

  /**
   * Generate payment URL for blockchain payment
   */
  generatePaymentUrl(invoiceId: string, network: string = 'polygon'): string {
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://app.fluxion.dev';
    return `${baseUrl}/pay/${invoiceId}?network=${network}`;
  }
}