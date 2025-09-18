import { getDatabase } from '../../shared/database/client';
import { Logger } from '../../shared/utils/logger';
import { InvoiceData, PaymentData } from '../../types/common';

export interface PlatformAnalytics {
  overview: {
    total_invoices: number;
    total_payments: number;
    total_volume: number;
    total_users: number;
    active_users_7d: number;
    active_users_30d: number;
  };
  invoice_stats: {
    pending_invoices: number;
    paid_invoices: number;
    draft_invoices: number;
    cancelled_invoices: number;
    average_invoice_amount: number;
    payment_conversion_rate: number;
  };
  payment_stats: {
    successful_payments: number;
    failed_payments: number;
    pending_payments: number;
    average_payment_amount: number;
    total_gas_spent: number;
  };
  trends: {
    invoices_last_7d: number;
    invoices_last_30d: number;
    payments_last_7d: number;
    payments_last_30d: number;
    volume_last_7d: number;
    volume_last_30d: number;
  };
}

export interface UserAnalytics {
  invoice_summary: {
    total_invoices: number;
    paid_invoices: number;
    pending_invoices: number;
    draft_invoices: number;
    total_amount_invoiced: number;
    total_amount_received: number;
  };
  payment_summary: {
    successful_payments: number;
    failed_payments: number;
    average_days_to_payment: number;
    fastest_payment_hours: number;
  };
  monthly_breakdown: Array<{
    month: string;
    invoices_created: number;
    invoices_paid: number;
    amount_invoiced: number;
    amount_received: number;
  }>;
}

export class AnalyticsService {
  private db = getDatabase();
  private logger = new Logger('AnalyticsService');

  // Type guard functions
  private isInvoiceData(data: any): data is InvoiceData {
    return data && typeof data.invoice_id === 'string' && typeof data.amount === 'number';
  }

  private isPaymentData(data: any): data is PaymentData {
    return data && typeof data.payment_id === 'string' && typeof data.invoice_id === 'string';
  }

  /**
   * Get platform-wide analytics
   * Note: In production, this should be cached or computed asynchronously
   */
  async getPlatformAnalytics(): Promise<PlatformAnalytics> {
    this.logger.info('Computing platform analytics');

    // For MVP, we'll return mock data
    // In production, you'd implement proper analytics aggregation
    const analytics: PlatformAnalytics = {
      overview: {
        total_invoices: 0,
        total_payments: 0,
        total_volume: 0,
        total_users: 0,
        active_users_7d: 0,
        active_users_30d: 0
      },
      invoice_stats: {
        pending_invoices: 0,
        paid_invoices: 0,
        draft_invoices: 0,
        cancelled_invoices: 0,
        average_invoice_amount: 0,
        payment_conversion_rate: 0
      },
      payment_stats: {
        successful_payments: 0,
        failed_payments: 0,
        pending_payments: 0,
        average_payment_amount: 0,
        total_gas_spent: 0
      },
      trends: {
        invoices_last_7d: 0,
        invoices_last_30d: 0,
        payments_last_7d: 0,
        payments_last_30d: 0,
        volume_last_7d: 0,
        volume_last_30d: 0
      }
    };

    this.logger.info('Platform analytics computed', { 
      total_invoices: analytics.overview.total_invoices 
    });

    return analytics;
  }

