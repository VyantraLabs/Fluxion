import { repositories } from '@/database/repositories';
import { Invoice, InvoiceStatus } from '@/database/entities/Invoice';
import { Logger } from '@/shared/utils/logger';
import { 
  FluxionError,
  ErrorCodes,
  TenantContext,
  QueryOptions
} from '@/types/common';
import { config } from '@/config';
import { NotificationService } from '@/modules/notifications/service';

export interface CreateInvoiceDto {
  title: string;
  description: string;
  amount: number;
  dueDate: string; // ISO date string
  clientEmail: string;
  clientName: string;
  clientWallet?: string;
  networkId: string;
  tokenId: string;
  status?: 'draft' | 'created' | 'initiated' | 'sent';
}

export interface PublicInvoiceDto {
  id: string;
  title: string;
  description?: string;
  amount: string;
  dueDate?: Date;
  clientName?: string;
  clientEmail?: string;
  status: InvoiceStatus;
  networkId: string;
  tokenId: string;
  network?: any;
  token?: any;
  paymentUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedResult<T> {
  items: T[];
  total?: number;
  nextToken?: string;
}

export interface InvoiceStatsResponse {
  total: number;
  byStatus: Record<string, number>;
  totalAmount: string;
  totalPaidAmount: string;
  overdue: number;
  dueSoon: number;
}

export class InvoiceService {
  private logger = new Logger('InvoiceService');
  private invoiceRepository = repositories.invoices;
  private userRepository = repositories.users;
  private organizationRepository = repositories.organizations;
  private notificationService = new NotificationService();

  /**
   * Create a new invoice
   */
  async createInvoice(tenantContext: TenantContext, userId: string, data: CreateInvoiceDto): Promise<Invoice> {
    this.logger.info('Creating invoice', { 
      userId,
      amount: data.amount,
      tenantId: tenantContext.tenantId
    });

    try {
      // Get organization for invoice number generation
      const organization = await this.organizationRepository.findById(tenantContext, tenantContext.tenantId);
      if (!organization) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Organization not found', 404);
      }

      // Verify the user exists (userId should be from JWT token)
      const user = await this.userRepository.findById(tenantContext, userId);
      if (!user) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'User not found', 404);
      }

      // Generate invoice number
      const invoiceNumber = await this.invoiceRepository.generateInvoiceNumber(
        tenantContext,
        organization.slug
      );

      // Create invoice with specified status
      const invoiceStatus = data.status || 'draft';
      
      const invoice = await this.invoiceRepository.create(tenantContext, {
        invoiceNumber,
        title: data.title || 'Untitled Draft',
        description: data.description || '',
        clientName: data.clientName || '',
        clientEmail: data.clientEmail || '',
        clientWallet: data.clientWallet,
        amount: data.amount !== undefined ? data.amount.toString() : (invoiceStatus === 'draft' ? '0.01' : '0'),
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
        chainId: data.networkId || 137, // Default to Polygon
        tokenId: data.tokenId || '01K4FSGT1H900EYCV2DNY21710', // Default USDC on Polygon
        createdBy: userId, // Use the userId directly
        status: invoiceStatus,
      });

      this.logger.info('Invoice created successfully', { 
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        userId,
        tenantId: tenantContext.tenantId
      });

