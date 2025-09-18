import { FindOptionsWhere, Between, LessThan, MoreThan } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { Invoice } from '../entities/Invoice';
import { TenantContext, FluxionError, ErrorCodes, QueryOptions } from '../../types/common';

export interface InvoiceSearchOptions {
  status?: string;
  clientEmail?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  createdBy?: string;
  networkId?: string;
  tokenId?: string;
  minAmount?: string;
  maxAmount?: string;
}

export class InvoiceRepository extends BaseRepository<Invoice> {
  constructor() {
    super(Invoice, 'Invoice');
  }

  /**
   * Find invoice by invoice number within organization
   */
  async findByInvoiceNumber(tenantContext: TenantContext, invoiceNumber: string): Promise<Invoice | null> {
    await this.setTenantContext(tenantContext);
    
    try {
      const invoice = await this.repository.findOne({
        where: {
          invoiceNumber,
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<Invoice>,
        relations: ['network', 'token', 'createdByUser', 'payments'],
      });
      
      this.logger.debug('Invoice search by number', { 
        invoiceNumber, 
        found: !!invoice,
        tenantId: tenantContext.tenantId,
      });
      
      return invoice;
    } catch (error: any) {
      this.logger.error('Failed to find invoice by number', { 
        error: error.message, 
        invoiceNumber,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find invoice by number',
        500,
        error
      );
    }
  }

  /**
   * Find invoices by status
   */
  async findByStatus(tenantContext: TenantContext, status: string, limit = 50): Promise<Invoice[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      const invoices = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
          status,
        } as FindOptionsWhere<Invoice>,
        relations: ['network', 'token', 'createdByUser'],
        order: {
          createdAt: 'DESC',
        },
        take: limit,
      });
      
      this.logger.debug('Invoices by status retrieved', { 
        status,
        count: invoices.length,
        tenantId: tenantContext.tenantId,
      });
      
