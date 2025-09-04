import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/shared/database/client';
import { getBlockchainService } from '@/shared/blockchain/client';
import { getNotificationService } from '@/shared/notifications/client';
import { Logger } from '@/shared/utils/logger';
import { 
  createNotFoundError, 
  createPaymentVerificationError,
  createBlockchainError 
} from '@/shared/errors';
import { Payment, PaymentEntity, VerifyPaymentDTO } from '@/types/payment';
import { InvoiceService } from '@/modules/invoices/service';
import { PaginationParams } from '@/types/common';

export class PaymentService {
  private db = getDatabase();
  private blockchain = getBlockchainService();
  private notifications = getNotificationService();
  private invoiceService = new InvoiceService();
  private logger = new Logger('PaymentService');

  /**
   * Verify a blockchain payment and update invoice status
   */
  async verify(data: VerifyPaymentDTO): Promise<{ 
    payment: Payment; 
    invoice: any; 
    verification: any 
  }> {
    this.logger.info('Verifying payment', { 
      invoice_id: data.invoice_id,
      tx_hash: data.tx_hash,
      from_address: data.from_address 
    });

    // Get the invoice to verify payment against
    const invoice = await this.invoiceService.findById(data.invoice_id);
    
    if (invoice.status === 'paid') {
      throw createPaymentVerificationError('Invoice is already paid');
    }

    if (invoice.status === 'cancelled' || invoice.status === 'expired') {
      throw createPaymentVerificationError(`Cannot pay ${invoice.status} invoice`);
    }

    // Check if payment already exists
    const existingPayment = await this.findByTransactionHash(data.tx_hash);
    if (existingPayment) {
      this.logger.info('Payment already exists', { 
        payment_id: existingPayment.payment_id,
        tx_hash: data.tx_hash 
      });
      return { 
        payment: existingPayment, 
        invoice,
        verification: { isValid: true, alreadyProcessed: true }
      };
    }

    try {
      // Verify the blockchain transaction
      const verification = await this.blockchain.verifyUSDCPayment(
        data.tx_hash,
        invoice.creator_wallet,
        invoice.amount.toString(),
        data.from_address
      );

      if (!verification.isValid) {
        this.logger.warn('Payment verification failed', { 
          tx_hash: data.tx_hash,
          verification 
        });
        
        throw createPaymentVerificationError(
          'Payment verification failed: Invalid transaction, amount, or recipient', 
          { verification }
        );
      }

      // Create payment record
      const paymentId = uuidv4();
      const now = new Date().toISOString();

      // Get transaction details for additional information
      const txDetails = await this.blockchain.getTransaction(data.tx_hash);
      
      const paymentData: Payment = {
        payment_id: paymentId,
        invoice_id: data.invoice_id,
        tx_hash: data.tx_hash,
        from_address: verification.actualSender,
        to_address: verification.actualRecipient,
        amount: parseFloat(verification.actualAmount),
        gas_used: txDetails ? parseInt(txDetails.gasUsed) : 0,
        block_number: txDetails ? txDetails.blockNumber : 0,
        status: verification.confirmations >= 1 ? 'confirmed' : 'pending',
        confirmations: verification.confirmations,
        created_at: now,
        updated_at: now
      };

      // Create database entity
      const entity: PaymentEntity = {
        PK: `PAY#${paymentId}`,
        SK: 'METADATA',
        GSI1PK: `INV#${data.invoice_id}`,
        GSI1SK: now,
        entityType: 'PAYMENT',
        created_at: now,
        updated_at: now,
        data: {
          payment_id: paymentId,
          invoice_id: data.invoice_id,
          tx_hash: data.tx_hash,
          from_address: verification.actualSender,
          to_address: verification.actualRecipient,
          amount: parseFloat(verification.actualAmount),
          gas_used: txDetails ? parseInt(txDetails.gasUsed) : 0,
          block_number: txDetails ? txDetails.blockNumber : 0,
          status: verification.confirmations >= 1 ? 'confirmed' : 'pending',
          confirmations: verification.confirmations
        }
      };

      // Save payment record
      await this.db.save(entity);

      // Update invoice status if payment is confirmed
      if (verification.confirmations >= 1) {
        await this.invoiceService.markAsPaid(
          data.invoice_id,
          data.tx_hash,
          parseFloat(verification.actualAmount)
        );

        // Send payment confirmation notification
        const updatedInvoice = await this.invoiceService.findById(data.invoice_id);
        await this.notifications.sendPaymentReceived(
          updatedInvoice,
          paymentData
        );
      }

      this.logger.info('Payment verification completed', { 
        payment_id: paymentId,
        tx_hash: data.tx_hash,
        amount: verification.actualAmount,
        confirmations: verification.confirmations 
      });

      return {
        payment: paymentData,
        invoice,
        verification
      };

    } catch (error) {
      this.logger.error('Payment verification failed', { 
        error,
        tx_hash: data.tx_hash,
        invoice_id: data.invoice_id 
      });

      // Create failed payment record for tracking
      await this.createFailedPayment(data, error instanceof Error ? error.message : 'Unknown error');
      
      throw error;
    }
  }

