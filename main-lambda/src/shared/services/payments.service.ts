import { DatabaseService } from '@/shared/database/client';
import { PaymentRecord, TenantContext, FluxionError, ErrorCodes, PaymentStatus, QueryOptions, MultiTableQueryResult } from '@/types/common';
import { Logger } from '@/shared/utils/logger';
import { InvoicesService } from './invoices.service';
import { UsersService } from './users.service';

export class PaymentsService {
  private db: DatabaseService;
  private invoicesService: InvoicesService;
  private logger: Logger;

  constructor(db: DatabaseService, invoicesService: InvoicesService, _usersService: UsersService) {
    this.db = db;
    this.invoicesService = invoicesService;
    this.logger = new Logger('PaymentsService');
  }

  /**
   * Create a new payment record
   */
  async createPayment(tenantContext: TenantContext, paymentData: {
    invoice_id: string;
    transaction_hash: string;
    amount: number;
    token_address: string;
    network: string;
    from_address: string;
    to_address: string;
    status?: PaymentStatus;
    confirmations?: number;
    block_number?: number;
    gas_used?: number;
  }): Promise<PaymentRecord> {
    this.logger.info('Creating payment', { 
      tenantId: tenantContext.tenantId, 
      invoiceId: paymentData.invoice_id,
      transactionHash: paymentData.transaction_hash,
      amount: paymentData.amount
    });

    // Validate invoice exists
    await this.invoicesService.getInvoiceById(tenantContext, paymentData.invoice_id);

    // Check if payment already exists for this transaction
    const existingPayment = await this.getPaymentByTxHash(tenantContext, paymentData.transaction_hash);
    if (existingPayment) {
      throw new FluxionError(
        ErrorCodes.CONFLICT,
        'Payment with this transaction hash already exists',
        409,
        { transactionHash: paymentData.transaction_hash, existingPaymentId: existingPayment.id }
      );
    }

    const paymentToCreate: Omit<PaymentRecord, 'id' | 'created_at' | 'updated_at'> = {
      tenant_id: tenantContext.tenantId,
      invoice_id: paymentData.invoice_id,
      transaction_hash: paymentData.transaction_hash,
      amount: paymentData.amount,
      token_address: paymentData.token_address,
      network: paymentData.network,
      from_address: paymentData.from_address,
      to_address: paymentData.to_address,
      status: paymentData.status || 'pending' as PaymentStatus,
      confirmations: paymentData.confirmations,
      block_number: paymentData.block_number,
      gas_used: paymentData.gas_used
    };

    try {
      const payment = await this.db.createPayment(tenantContext, paymentToCreate);
      
      // If payment is confirmed, update invoice status
      if (payment.status === 'confirmed') {
        await this.invoicesService.markInvoicePaid(tenantContext, payment.invoice_id, {
          transaction_hash: payment.transaction_hash,
          amount: payment.amount
        });
      }

      this.logger.info('Payment created successfully', { paymentId: payment.id });
      return payment;
    } catch (error: any) {
      this.logger.error('Failed to create payment', { error: error.message });
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(tenantContext: TenantContext, paymentId: string): Promise<PaymentRecord> {
    this.logger.info('Getting payment by ID', { paymentId, tenantId: tenantContext.tenantId });

    const payment = await this.db.getPaymentById(tenantContext, paymentId);
    if (!payment) {
      throw new FluxionError(
        ErrorCodes.NOT_FOUND,
        'Payment not found',
        404,
        { paymentId }
      );
    }

    return payment;
  }

  /**
   * Get payment by transaction hash
   */
  async getPaymentByTxHash(tenantContext: TenantContext, transactionHash: string): Promise<PaymentRecord | null> {
    this.logger.info('Getting payment by transaction hash', { transactionHash, tenantId: tenantContext.tenantId });

    // This would require a GSI on transaction_hash
    // For now, we'll return null and implement this when the GSI is added
    // In a real implementation, you'd query the PaymentsTable with GSI on transaction_hash
    return null;
  }

  /**
   * Get payments by invoice ID
   */
  async getPaymentsByInvoice(
    tenantContext: TenantContext, 
    invoiceId: string, 
    options: QueryOptions = {}
  ): Promise<MultiTableQueryResult<PaymentRecord>> {
    this.logger.info('Getting payments by invoice', { 
      invoiceId, 
      tenantId: tenantContext.tenantId, 
      options 
    });

    // Validate invoice exists
    await this.invoicesService.getInvoiceById(tenantContext, invoiceId);

    const result = await this.db.getPaymentsByInvoice(tenantContext, invoiceId, options);
    return result;
  }

  /**
   * Update payment status
   */
  async updatePayment(tenantContext: TenantContext, paymentId: string, updates: {
    status?: PaymentStatus;
    confirmations?: number;
    block_number?: number;
    gas_used?: number;
    confirmed_at?: string;
    failure_reason?: string;
  }): Promise<PaymentRecord> {
    this.logger.info('Updating payment', { paymentId, tenantId: tenantContext.tenantId });

    // Get current payment
    const currentPayment = await this.getPaymentById(tenantContext, paymentId);
    
    const updateData: any = {};

    if (updates.status) {
      updateData.status = updates.status;
    }

    if (updates.confirmations !== undefined) {
      updateData.confirmations = updates.confirmations;
    }

    if (updates.block_number !== undefined) {
      updateData.block_number = updates.block_number;
    }

    if (updates.gas_used !== undefined) {
      updateData.gas_used = updates.gas_used;
    }

    if (updates.confirmed_at) {
      updateData.confirmed_at = updates.confirmed_at;
    }

    if (updates.failure_reason) {
      updateData.failure_reason = updates.failure_reason;
    }

    try {
      const updatedPayment = await this.db.updatePayment(tenantContext, paymentId, updateData);
      
      // If payment is newly confirmed, update invoice status
      if (updates.status === 'confirmed' && currentPayment.status !== 'confirmed') {
        await this.invoicesService.markInvoicePaid(tenantContext, updatedPayment.invoice_id, {
          transaction_hash: updatedPayment.transaction_hash,
          amount: updatedPayment.amount
        });
      }

      this.logger.info('Payment updated successfully', { paymentId });
      return updatedPayment;
    } catch (error: any) {
      this.logger.error('Failed to update payment', { error: error.message, paymentId });
      throw error;
    }
  }

  /**
   * Confirm payment
   */
  async confirmPayment(tenantContext: TenantContext, paymentId: string, confirmationData: {
    confirmations: number;
    block_number: number;
    gas_used?: number;
  }): Promise<PaymentRecord> {
    this.logger.info('Confirming payment', { paymentId, tenantId: tenantContext.tenantId });

    const minConfirmations = parseInt(process.env.MIN_CONFIRMATIONS || '12');
    
    if (confirmationData.confirmations < minConfirmations) {
      throw new FluxionError(
        ErrorCodes.VALIDATION_ERROR,
        `Payment requires at least ${minConfirmations} confirmations`,
        400,
        { 
          required: minConfirmations, 
          current: confirmationData.confirmations 
        }
      );
    }

    return await this.updatePayment(tenantContext, paymentId, {
      status: 'confirmed',
      confirmations: confirmationData.confirmations,
      block_number: confirmationData.block_number,
      gas_used: confirmationData.gas_used,
      confirmed_at: new Date().toISOString()
    });
  }

  /**
   * Mark payment as failed
   */
  async markPaymentFailed(tenantContext: TenantContext, paymentId: string, failureReason: string): Promise<PaymentRecord> {
    this.logger.info('Marking payment as failed', { paymentId, tenantId: tenantContext.tenantId, failureReason });

    return await this.updatePayment(tenantContext, paymentId, {
      status: 'failed',
      failure_reason: failureReason
    });
  }

  /**
   * Process blockchain payment verification
   */
  async verifyBlockchainPayment(
    tenantContext: TenantContext,
    invoiceId: string,
    transactionHash: string,
    blockchainData: {
      from_address: string;
      to_address: string;
      amount: number;
      token_address: string;
      network: string;
      block_number: number;
      gas_used: number;
      confirmations: number;
    }
  ): Promise<PaymentRecord> {
    this.logger.info('Verifying blockchain payment', { 
      invoiceId, 
      transactionHash, 
      tenantId: tenantContext.tenantId 
    });

    // Get invoice to validate payment details
    const invoice = await this.invoicesService.getInvoiceById(tenantContext, invoiceId);

    // Validate payment amount matches invoice
    const expectedAmount = invoice.amounts.total;
    const tolerance = 0.01; // Allow small tolerance for gas/rounding
    
    if (Math.abs(blockchainData.amount - expectedAmount) > tolerance) {
      throw new FluxionError(
        ErrorCodes.VALIDATION_ERROR,
        'Payment amount does not match invoice total',
        400,
        { 
          expected: expectedAmount, 
          received: blockchainData.amount 
        }
      );
    }

    // Validate recipient address matches expected address
    if (invoice.blockchain_data?.recipient_address && 
        blockchainData.to_address.toLowerCase() !== invoice.blockchain_data.recipient_address.toLowerCase()) {
      throw new FluxionError(
        ErrorCodes.VALIDATION_ERROR,
        'Payment recipient address does not match invoice',
        400,
        { 
          expected: invoice.blockchain_data.recipient_address, 
          received: blockchainData.to_address 
        }
      );
    }

    // Check if payment already exists
    let payment = await this.getPaymentByTxHash(tenantContext, transactionHash);
    
    if (payment) {
      // Update existing payment with new confirmation data
      return await this.updatePayment(tenantContext, payment.id, {
        confirmations: blockchainData.confirmations,
        block_number: blockchainData.block_number,
        gas_used: blockchainData.gas_used,
        status: blockchainData.confirmations >= 12 ? 'confirmed' : 'pending'
      });
    } else {
      // Create new payment record
      return await this.createPayment(tenantContext, {
        invoice_id: invoiceId,
        transaction_hash: transactionHash,
        amount: blockchainData.amount,
        token_address: blockchainData.token_address,
        network: blockchainData.network,
        from_address: blockchainData.from_address,
        to_address: blockchainData.to_address,
        status: blockchainData.confirmations >= 12 ? 'confirmed' : 'pending',
        confirmations: blockchainData.confirmations,
        block_number: blockchainData.block_number,
        gas_used: blockchainData.gas_used
      });
    }
  }

  /**
   * Get payment statistics for an invoice
   */
  async getInvoicePaymentStats(tenantContext: TenantContext, invoiceId: string): Promise<{
    total_payments: number;
    total_amount: number;
    confirmed_payments: number;
    confirmed_amount: number;
    pending_payments: number;
    pending_amount: number;
    is_fully_paid: boolean;
  }> {
    this.logger.info('Getting payment stats for invoice', { invoiceId, tenantId: tenantContext.tenantId });

    const invoice = await this.invoicesService.getInvoiceById(tenantContext, invoiceId);
    const paymentsResult = await this.getPaymentsByInvoice(tenantContext, invoiceId, { limit: 100 });
    const payments = paymentsResult.items;

    const confirmedPayments = payments.filter(p => p.status === 'confirmed');
    const pendingPayments = payments.filter(p => p.status === 'pending');

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const confirmedAmount = confirmedPayments.reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    const stats = {
      total_payments: payments.length,
      total_amount: totalAmount,
      confirmed_payments: confirmedPayments.length,
      confirmed_amount: confirmedAmount,
      pending_payments: pendingPayments.length,
      pending_amount: pendingAmount,
      is_fully_paid: confirmedAmount >= invoice.amounts.total
    };

    return stats;
  }

  /**
   * Get payment history for a user
   */
  async getUserPaymentHistory(
    tenantContext: TenantContext, 
    userId: string, 
    options: QueryOptions = {}
  ): Promise<MultiTableQueryResult<PaymentRecord & { invoice?: { id: string; client_info: { name: string; email: string } } }>> {
    this.logger.info('Getting payment history for user', { userId, tenantId: tenantContext.tenantId });

    // Get user's invoices first
    const invoicesResult = await this.invoicesService.getInvoicesByUser(tenantContext, userId, { limit: 1000 });
    const invoiceIds = invoicesResult.items.map(inv => inv.id);

    // Get all payments for these invoices
    const allPayments: PaymentRecord[] = [];
    
    for (const invoiceId of invoiceIds) {
      const paymentsResult = await this.getPaymentsByInvoice(tenantContext, invoiceId, { limit: 100 });
      allPayments.push(...paymentsResult.items);
    }

    // Sort by creation date (newest first)
    allPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply pagination
    const limit = options.limit || 50;
    let startIndex = 0;
    
    if (options.nextToken) {
      try {
        const tokenData = JSON.parse(Buffer.from(options.nextToken, 'base64').toString());
        startIndex = tokenData.index || 0;
      } catch (error) {
        startIndex = 0;
      }
    }

    const endIndex = startIndex + limit;
    const paginatedPayments = allPayments.slice(startIndex, endIndex);
    
    // Enrich with invoice data
    const enrichedPayments = paginatedPayments.map(payment => {
      const invoice = invoicesResult.items.find(inv => inv.id === payment.invoice_id);
      return {
        ...payment,
        invoice: invoice ? {
          id: invoice.id,
          client_info: invoice.client_info
        } : undefined
      };
    });

    const nextToken = endIndex < allPayments.length 
      ? Buffer.from(JSON.stringify({ index: endIndex })).toString('base64')
      : undefined;

    return {
      items: enrichedPayments,
      nextToken
    };
  }

  /**
   * Check if payment is valid for processing
   */
  async validatePaymentForProcessing(tenantContext: TenantContext, paymentId: string): Promise<{
    isValid: boolean;
    reason?: string;
    payment: PaymentRecord;
    invoice: any;
  }> {
    const payment = await this.getPaymentById(tenantContext, paymentId);
    const invoice = await this.invoicesService.getInvoiceById(tenantContext, payment.invoice_id);

    // Check if invoice is still payable
    if (invoice.status === 'paid') {
      return {
        isValid: false,
        reason: 'Invoice is already paid',
        payment,
        invoice
      };
    }

    if (invoice.status === 'cancelled') {
      return {
        isValid: false,
        reason: 'Invoice has been cancelled',
        payment,
        invoice
      };
    }

    // Check if invoice is expired
    if (this.invoicesService.isInvoiceExpired(invoice)) {
      return {
        isValid: false,
        reason: 'Invoice has expired',
        payment,
        invoice
      };
    }

    return {
      isValid: true,
      payment,
      invoice
    };
  }
}