      return invoices;
    } catch (error: any) {
      this.logger.error('Failed to find invoices by status', { 
        error: error.message,
        status,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find invoices by status',
        500,
        error
      );
    }
  }

  /**
   * Find invoices by user (created by)
   */
  async findByUser(tenantContext: TenantContext, userId: string, options: QueryOptions = {}): Promise<{
    items: Invoice[];
    total?: number;
    nextToken?: string;
  }> {
    await this.setTenantContext(tenantContext);
    
    try {
      const limit = options.limit || 50;
      const page = options.nextToken ? parseInt(Buffer.from(options.nextToken, 'base64').toString()) : 1;
      const skip = (page - 1) * limit;

      const [invoices, total] = await this.repository.findAndCount({
        where: {
          organizationId: tenantContext.tenantId,
          createdBy: userId,
        } as FindOptionsWhere<Invoice>,
        relations: ['network', 'token', 'payments'],
        order: {
          createdAt: options.sortDirection === 'asc' ? 'ASC' : 'DESC',
        },
        skip,
        take: limit,
      });
      
      const nextToken = invoices.length === limit && skip + limit < total
        ? Buffer.from((page + 1).toString()).toString('base64')
        : undefined;
      
      this.logger.debug('Invoices by user retrieved', { 
        userId,
        count: invoices.length,
        total,
        hasMore: !!nextToken,
        tenantId: tenantContext.tenantId,
      });
      
      return {
        items: invoices,
        total,
        nextToken,
      };
    } catch (error: any) {
      this.logger.error('Failed to find invoices by user', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find invoices by user',
        500,
        error
      );
    }
  }

  /**
   * Find invoices by client email
   */
  async findByClientEmail(tenantContext: TenantContext, clientEmail: string): Promise<Invoice[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      const invoices = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
          clientEmail,
        } as FindOptionsWhere<Invoice>,
        relations: ['network', 'token', 'createdByUser', 'payments'],
        order: {
          createdAt: 'DESC',
        },
      });
      
      this.logger.debug('Invoices by client email retrieved', { 
        clientEmail,
        count: invoices.length,
        tenantId: tenantContext.tenantId,
      });
      
      return invoices;
    } catch (error: any) {
      this.logger.error('Failed to find invoices by client email', { 
        error: error.message,
        clientEmail,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find invoices by client email',
        500,
        error
      );
    }
  }

  /**
   * Find overdue invoices
   */
  async findOverdueInvoices(tenantContext: TenantContext): Promise<Invoice[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      const today = new Date();
      
      const invoices = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
          status: 'sent',
          dueDate: LessThan(today),
        } as FindOptionsWhere<Invoice>,
        relations: ['network', 'token', 'createdByUser'],
        order: {
          dueDate: 'ASC',
        },
      });
      
      this.logger.debug('Overdue invoices retrieved', { 
        count: invoices.length,
        tenantId: tenantContext.tenantId,
      });
      
      return invoices;
    } catch (error: any) {
      this.logger.error('Failed to find overdue invoices', { 
        error: error.message,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find overdue invoices',
        500,
        error
      );
    }
  }

  /**
   * Find invoices due soon
   */
  async findInvoicesDueSoon(tenantContext: TenantContext, daysAhead = 7): Promise<Invoice[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysAhead);
      
      const invoices = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
          status: 'sent',
          dueDate: Between(today, futureDate),
        } as FindOptionsWhere<Invoice>,
        relations: ['network', 'token', 'createdByUser'],
        order: {
          dueDate: 'ASC',
        },
      });
      
      this.logger.debug('Invoices due soon retrieved', { 
        daysAhead,
        count: invoices.length,
        tenantId: tenantContext.tenantId,
      });
      
      return invoices;
    } catch (error: any) {
      this.logger.error('Failed to find invoices due soon', { 
        error: error.message,
        daysAhead,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find invoices due soon',
        500,
        error
      );
    }
  }

  /**
   * Search invoices with advanced filters
   */
  async searchInvoices(
    tenantContext: TenantContext, 
    searchOptions: InvoiceSearchOptions,
    queryOptions: QueryOptions = {}
  ): Promise<{
    items: Invoice[];
    total: number;
    nextToken?: string;
  }> {
    await this.setTenantContext(tenantContext);
    
    try {
      const limit = queryOptions.limit || 50;
      const page = queryOptions.nextToken ? parseInt(Buffer.from(queryOptions.nextToken, 'base64').toString()) : 1;
      const skip = (page - 1) * limit;

      let queryBuilder = this.repository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.network', 'network')
        .leftJoinAndSelect('invoice.token', 'token')
        .leftJoinAndSelect('invoice.createdByUser', 'createdByUser')
        .leftJoinAndSelect('invoice.payments', 'payments')
        .where('invoice.organizationId = :organizationId', { organizationId: tenantContext.tenantId });

      // Apply search filters
      if (searchOptions.status) {
        queryBuilder = queryBuilder.andWhere('invoice.status = :status', { status: searchOptions.status });
      }

      if (searchOptions.clientEmail) {
        queryBuilder = queryBuilder.andWhere('invoice.clientEmail ILIKE :clientEmail', { 
          clientEmail: `%${searchOptions.clientEmail}%` 
        });
      }

      if (searchOptions.createdBy) {
        queryBuilder = queryBuilder.andWhere('invoice.createdBy = :createdBy', { createdBy: searchOptions.createdBy });
      }

      if (searchOptions.networkId) {
        queryBuilder = queryBuilder.andWhere('invoice.networkId = :networkId', { networkId: searchOptions.networkId });
      }

      if (searchOptions.tokenId) {
        queryBuilder = queryBuilder.andWhere('invoice.tokenId = :tokenId', { tokenId: searchOptions.tokenId });
      }

      if (searchOptions.dueDateFrom) {
        queryBuilder = queryBuilder.andWhere('invoice.dueDate >= :dueDateFrom', { dueDateFrom: searchOptions.dueDateFrom });
      }

      if (searchOptions.dueDateTo) {
        queryBuilder = queryBuilder.andWhere('invoice.dueDate <= :dueDateTo', { dueDateTo: searchOptions.dueDateTo });
      }

      if (searchOptions.minAmount) {
        queryBuilder = queryBuilder.andWhere('invoice.amount >= :minAmount', { minAmount: searchOptions.minAmount });
      }

      if (searchOptions.maxAmount) {
        queryBuilder = queryBuilder.andWhere('invoice.amount <= :maxAmount', { maxAmount: searchOptions.maxAmount });
      }

      // Apply sorting
      const sortField = queryOptions.sortField || 'createdAt';
      const sortDirection = queryOptions.sortDirection === 'asc' ? 'ASC' : 'DESC';
      queryBuilder = queryBuilder.orderBy(`invoice.${sortField}`, sortDirection);

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply pagination
      const invoices = await queryBuilder
        .skip(skip)
        .take(limit)
        .getMany();
      
      const nextToken = invoices.length === limit && skip + limit < total
        ? Buffer.from((page + 1).toString()).toString('base64')
        : undefined;
      
      this.logger.debug('Invoice search completed', { 
        searchOptions,
        count: invoices.length,
        total,
        hasMore: !!nextToken,
        tenantId: tenantContext.tenantId,
      });
      
      return {
        items: invoices,
        total,
        nextToken,
      };
    } catch (error: any) {
      this.logger.error('Failed to search invoices', { 
        error: error.message,
        searchOptions,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to search invoices',
        500,
        error
      );
    }
  }

  /**
   * Get invoice statistics for organization
   */
  async getInvoiceStats(tenantContext: TenantContext): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalAmount: string;
    totalPaidAmount: string;
    overdue: number;
    dueSoon: number;
  }> {
    await this.setTenantContext(tenantContext);
    
    try {
      const [total, statusQuery, amountQuery, overdue, dueSoon] = await Promise.all([
        // Total invoices
        this.repository.count({
          where: { organizationId: tenantContext.tenantId } as FindOptionsWhere<Invoice>,
        }),
        
        // Status breakdown
        this.repository
          .createQueryBuilder('invoice')
          .select('invoice.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .where('invoice.organizationId = :organizationId', { organizationId: tenantContext.tenantId })
          .groupBy('invoice.status')
          .getRawMany(),
        
        // Amount totals
        this.repository
          .createQueryBuilder('invoice')
          .select('SUM(invoice.amount)', 'totalAmount')
          .addSelect('SUM(invoice.amountPaid)', 'totalPaidAmount')
          .where('invoice.organizationId = :organizationId', { organizationId: tenantContext.tenantId })
          .getRawOne(),
        
        // Overdue count
        this.repository.count({
          where: {
            organizationId: tenantContext.tenantId,
            status: 'sent',
            dueDate: LessThan(new Date()),
          } as FindOptionsWhere<Invoice>,
        }),
        
        // Due soon count (next 7 days)
        this.repository.count({
          where: {
            organizationId: tenantContext.tenantId,
            status: 'sent',
            dueDate: Between(new Date(), (() => {
              const futureDate = new Date();
              futureDate.setDate(futureDate.getDate() + 7);
              return futureDate;
            })()),
          } as FindOptionsWhere<Invoice>,
        }),
      ]);

      const byStatus: Record<string, number> = {};
      statusQuery.forEach(row => {
        byStatus[row.status] = parseInt(row.count);
      });

      const stats = {
        total,
        byStatus,
        totalAmount: amountQuery?.totalAmount || '0',
        totalPaidAmount: amountQuery?.totalPaidAmount || '0',
        overdue,
        dueSoon,
      };
      
      this.logger.debug('Invoice statistics retrieved', { 
        stats,
        tenantId: tenantContext.tenantId,
      });
      
      return stats;
    } catch (error: any) {
      this.logger.error('Failed to get invoice statistics', { 
        error: error.message,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to get invoice statistics',
        500,
        error
      );
    }
  }

  /**
   * Mark invoices as overdue
   */
  async markOverdueInvoices(tenantContext: TenantContext): Promise<number> {
    await this.setTenantContext(tenantContext);
    
    try {
      const today = new Date();
      
      const result = await this.repository.update(
        {
          organizationId: tenantContext.tenantId,
          status: 'sent',
          dueDate: LessThan(today),
        } as FindOptionsWhere<Invoice>,
        {
          status: 'overdue',
        }
      );
      
      const updatedCount = result.affected || 0;
      
      this.logger.info('Invoices marked as overdue', { 
        count: updatedCount,
        tenantId: tenantContext.tenantId,
      });
      
      return updatedCount;
    } catch (error: any) {
      this.logger.error('Failed to mark invoices as overdue', { 
        error: error.message,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to mark invoices as overdue',
        500,
        error
      );
    }
  }

  /**
   * Generate next invoice number for organization
   */
  async generateInvoiceNumber(tenantContext: TenantContext, organizationSlug: string): Promise<string> {
    await this.setTenantContext(tenantContext);
    
    try {
      // Get the count of invoices for this year and organization
      const year = new Date().getFullYear();
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year + 1, 0, 1);
      
      const count = await this.repository.count({
        where: {
          organizationId: tenantContext.tenantId,
          createdAt: Between(yearStart, yearEnd),
        } as FindOptionsWhere<Invoice>,
      });
      
      const sequence = count + 1;
      const invoiceNumber = `${organizationSlug.toUpperCase()}-${year}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`;
      
      this.logger.debug('Invoice number generated', { 
        invoiceNumber,
        sequence,
        year,
        tenantId: tenantContext.tenantId,
      });
      
      return invoiceNumber;
    } catch (error: any) {
      this.logger.error('Failed to generate invoice number', { 
        error: error.message,
        organizationSlug,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to generate invoice number',
        500,
        error
      );
    }
  }
}