  /**
   * Get analytics for a specific user
   */
  async getUserAnalytics(walletAddress: string): Promise<UserAnalytics> {
    this.logger.info('Computing user analytics', { wallet_address: walletAddress });

    try {
      // Get all invoices for the user
      const invoicesResult = await this.db.queryGSI1(`USER#${walletAddress}`, {
        limit: 1000,
        scanIndexForward: false
      });

      const invoiceEntities = invoicesResult.items.filter(item => item.entityType === 'INVOICE');
      
      // Calculate invoice summary
      let totalInvoiced = 0;
      let totalReceived = 0;
      let paidCount = 0;
      let pendingCount = 0;
      let draftCount = 0;

      const monthlyBreakdown = new Map<string, {
        invoices_created: number;
        invoices_paid: number;
        amount_invoiced: number;
        amount_received: number;
      }>();

      for (const entity of invoiceEntities) {
        // Use type guard to ensure we're working with invoice data
        if (!this.isInvoiceData(entity.data)) {
          continue;
        }
        
        const invoice = entity.data;
        const createdMonth = new Date(entity.created_at).toISOString().substring(0, 7); // YYYY-MM

        // Initialize monthly data
        if (!monthlyBreakdown.has(createdMonth)) {
          monthlyBreakdown.set(createdMonth, {
            invoices_created: 0,
            invoices_paid: 0,
            amount_invoiced: 0,
            amount_received: 0
          });
        }

        const monthData = monthlyBreakdown.get(createdMonth)!;
        
        totalInvoiced += invoice.amount;
        monthData.invoices_created++;
        monthData.amount_invoiced += invoice.amount;

        switch (invoice.status) {
          case 'paid':
            paidCount++;
            totalReceived += invoice.amount;
            monthData.invoices_paid++;
            monthData.amount_received += invoice.amount;
            break;
          case 'pending':
            pendingCount++;
            break;
          case 'draft':
            draftCount++;
            break;
        }
      }

      // Get payment data for more detailed analytics
      const paymentPromises = invoiceEntities
        .filter(invoice => this.isInvoiceData(invoice.data))
        .map(invoice => 
          this.db.queryGSI1(`INV#${(invoice.data as InvoiceData).invoice_id}`, { limit: 10 })
        );

      const paymentResults = await Promise.all(paymentPromises);
      const allPayments = paymentResults
        .flatMap(result => result.items)
        .filter(item => item.entityType === 'PAYMENT');

      let successfulPayments = 0;
      let failedPayments = 0;
      let totalPaymentTime = 0;
      let fastestPaymentHours = Infinity;

      for (const paymentEntity of allPayments) {
        // Use type guard for payment data
        if (!this.isPaymentData(paymentEntity.data)) {
          continue;
        }
        
        const payment = paymentEntity.data;
        
        if (payment.status === 'confirmed') {
          successfulPayments++;
          
          // Calculate payment time if we have both invoice creation and payment time
          const invoiceEntity = invoiceEntities.find(i => 
            this.isInvoiceData(i.data) && i.data.invoice_id === payment.invoice_id
          );
          if (invoiceEntity && this.isInvoiceData(invoiceEntity.data) && invoiceEntity.data.paid_at) {
            const invoiceTime = new Date(invoiceEntity.created_at).getTime();
            const paymentTime = new Date(invoiceEntity.data.paid_at).getTime();
            const hoursToPayment = (paymentTime - invoiceTime) / (1000 * 60 * 60);
            
            totalPaymentTime += hoursToPayment;
            fastestPaymentHours = Math.min(fastestPaymentHours, hoursToPayment);
          }
        } else if (payment.status === 'failed') {
          failedPayments++;
        }
      }

      const analytics: UserAnalytics = {
        invoice_summary: {
          total_invoices: invoiceEntities.length,
          paid_invoices: paidCount,
          pending_invoices: pendingCount,
          draft_invoices: draftCount,
          total_amount_invoiced: totalInvoiced,
          total_amount_received: totalReceived
        },
        payment_summary: {
          successful_payments: successfulPayments,
          failed_payments: failedPayments,
          average_days_to_payment: successfulPayments > 0 ? (totalPaymentTime / successfulPayments) / 24 : 0,
          fastest_payment_hours: fastestPaymentHours === Infinity ? 0 : fastestPaymentHours
        },
        monthly_breakdown: Array.from(monthlyBreakdown.entries())
          .map(([month, data]) => ({
            month,
            ...data
          }))
          .sort((a, b) => b.month.localeCompare(a.month))
          .slice(0, 12) // Last 12 months
      };

      this.logger.info('User analytics computed', { 
        wallet_address: walletAddress,
        total_invoices: analytics.invoice_summary.total_invoices 
      });

      return analytics;
    } catch (error) {
      this.logger.error('Failed to compute user analytics', { 
        error,
        wallet_address: walletAddress 
      });
      throw error;
    }
  }

