import { FindOptionsWhere } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { Payment } from '../entities/Payment';
import { TenantContext, FluxionError, ErrorCodes, QueryOptions } from '@/types/common';

export class PaymentRepository extends BaseRepository<Payment> {
  constructor() {
    super(Payment, 'Payment');
  }

  /**
   * Find payment by transaction hash and network
   */
  async findByTxHash(tenantContext: TenantContext, txHash: string, networkId: string): Promise<Payment | null> {
    await this.setTenantContext(tenantContext);
    
    try {
      const payment = await this.repository.findOne({
        where: {
          txHash,
          networkId,
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<Payment>,
        relations: ['network', 'token', 'invoice'],
      });
      
      this.logger.debug('Payment search by tx hash', { 
        txHash, 
        networkId,
        found: !!payment,
        tenantId: tenantContext.tenantId,
      });
      
      return payment;
    } catch (error: any) {
      this.logger.error('Failed to find payment by tx hash', { 
        error: error.message, 
        txHash,
        networkId,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find payment by transaction hash',
        500,
        error
      );
    }
  }

  /**
   * Find payments by invoice ID
   */
  async findByInvoiceId(tenantContext: TenantContext, invoiceId: string): Promise<Payment[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      const payments = await this.repository.find({
        where: {
          invoiceId,
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<Payment>,
        relations: ['network', 'token'],
        order: {
          createdAt: 'DESC',
        },
      });
      
      this.logger.debug('Payments by invoice retrieved', { 
        invoiceId,
        count: payments.length,
        tenantId: tenantContext.tenantId,
      });
      
      return payments;
    } catch (error: any) {
      this.logger.error('Failed to find payments by invoice', { 
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find payments by invoice',
        500,
        error
      );
    }
  }

  /**
   * Find pending payments for monitoring
   */
  async findPendingPayments(tenantContext: TenantContext): Promise<Payment[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      const payments = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
          status: 'pending',
        } as FindOptionsWhere<Payment>,
        relations: ['network', 'token', 'invoice'],
        order: {
          createdAt: 'ASC',
        },
      });
      
      this.logger.debug('Pending payments retrieved', { 
        count: payments.length,
        tenantId: tenantContext.tenantId,
      });
      
      return payments;
    } catch (error: any) {
      this.logger.error('Failed to find pending payments', { 
        error: error.message,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find pending payments',
        500,
        error
      );
    }
  }
}