      // Send notification if client email is provided
      if (data.clientEmail) {
        try {
          await this.notificationService.sendNotification(tenantContext, {
            type: 'invoice_sent',
            recipientEmail: data.clientEmail,
            templateData: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              invoiceTitle: data.title,
              invoiceAmount: data.amount.toString(),
              invoiceStatus: invoice.status,
              invoiceDueDate: data.dueDate,
              paymentUrl: `${config.frontend?.url || 'https://fluxion.app'}/invoice/${invoice.id}`,
              recipientName: data.clientName || data.clientEmail,
              recipientEmail: data.clientEmail,
              clientName: data.clientName || data.clientEmail,
              senderName: user.displayName || user.wallet_address,
              companyName: organization.name,
              systemUrl: config.frontend?.url || 'https://fluxion.app',
              supportEmail: config.email?.supportEmail || 'support@fluxion.app',
            },
            priority: 'medium'
          });

          this.logger.info('Invoice notification sent', {
            invoiceId: invoice.id,
            recipient: data.clientEmail,
            tenantId: tenantContext.tenantId
          });
        } catch (notificationError: any) {
          // Don't fail invoice creation if notification fails
          this.logger.error('Failed to send invoice notification', {
            error: notificationError.message,
            invoiceId: invoice.id,
            recipient: data.clientEmail,
            tenantId: tenantContext.tenantId
          });
        }
      }

      return invoice;
    } catch (error: any) {
      this.logger.error('Failed to create invoice', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get invoice by ID (authenticated)
   */
  async getInvoiceById(tenantContext: TenantContext, invoiceId: string): Promise<Invoice> {
    this.logger.info('Finding invoice by ID', { 
      invoiceId,
      tenantId: tenantContext.tenantId
    });

    try {
      const invoice = await this.invoiceRepository.findById(tenantContext, invoiceId);
      
      if (!invoice) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
      }

      this.logger.info('Invoice found', { 
        invoiceId,
        status: invoice.status,
        tenantId: tenantContext.tenantId
      });

      return invoice;
    } catch (error: any) {
      this.logger.error('Failed to find invoice by ID', { 
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get public invoice (no authentication required)
   */
  async getPublicInvoice(invoiceId: string): Promise<PublicInvoiceDto> {
    this.logger.info('Getting public invoice', { invoiceId });

    try {
      // Use repository method for public access without tenant context
      const invoice = await this.invoiceRepository.findByIdWithoutTenant(invoiceId);
      
      if (!invoice) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
      }

      // Generate payment URL for public invoice
      const paymentUrl = this.generateShareableLink(invoiceId);

      // Return only public data (hide sensitive information)
      const publicInvoice: PublicInvoiceDto = {
        id: invoice.id,
        title: invoice.title,
        description: invoice.description,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        status: invoice.status,
        networkId: invoice.networkId,
        tokenId: invoice.tokenId,
        network: invoice.network,
        token: invoice.token,
        paymentUrl,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      };

      this.logger.info('Public invoice retrieved', { 
        invoiceId,
        status: invoice.status
      });

      return publicInvoice;
    } catch (error: any) {
      this.logger.error('Failed to get public invoice', { 
        error: error.message,
        invoiceId
      });
      throw error;
    }
  }

  /**
   * Get invoices for a user with pagination
   */
  async getUserInvoices(
    tenantContext: TenantContext,
    userId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<Invoice>> {
    this.logger.info('Finding invoices by user', { 
      userId,
      options,
      tenantId: tenantContext.tenantId
    });

    try {
      // Verify the user exists (userId should be from JWT token)
      const user = await this.userRepository.findById(tenantContext, userId);
      if (!user) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'User not found', 404);
      }

      const queryOptions = {
        limit: options.limit || 20,
        nextToken: options.nextToken,
        sortDirection: 'desc' as const
      };

      let result;
      if (options.status) {
        // Search by status and user
        result = await this.invoiceRepository.searchInvoices(
          tenantContext,
          { status: options.status, createdBy: userId },
          queryOptions
        );
      } else {
        // Get all invoices for user
        result = await this.invoiceRepository.findByUser(tenantContext, userId, queryOptions);
      }

      this.logger.info('Invoices found', { 
        userId,
        count: result.items.length,
        total: result.total,
        tenantId: tenantContext.tenantId
      });

      return {
        items: result.items,
        total: result.total,
        nextToken: result.nextToken
      };
    } catch (error: any) {
      this.logger.error('Failed to find invoices by user', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get dashboard statistics for user's invoices
   */
  async getDashboardStats(
    tenantContext: TenantContext,
    userId: string
  ): Promise<InvoiceStatsResponse> {
    this.logger.info('Getting dashboard stats', { 
      userId,
      tenantId: tenantContext.tenantId
    });

    try {
      // Verify the user exists (userId should be from JWT token)
      const user = await this.userRepository.findById(tenantContext, userId);
      if (!user) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'User not found', 404);
      }

      // Get all invoices for the user
      const allInvoices = await this.invoiceRepository.findByUser(
        tenantContext, 
        userId, 
        { limit: 1000 } // Get all invoices for stats
      );

      const invoices = allInvoices.items;
      const totalInvoices = invoices.length;
      
      // Calculate totals
      const totalAmount = invoices.reduce((sum, invoice) => 
        sum + parseFloat(invoice.amount), 0
      ).toString();
      
      const totalPaidAmount = invoices.reduce((sum, invoice) => 
        sum + parseFloat(invoice.amountPaid), 0
      ).toString();

      // Count by status
      const byStatus: Record<string, number> = {
        draft: 0,
        sent: 0,
        paid: 0,
        overdue: 0,
        cancelled: 0,
        partial: 0
      };

      let overdueCount = 0;
      let dueSoonCount = 0; // Due within 7 days
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      invoices.forEach(invoice => {
        byStatus[invoice.status]++;
        
        // Check for overdue
        if (invoice.isOverdue) {
          overdueCount++;
        }
        
        // Check for due soon (within 7 days)
        if (invoice.dueDate && invoice.status !== 'paid' && invoice.status !== 'cancelled') {
          const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate);
          if (dueDate <= sevenDaysFromNow && dueDate > now) {
            dueSoonCount++;
          }
        }
      });

      const stats: InvoiceStatsResponse = {
        total: totalInvoices,
        byStatus,
        totalAmount,
        totalPaidAmount,
        overdue: overdueCount,
        dueSoon: dueSoonCount
      };

      this.logger.info('Dashboard stats calculated', { 
        userId,
        stats,
        tenantId: tenantContext.tenantId
      });

      return stats;
    } catch (error: any) {
      this.logger.error('Failed to get dashboard stats', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Update invoice status (only allow status updates for now)
   */
  async updateInvoiceStatus(
    tenantContext: TenantContext,
    invoiceId: string,
    status: InvoiceStatus
  ): Promise<Invoice> {
    this.logger.info('Updating invoice status', { 
      invoiceId,
      newStatus: status,
      tenantId: tenantContext.tenantId
    });

    try {
      // Get the existing invoice
      const existingInvoice = await this.invoiceRepository.findById(tenantContext, invoiceId);
      
      if (!existingInvoice) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
      }

      // Validate status transition
      if (!this.isValidStatusTransition(existingInvoice.status, status)) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR, 
          `Cannot change status from ${existingInvoice.status} to ${status}`,
          400
        );
      }

      // Prepare status update
      const updates: Partial<Invoice> = { status };
      
      // Set sentAt timestamp when marking as sent
      if (status === 'sent' && existingInvoice.status === 'draft') {
        updates.sentAt = new Date();
      }

      // Update the invoice
      const updatedInvoice = await this.invoiceRepository.update(
        tenantContext,
        invoiceId,
        updates
      );

      this.logger.info('Invoice status updated successfully', { 
        invoiceId,
        oldStatus: existingInvoice.status,
        newStatus: status,
        tenantId: tenantContext.tenantId
      });

      return updatedInvoice;
    } catch (error: any) {
      this.logger.error('Failed to update invoice status', { 
        error: error.message,
        invoiceId,
        newStatus: status,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Mark invoice as paid
   */
  async markAsPaid(
    tenantContext: TenantContext,
    invoiceId: string, 
    paymentAmount: string
  ): Promise<Invoice> {
    this.logger.info('Marking invoice as paid', { 
      invoiceId,
      amount: paymentAmount,
      tenantId: tenantContext.tenantId
    });

    try {
      const invoice = await this.invoiceRepository.findById(tenantContext, invoiceId);
      
      if (!invoice) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
      }

      // Add payment to invoice
      invoice.addPayment(paymentAmount);
      
      const updatedInvoice = await this.invoiceRepository.update(
        tenantContext,
        invoiceId,
        {
          status: invoice.status,
          amountPaid: invoice.amountPaid,
          paidAt: invoice.paidAt
        }
      );

      this.logger.info('Invoice marked as paid', { 
        invoiceId,
        status: updatedInvoice.status,
        tenantId: tenantContext.tenantId
      });

      return updatedInvoice;
    } catch (error: any) {
      this.logger.error('Failed to mark invoice as paid', { 
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Cancel an invoice (using status update)
   */
  async cancel(tenantContext: TenantContext, invoiceId: string): Promise<void> {
    this.logger.info('Cancelling invoice', { 
      invoiceId,
      tenantId: tenantContext.tenantId
    });

    try {
      await this.updateInvoiceStatus(tenantContext, invoiceId, 'cancelled');
      
      this.logger.info('Invoice cancelled', { 
        invoiceId,
        tenantId: tenantContext.tenantId
      });
    } catch (error: any) {
      this.logger.error('Failed to cancel invoice', { 
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Generate shareable link for invoice payment
   */
  generateShareableLink(invoiceId: string): string {
    const frontendUrl = config.frontend.url;
    return `${frontendUrl}/invoice/${invoiceId}`;
  }

  /**
   * Validate if a status transition is allowed
   */
  private isValidStatusTransition(currentStatus: InvoiceStatus, newStatus: InvoiceStatus): boolean {
    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      'draft': ['sent', 'cancelled'],
      'sent': ['paid', 'overdue', 'cancelled', 'partial'],
      'paid': [], // No transitions from paid
      'overdue': ['paid', 'cancelled', 'partial'],
      'cancelled': [], // No transitions from cancelled
      'partial': ['paid', 'overdue', 'cancelled']
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }


  /**
   * Send an invoice (mark as sent)
   */
  async send(tenantContext: TenantContext, invoiceId: string, userId: string): Promise<Invoice> {
    this.logger.info('Sending invoice', { 
      invoiceId,
      userId,
      tenantId: tenantContext.tenantId
    });

    try {
      const invoice = await this.invoiceRepository.findById(tenantContext, invoiceId);
      
      if (!invoice) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
      }

      // Check permissions
      if (invoice.createdBy !== userId) {
        throw new FluxionError(ErrorCodes.FORBIDDEN, 'You do not have permission to send this invoice', 403);
      }
      
      // Only allow sending of draft invoices
      if (invoice.status !== 'draft') {
        throw new FluxionError(ErrorCodes.VALIDATION_ERROR, 'Only draft invoices can be sent', 400);
      }

      // Update invoice status to sent
      invoice.markAsSent();
      const updatedInvoice = await this.invoiceRepository.update(
        tenantContext,
        invoiceId,
        {
          status: invoice.status,
          sentAt: invoice.sentAt
        }
      );

      this.logger.info('Invoice sent successfully', { 
        invoiceId,
        tenantId: tenantContext.tenantId
      });
      
      return updatedInvoice;
    } catch (error: any) {
      this.logger.error('Failed to send invoice', { 
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get dashboard statistics for organization
   */
  async getDashboardStats(tenantContext: TenantContext): Promise<InvoiceStatsResponse> {
    this.logger.info('Getting dashboard stats', { 
      tenantId: tenantContext.tenantId
    });

    try {
      const stats = await this.invoiceRepository.getInvoiceStats(tenantContext);

      this.logger.info('Dashboard stats retrieved', { 
        total: stats.total,
        tenantId: tenantContext.tenantId
      });

      return {
        total: stats.total,
        byStatus: stats.byStatus,
        totalAmount: stats.totalAmount,
        totalPaidAmount: stats.totalPaidAmount,
        overdue: stats.overdue,
        dueSoon: stats.dueSoon
      };
    } catch (error: any) {
      this.logger.error('Failed to get dashboard stats', { 
        error: error.message,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get invoice status (public)
   */
  async getStatus(invoiceId: string): Promise<{ status: string; last_updated: Date }> {
    this.logger.info('Getting invoice status', { invoiceId });

    try {
      const invoice = await this.getPublicInvoice(invoiceId);
      
      return {
        status: invoice.status,
        last_updated: invoice.updatedAt
      };
    } catch (error: any) {
      this.logger.error('Failed to get invoice status', { 
        error: error.message,
        invoiceId
      });
      throw error;
    }
  }

  /**
   * Get overdue invoices for organization
   */
  async getOverdueInvoices(tenantContext: TenantContext): Promise<Invoice[]> {
    this.logger.info('Finding overdue invoices', {
      tenantId: tenantContext.tenantId
    });

    try {
      const overdueInvoices = await this.invoiceRepository.findOverdueInvoices(tenantContext);

      this.logger.info('Overdue invoices found', { 
        count: overdueInvoices.length,
        tenantId: tenantContext.tenantId
      });

      return overdueInvoices;
    } catch (error: any) {
      this.logger.error('Failed to get overdue invoices', { 
        error: error.message,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Generate client access token for invoice viewing
   */
  async generateClientAccessToken(
    tenantContext: TenantContext,
    invoiceId: string,
    expiresIn: number = 72
  ): Promise<{
    accessToken: string;
    publicUrl: string;
    expiresAt: string;
  }> {
    this.logger.info('Generating client access token', {
      invoiceId,
      expiresIn,
      tenantId: tenantContext.tenantId
    });

    try {
      // Import access token repository
      const { InvoiceAccessTokenRepository } = await import('@/database/repositories/InvoiceAccessTokenRepository');
      const accessTokenRepository = new InvoiceAccessTokenRepository();

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);

      // Create access token record
      const tokenRecord = await accessTokenRepository.create(tenantContext, {
        invoiceId,
        expiresAt
      });

      const publicUrl = `${process.env.FRONTEND_URL || 'https://fluxion.app'}/invoice/${tokenRecord.token}`;

      this.logger.info('Client access token generated successfully', {
        invoiceId,
        tokenId: tokenRecord.id,
        expiresAt: expiresAt.toISOString(),
        tenantId: tenantContext.tenantId
      });

      return {
        accessToken: tokenRecord.token,
        publicUrl,
        expiresAt: expiresAt.toISOString()
      };
    } catch (error: any) {
      this.logger.error('Failed to generate client access token', {
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Generate QR code data for invoice payment
   */
  async generateQRCodeData(
    tenantContext: TenantContext,
    invoiceId: string
  ): Promise<{
    qrData: string;
    paymentUrl: string;
    walletDeepLink: string;
  }> {
    this.logger.info('Generating QR code data', {
      invoiceId,
      tenantId: tenantContext.tenantId
    });

    try {
      const invoice = await this.getInvoiceById(tenantContext, invoiceId);

      if (!invoice.network || !invoice.token) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Invoice network or token information is missing',
          400
        );
      }

      // Calculate token amount (adjust for token decimals)
      const tokenAmount = (parseFloat(invoice.amount.toString()) * Math.pow(10, invoice.token.decimals)).toString();

      // EIP-681 format for payment requests
      const chainId = invoice.network.chainId;
      const tokenAddress = invoice.token.contractAddress;
      const recipientAddress = invoice.recipientWallet || process.env.DEFAULT_PAYMENT_WALLET;

      if (!recipientAddress) {
        throw new FluxionError(
          ErrorCodes.CONFIGURATION_ERROR,
          'Payment recipient address not configured',
          500
        );
      }

      // Generate different formats based on token type
      let qrData: string;
      if (invoice.token.isNative) {
        // Native token transfer
        qrData = `ethereum:${recipientAddress}@${chainId}?value=${tokenAmount}`;
      } else {
        // ERC-20 token transfer
        qrData = `ethereum:${tokenAddress}@${chainId}/transfer?address=${recipientAddress}&uint256=${tokenAmount}`;
      }

      const paymentUrl = `${process.env.FRONTEND_URL || 'https://fluxion.app'}/invoice/${invoice.id}`;
      const walletDeepLink = `metamask://send?to=${recipientAddress}&value=${tokenAmount}&chainId=${chainId}`;

      this.logger.info('QR code data generated successfully', {
        invoiceId,
        chainId,
        tokenSymbol: invoice.token.symbol,
        tenantId: tenantContext.tenantId
      });

      return {
        qrData,
        paymentUrl,
        walletDeepLink
      };
    } catch (error: any) {
      this.logger.error('Failed to generate QR code data', {
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Send invoice email to client
   */
  async sendInvoiceEmail(
    tenantContext: TenantContext,
    invoiceId: string,
    customMessage?: string,
    sendCopy: boolean = false
  ): Promise<{
    message: string;
    sentAt: string;
    recipient: string;
  }> {
    this.logger.info('Sending invoice email', {
      invoiceId,
      sendCopy,
      tenantId: tenantContext.tenantId
    });

    try {
      const invoice = await this.getInvoiceById(tenantContext, invoiceId);

      if (invoice.status === 'paid') {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Cannot send email for paid invoices',
          400
        );
      }

      // Import notification service
      const { NotificationService } = await import('@/modules/notifications/service');
      const notificationService = new NotificationService();

      // Send notification to client
      const notificationId = await notificationService.sendInvoiceNotification(
        tenantContext,
        invoiceId,
        'invoice_sent',
        customMessage
      );

      // If sendCopy is true, also send to creator
      if (sendCopy) {
        const { UserService } = await import('@/modules/users/service');
        const userService = new UserService();
        const creator = await userService.getUserByWallet(tenantContext, invoice.createdBy);

        if (creator.email) {
          await notificationService.sendNotification(tenantContext, {
            type: 'invoice_sent',
            recipientEmail: creator.email,
            templateData: {
              invoiceId: invoice.id,
              clientName: invoice.clientName,
              amount: invoice.amount.toString(),
              customMessage: 'Copy of invoice sent to client'
            }
          });
        }
      }

      // Update invoice status to sent if it was draft
      if (invoice.status === 'draft') {
        await this.updateInvoiceStatus(tenantContext, invoiceId, 'sent');
      }

      const sentAt = new Date().toISOString();

      this.logger.info('Invoice email sent successfully', {
        invoiceId,
        notificationId,
        recipient: invoice.clientEmail,
        tenantId: tenantContext.tenantId
      });

      return {
        message: 'Invoice email sent successfully',
        sentAt,
        recipient: invoice.clientEmail
      };
    } catch (error: any) {
      this.logger.error('Failed to send invoice email', {
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get payment status for invoice
   */
  async getPaymentStatus(invoiceId: string): Promise<{
    invoiceStatus: InvoiceStatus;
    payments: any[];
    totalPaid: string;
    remainingAmount: string;
  }> {
    this.logger.info('Getting payment status', { invoiceId });

    try {
      // Find invoice without tenant context for public access
      const invoice = await this.invoiceRepository.findByIdWithoutTenant(invoiceId);
      
      if (!invoice) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Invoice not found',
          404
        );
      }

      // Import payment repository
      const { PaymentRepository } = await import('@/database/repositories/PaymentRepository');
      const paymentRepository = new PaymentRepository();

      // Get all payments for this invoice
      const payments = await paymentRepository.findByInvoiceId(invoiceId);

      // Calculate totals
      const totalPaid = payments
        .filter(p => p.status === 'confirmed')
        .reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0);

      const invoiceAmount = parseFloat(invoice.amount.toString());
      const remainingAmount = Math.max(0, invoiceAmount - totalPaid);

      this.logger.info('Payment status retrieved successfully', {
        invoiceId,
        totalPaid,
        remainingAmount,
        paymentsCount: payments.length
      });

      return {
        invoiceStatus: invoice.status,
        payments: payments.map(p => ({
          paymentId: p.id,
          txHash: p.txHash,
          status: p.status,
          amount: p.amount.toString(),
          verifiedAt: p.verifiedAt
        })),
        totalPaid: totalPaid.toFixed(2),
        remainingAmount: remainingAmount.toFixed(2)
      };
    } catch (error: any) {
      this.logger.error('Failed to get payment status', {
        error: error.message,
        invoiceId
      });
      throw error;
    }
  }

  /**
   * Trigger manual payment verification
   */
  async triggerPaymentVerification(
    tenantContext: TenantContext,
    invoiceId: string
  ): Promise<{
    message: string;
    verificationsStarted: number;
  }> {
    this.logger.info('Triggering payment verification', {
      invoiceId,
      tenantId: tenantContext.tenantId
    });

    try {
      // Import payment repository to find pending payments
      const { PaymentRepository } = await import('@/database/repositories/PaymentRepository');
      const paymentRepository = new PaymentRepository();

      const pendingPayments = await paymentRepository.findPendingByInvoiceId(
        tenantContext,
        invoiceId
      );

      if (pendingPayments.length === 0) {
        return {
          message: 'No pending payments found for verification',
          verificationsStarted: 0
        };
      }

      // Import background job service to trigger verification
      const { BackgroundJobService } = await import('@/modules/jobs/service');
      const jobService = new BackgroundJobService();

      // Trigger verification for each pending payment
      const verificationPromises = pendingPayments.map(payment =>
        jobService.triggerJob(tenantContext, 'payment_verification', {
          paymentId: payment.id,
          priority: 'high'
        })
      );

      await Promise.all(verificationPromises);

      this.logger.info('Payment verification triggered successfully', {
        invoiceId,
        verificationsStarted: pendingPayments.length,
        tenantId: tenantContext.tenantId
      });

      return {
        message: 'Payment verification triggered',
        verificationsStarted: pendingPayments.length
      };
    } catch (error: any) {
      this.logger.error('Failed to trigger payment verification', {
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get invoice by access token (public method)
   */
  async getInvoiceByAccessToken(accessToken: string): Promise<any> {
    this.logger.info('Getting invoice by access token', { accessToken });

    try {
      // Import access token repository
      const { InvoiceAccessTokenRepository } = await import('@/database/repositories/InvoiceAccessTokenRepository');
      const accessTokenRepository = new InvoiceAccessTokenRepository();

      // Find token record
      const tokenRecord = await accessTokenRepository.findByToken(accessToken);
      
      if (!tokenRecord) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Invalid or expired access token',
          404
        );
      }

      // Check if token is expired
      if (tokenRecord.expiresAt < new Date()) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Access token has expired',
          400
        );
      }

      // Get invoice data
      const invoice = await this.invoiceRepository.findByIdWithoutTenant(tokenRecord.invoiceId);
      
      if (!invoice) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Invoice not found',
          404
        );
      }

      // Return public invoice data with payment info
      const qrCodeData = await this.generateQRCodeData(
        { tenantId: invoice.organizationId, userId: '' },
        invoice.id
      );

      this.logger.info('Invoice retrieved by access token successfully', {
        invoiceId: invoice.id,
        accessToken
      });

      return {
        id: invoice.id,
        title: invoice.title,
        description: invoice.description,
        amount: invoice.amount.toString(),
        dueDate: invoice.dueDate,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        status: invoice.status,
        network: invoice.network,
        token: invoice.token,
        paymentAddress: invoice.recipientWallet || process.env.DEFAULT_PAYMENT_WALLET,
        qrCodeData: qrCodeData.qrData,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt
      };
    } catch (error: any) {
      this.logger.error('Failed to get invoice by access token', {
        error: error.message,
        accessToken
      });
      throw error;
    }
  }

  /**
   * Get public payment info for invoice
   */
  async getPublicPaymentInfo(invoiceId: string): Promise<any> {
    this.logger.info('Getting public payment info', { invoiceId });

    try {
      const invoice = await this.invoiceRepository.findByIdWithoutTenant(invoiceId);
      
      if (!invoice) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Invoice not found',
          404
        );
      }

      if (invoice.status === 'paid') {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Invoice has already been paid',
          400
        );
      }

      // Generate payment data
      const qrCodeData = await this.generateQRCodeData(
        { tenantId: invoice.organizationId, userId: '' },
        invoice.id
      );

      // Calculate token amount
      const tokenAmount = (parseFloat(invoice.amount.toString()) * Math.pow(10, invoice.token.decimals)).toString();

      this.logger.info('Public payment info retrieved successfully', {
        invoiceId,
        networkId: invoice.network?.id,
        tokenId: invoice.token?.id
      });

      return {
        invoiceId: invoice.id,
        amount: invoice.amount.toString(),
        paymentAddress: invoice.recipientWallet || process.env.DEFAULT_PAYMENT_WALLET,
        network: {
          chainId: invoice.network?.chainId,
          name: invoice.network?.name,
          rpcUrl: invoice.network?.rpcUrl
        },
        token: {
          contractAddress: invoice.token?.contractAddress,
          symbol: invoice.token?.symbol,
          decimals: invoice.token?.decimals
        },
        qrCodeData: qrCodeData.qrData,
        walletConnectData: {
          to: invoice.token?.contractAddress || invoice.recipientWallet,
          value: invoice.token?.isNative ? tokenAmount : '0',
          data: invoice.token?.isNative ? '0x' : `0xa9059cbb000000000000000000000000${(invoice.recipientWallet || '').slice(2)}${tokenAmount.padStart(64, '0')}`
        },
        estimatedGas: invoice.token?.isNative ? '21000' : '65000'
      };
    } catch (error: any) {
      this.logger.error('Failed to get public payment info', {
        error: error.message,
        invoiceId
      });
      throw error;
    }
  }

  /**
   * Get invoices due soon (within 7 days)
   */
  async getDueSoonInvoices(tenantContext: TenantContext): Promise<Invoice[]> {
    this.logger.info('Getting invoices due soon', {
      tenantId: tenantContext.tenantId
    });

    try {
      const dueSoonInvoices = await this.invoiceRepository.findDueSoonInvoices(tenantContext);

      this.logger.info('Due soon invoices found', {
        count: dueSoonInvoices.length,
        tenantId: tenantContext.tenantId
      });

      return dueSoonInvoices;
    } catch (error: any) {
      this.logger.error('Failed to get due soon invoices', {
        error: error.message,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }
}