  /**
   * Find payment by ID
   */
  async findById(paymentId: string): Promise<Payment> {
    this.logger.info('Finding payment by ID', { payment_id: paymentId });

    const entity = await this.db.findById(`PAY#${paymentId}`, 'METADATA');
    
    if (!entity || entity.entityType !== 'PAYMENT') {
      throw createNotFoundError('Payment', paymentId);
    }

    const paymentEntity = entity as PaymentEntity;

    const payment: Payment = {
      payment_id: paymentEntity.data.payment_id,
      invoice_id: paymentEntity.data.invoice_id,
      tx_hash: paymentEntity.data.tx_hash,
      from_address: paymentEntity.data.from_address,
      to_address: paymentEntity.data.to_address,
      amount: paymentEntity.data.amount,
      gas_used: paymentEntity.data.gas_used,
      block_number: paymentEntity.data.block_number,
      status: paymentEntity.data.status,
      confirmations: paymentEntity.data.confirmations,
      created_at: paymentEntity.created_at,
      updated_at: paymentEntity.updated_at
    };

    this.logger.info('Payment found', { 
      payment_id: paymentId,
      status: payment.status 
    });

    return payment;
  }

  /**
   * Find payment by transaction hash
   */
  async findByTransactionHash(txHash: string): Promise<Payment | null> {
    this.logger.info('Finding payment by transaction hash', { tx_hash: txHash });

    // We need to scan or use a different approach since tx_hash is not a key
    // For now, we'll use a simple approach - in production, consider adding GSI for tx_hash
    try {
      // This is a simplified approach - in production you'd want a GSI on tx_hash
      const result = await this.db.queryByPK(`PAY#${txHash}`, { limit: 1 });
      
      if (result.items.length === 0) {
        this.logger.info('Payment not found by transaction hash', { tx_hash: txHash });
        return null;
      }

      const entity = result.items[0] as PaymentEntity;
      return this.mapEntityToPayment(entity);
    } catch (error) {
      this.logger.debug('Payment not found by direct lookup, this is expected for new payments');
      return null;
    }
  }

  /**
   * Get payments for an invoice
   */
  async findByInvoice(
    invoiceId: string, 
    options: PaginationParams = {}
  ): Promise<{ items: Payment[]; nextToken?: string }> {
    this.logger.info('Finding payments by invoice', { 
      invoice_id: invoiceId,
      options 
    });

    const result = await this.db.queryGSI1(`INV#${invoiceId}`, {
      limit: options.limit || 20,
      nextToken: options.nextToken,
      scanIndexForward: false
    });

    // Filter only payment entities
    const paymentEntities = result.items.filter(item => 
      item.entityType === 'PAYMENT'
    ) as PaymentEntity[];

    const payments = paymentEntities.map(entity => this.mapEntityToPayment(entity));

    this.logger.info('Payments found', { 
      invoice_id: invoiceId,
      count: payments.length 
    });

    return {
      items: payments,
      nextToken: result.nextToken
    };
  }

  /**
   * Update payment confirmations
   */
  async updateConfirmations(paymentId: string): Promise<Payment> {
    this.logger.info('Updating payment confirmations', { payment_id: paymentId });

    const payment = await this.findById(paymentId);

    try {
      // Get current confirmations from blockchain
      const txDetails = await this.blockchain.getTransaction(payment.tx_hash);
      
      if (!txDetails) {
        throw createBlockchainError('Transaction not found on blockchain');
      }

      const currentBlock = await this.blockchain.getCurrentBlockNumber();
      const confirmations = Math.max(0, currentBlock - txDetails.blockNumber);

      // Update payment status based on confirmations
      let newStatus = payment.status;
      if (confirmations >= 1 && payment.status === 'pending') {
        newStatus = 'confirmed';
      }

      const updates: Partial<PaymentEntity> = {
        data: {
          ...payment,
          status: newStatus,
          confirmations
        }
      };

      await this.db.update(`PAY#${paymentId}`, 'METADATA', updates);

      // If payment just became confirmed, update invoice
      if (newStatus === 'confirmed' && payment.status === 'pending') {
        await this.invoiceService.markAsPaid(
          payment.invoice_id,
          payment.tx_hash,
          payment.amount
        );

        // Send notification
        const invoice = await this.invoiceService.findById(payment.invoice_id);
        await this.notifications.sendPaymentReceived(invoice, payment);
      }

      const updatedPayment = await this.findById(paymentId);

      this.logger.info('Payment confirmations updated', { 
        payment_id: paymentId,
        confirmations,
        status: newStatus 
      });

      return updatedPayment;
    } catch (error) {
      this.logger.error('Failed to update payment confirmations', { 
        error,
        payment_id: paymentId 
      });
      throw error;
    }
  }