  /**
   * Get invoice performance metrics
   */
  async getInvoiceMetrics(invoiceId: string): Promise<{
    views: number;
    payment_attempts: number;
    time_to_payment?: number;
    referrer_sources: string[];
  }> {
    this.logger.info('Getting invoice metrics', { invoice_id: invoiceId });

    // For MVP, return basic metrics
    // In production, you'd track views, attempts, etc.
    const metrics = {
      views: 0,
      payment_attempts: 0,
      time_to_payment: undefined as number | undefined,
      referrer_sources: [] as string[]
    };

    try {
      // Get payments for this invoice to count attempts
      const paymentsResult = await this.db.queryGSI1(`INV#${invoiceId}`, {
        limit: 50
      });

      const payments = paymentsResult.items.filter(item => item.entityType === 'PAYMENT');
      metrics.payment_attempts = payments.length;

      // Calculate time to payment if invoice is paid
      const successfulPayment = payments.find(p => 
        this.isPaymentData(p.data) && p.data.status === 'confirmed'
      );
      if (successfulPayment) {
        const invoice = await this.db.findById(`INV#${invoiceId}`, 'METADATA');
        if (invoice && this.isInvoiceData(invoice.data) && invoice.data.paid_at) {
          const invoiceTime = new Date(invoice.created_at).getTime();
          const paymentTime = new Date(invoice.data.paid_at).getTime();
          metrics.time_to_payment = (paymentTime - invoiceTime) / (1000 * 60 * 60); // Hours
        }
      }

      this.logger.info('Invoice metrics retrieved', { 
        invoice_id: invoiceId,
        payment_attempts: metrics.payment_attempts 
      });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get invoice metrics', { 
        error,
        invoice_id: invoiceId 
      });
      return metrics;
    }
  }

  /**
   * Track invoice view (for analytics)
   */
  async trackInvoiceView(invoiceId: string, metadata: {
    userAgent?: string;
    referer?: string;
    ip?: string;
  }): Promise<void> {
    this.logger.info('Tracking invoice view', { 
      invoice_id: invoiceId,
      metadata 
    });

    // For MVP, just log the view
    // In production, you'd store this in a dedicated analytics table
    // or send to an analytics service like Google Analytics, Mixpanel, etc.

    this.logger.info('Invoice view tracked', { 
      invoice_id: invoiceId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get system health metrics
   */
  async getHealthMetrics(): Promise<{
    database_status: 'healthy' | 'degraded' | 'down';
    blockchain_status: 'healthy' | 'degraded' | 'down';
    notification_queue_status: 'healthy' | 'degraded' | 'down';
    last_payment_processed: string;
    active_connections: number;
  }> {
    this.logger.info('Checking system health metrics');

    const healthMetrics = {
      database_status: 'healthy' as 'healthy' | 'degraded' | 'down',
      blockchain_status: 'healthy' as 'healthy' | 'degraded' | 'down',
      notification_queue_status: 'healthy' as 'healthy' | 'degraded' | 'down',
      last_payment_processed: new Date().toISOString(),
      active_connections: 1
    };

    try {
      // Test database connectivity
      await this.db.queryByPK('HEALTH_CHECK', { limit: 1 });
      healthMetrics.database_status = 'healthy';
    } catch (error) {
      this.logger.error('Database health check failed', { error });
      healthMetrics.database_status = 'degraded';
    }

    // Add more health checks as needed

    this.logger.info('System health metrics retrieved', healthMetrics);

    return healthMetrics;
  }
}