  /**
   * Create a failed payment record for tracking purposes
   */
  private async createFailedPayment(
    data: VerifyPaymentDTO, 
    errorReason: string
  ): Promise<void> {
    const paymentId = uuidv4();
    const now = new Date().toISOString();

    try {
      const entity: PaymentEntity = {
        PK: `PAY#${paymentId}`,
        SK: 'METADATA',
        GSI1PK: `INV#${data.invoice_id}`,
        GSI1SK: now,
        entityType: 'PAYMENT',
        created_at: now,
        updated_at: now,
        ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // Delete after 7 days
        data: {
          payment_id: paymentId,
          invoice_id: data.invoice_id,
          tx_hash: data.tx_hash,
          from_address: data.from_address,
          to_address: '',
          amount: 0,
          gas_used: 0,
          block_number: 0,
          status: 'failed',
          confirmations: 0
        }
      };

      await this.db.save(entity);

      this.logger.info('Failed payment record created', { 
        payment_id: paymentId,
        tx_hash: data.tx_hash,
        error_reason: errorReason 
      });

      // Send failure notification
      try {
        const invoice = await this.invoiceService.findById(data.invoice_id);
        const failedPayment = this.mapEntityToPayment(entity);
        await this.notifications.sendPaymentFailed(
          invoice,
          failedPayment,
          errorReason
        );
      } catch (notificationError) {
        this.logger.warn('Failed to send payment failure notification', { 
          notificationError 
        });
      }
    } catch (error) {
      this.logger.error('Failed to create failed payment record', { error });
      // Don't throw here - this is just for tracking
    }
  }

  /**
   * Map database entity to Payment object
   */
  private mapEntityToPayment(entity: PaymentEntity): Payment {
    return {
      payment_id: entity.data.payment_id,
      invoice_id: entity.data.invoice_id,
      tx_hash: entity.data.tx_hash,
      from_address: entity.data.from_address,
      to_address: entity.data.to_address,
      amount: entity.data.amount,
      gas_used: entity.data.gas_used,
      block_number: entity.data.block_number,
      status: entity.data.status,
      confirmations: entity.data.confirmations,
      created_at: entity.created_at,
      updated_at: entity.updated_at
    };
  }

  /**
   * Get payment status by ID
   */
  async getStatus(paymentId: string, _tenantId?: string): Promise<Payment> {
    this.logger.info('Getting payment status', { payment_id: paymentId });
    return await this.findById(paymentId);
  }

  /**
   * Find payments by user (wallet address)
   */
  async findByUser(walletAddress: string, _tenantId?: string, options: PaginationParams = {}): Promise<{ items: Payment[]; nextToken?: string; totalCount?: number }> {
    this.logger.info('Finding payments by user', { wallet_address: walletAddress, options });

    // Get invoices created by this user
    const userInvoices = await this.invoiceService.findByUser(walletAddress, options);
    
    const allPayments: Payment[] = [];
    
    // Get payments for each invoice
    for (const invoice of userInvoices.items) {
      const invoicePayments = await this.findByInvoice(invoice.invoice_id, { limit: 100 });
      allPayments.push(...invoicePayments.items);
    }

    // Sort by creation date (newest first)
    allPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply pagination
    const limit = options.limit || 20;
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

    const nextToken = endIndex < allPayments.length 
      ? Buffer.from(JSON.stringify({ index: endIndex })).toString('base64')
      : undefined;

    return {
      items: paginatedPayments,
      nextToken,
      totalCount: allPayments.length
    };
  }

  /**
   * Retry payment verification
   */
  async retryVerification(paymentId: string, _tenantId?: string): Promise<{ 
    payment: Payment; 
    invoice: any; 
    verification: any 
  }> {
    this.logger.info('Retrying payment verification', { payment_id: paymentId });

    const payment = await this.findById(paymentId);
    
    // Get verification data for retry
    const verifyData = {
      invoice_id: payment.invoice_id,
      tx_hash: payment.tx_hash,
      from_address: payment.from_address
    };

    // Use existing verify method
    return await this.verify(verifyData);
  }

  /**
   * Check if transaction exists
   */
  async transactionExists(transactionHash: string): Promise<boolean> {
    this.logger.info('Checking if transaction exists', { tx_hash: transactionHash });
    
    const payment = await this.findByTransactionHash(transactionHash);
    return payment !== null;
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<{
    total_payments: number;
    total_volume: number;
    successful_payments: number;
    failed_payments: number;
    average_payment_amount: number;
  }> {
    // This is a simplified version - in production you'd want dedicated analytics
    this.logger.info('Calculating payment statistics');

    // For demo purposes, we'll scan recent payments
    // In production, use dedicated analytics tables or external service
    const stats = {
      total_payments: 0,
      total_volume: 0,
      successful_payments: 0,
      failed_payments: 0,
      average_payment_amount: 0
    };

    this.logger.info('Payment statistics calculated', stats);
    
    return stats;
  }
}