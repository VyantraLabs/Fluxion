import { FindManyOptions, FindOptionsWhere, Like } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { InvoiceTemplate } from '@/database/entities/InvoiceTemplate';
import { TenantContext, PaginatedResult, QueryOptions } from '@/types/common';
import { FluxionError, ErrorCodes } from '@/types/common';

export interface CreateInvoiceTemplateData {
  name: string;
  description?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultDueDays?: number;
  defaultNetworkId?: string;
  defaultTokenId?: string;
  configuration?: any;
  createdBy: string;
}

export interface UpdateInvoiceTemplateData {
  name?: string;
  description?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultDueDays?: number;
  defaultNetworkId?: string;
  defaultTokenId?: string;
  configuration?: any;
  isActive?: boolean;
}

export interface TemplateSearchOptions {
  name?: string;
  isActive?: boolean;
  createdBy?: string;
  hasCustomFields?: boolean;
  hasDefaultNetwork?: boolean;
}

export class InvoiceTemplateRepository extends BaseRepository<InvoiceTemplate> {
  constructor() {
    super(InvoiceTemplate, 'InvoiceTemplate');
  }

  /**
   * Create a new invoice template
   */
  async create(tenantContext: TenantContext, data: CreateInvoiceTemplateData): Promise<InvoiceTemplate> {
    this.logger.info('Creating invoice template', { 
      name: data.name,
      tenantId: tenantContext.tenantId 
    });

    try {
      // Check for duplicate template name in organization
      const existing = await this.findByName(tenantContext, data.name);
      if (existing) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          `Template with name "${data.name}" already exists`,
          400
        );
      }

      const template = await super.create(tenantContext, {
        ...data,
        organizationId: tenantContext.tenantId,
        isActive: true,
        usageCount: 0,
      });

      this.logger.info('Invoice template created', { 
        templateId: template.id,
        name: template.name,
        tenantId: tenantContext.tenantId 
      });

      return template;
    } catch (error: any) {
      this.logger.error('Failed to create invoice template', { 
        error: error.message,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Find template by name within organization
   */
  async findByName(tenantContext: TenantContext, name: string): Promise<InvoiceTemplate | null> {
    await this.setTenantContext(tenantContext);

    try {
      const template = await this.repository.findOne({
        where: {
          name,
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<InvoiceTemplate>,
        relations: ['defaultNetwork', 'defaultToken', 'createdByUser'],
      });

      return template;
    } catch (error: any) {
      this.logger.error('Failed to find template by name', { 
        error: error.message,
        name,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Find template by ID with relations
   */
  async findById(tenantContext: TenantContext, templateId: string): Promise<InvoiceTemplate | null> {
    await this.setTenantContext(tenantContext);

    try {
      const template = await this.repository.findOne({
        where: {
          id: templateId,
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<InvoiceTemplate>,
        relations: ['defaultNetwork', 'defaultToken', 'createdByUser', 'invoices'],
      });

      return template;
    } catch (error: any) {
      this.logger.error('Failed to find template by ID', { 
        error: error.message,
        templateId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Search templates with filtering and pagination
   */
  async searchTemplates(
    tenantContext: TenantContext,
    searchOptions: TemplateSearchOptions = {},
    queryOptions: QueryOptions = {}
  ): Promise<PaginatedResult<InvoiceTemplate>> {
    await this.setTenantContext(tenantContext);

    try {
      const where: FindOptionsWhere<InvoiceTemplate> = {
        organizationId: tenantContext.tenantId,
      };

      // Apply search filters
      if (searchOptions.name) {
        where.name = Like(`%${searchOptions.name}%`);
      }
      if (typeof searchOptions.isActive === 'boolean') {
        where.isActive = searchOptions.isActive;
      }
      if (searchOptions.createdBy) {
        where.createdBy = searchOptions.createdBy;
      }

      const findOptions: FindManyOptions<InvoiceTemplate> = {
        where,
        relations: ['defaultNetwork', 'defaultToken', 'createdByUser'],
        order: { 
          createdAt: queryOptions.sortDirection === 'asc' ? 'ASC' : 'DESC' 
        },
      };

      // Apply pagination
      if (queryOptions.limit) {
        findOptions.take = queryOptions.limit;
      }

      if (queryOptions.nextToken) {
        // Decode cursor-based pagination token
        const decodedCursor = Buffer.from(queryOptions.nextToken, 'base64').toString();
        const [cursorId] = decodedCursor.split(':');
        
        findOptions.where = {
          ...where,
          id: queryOptions.sortDirection === 'asc' ? 
            { $gt: cursorId } : { $lt: cursorId }
        } as any;
      }

      const [templates, total] = await this.repository.findAndCount(findOptions);

      // Generate next token if there are more results
      let nextToken: string | undefined;
      if (templates.length === queryOptions.limit && templates.length > 0) {
        const lastTemplate = templates[templates.length - 1];
        nextToken = Buffer.from(`${lastTemplate.id}:${lastTemplate.createdAt.toISOString()}`).toString('base64');
      }

      return {
        items: templates,
        total,
        nextToken,
      };
    } catch (error: any) {
      this.logger.error('Failed to search templates', { 
        error: error.message,
        searchOptions,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Get active templates for organization
   */
  async getActiveTemplates(tenantContext: TenantContext): Promise<InvoiceTemplate[]> {
    await this.setTenantContext(tenantContext);

    try {
      const templates = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
          isActive: true,
        } as FindOptionsWhere<InvoiceTemplate>,
        relations: ['defaultNetwork', 'defaultToken'],
        order: { usageCount: 'DESC', createdAt: 'DESC' },
      });

      return templates;
    } catch (error: any) {
      this.logger.error('Failed to get active templates', { 
        error: error.message,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Get popular templates (most used)
   */
  async getPopularTemplates(tenantContext: TenantContext, limit = 10): Promise<InvoiceTemplate[]> {
    await this.setTenantContext(tenantContext);

    try {
      const templates = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
          isActive: true,
        } as FindOptionsWhere<InvoiceTemplate>,
        relations: ['defaultNetwork', 'defaultToken'],
        order: { usageCount: 'DESC', createdAt: 'DESC' },
        take: limit,
      });

      return templates;
    } catch (error: any) {
      this.logger.error('Failed to get popular templates', { 
        error: error.message,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Update template
   */
  async update(
    tenantContext: TenantContext, 
    templateId: string, 
    data: UpdateInvoiceTemplateData
  ): Promise<InvoiceTemplate> {
    await this.setTenantContext(tenantContext);

    try {
      const template = await this.findById(tenantContext, templateId);
      if (!template) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
      }

      // Check for duplicate name if name is being changed
      if (data.name && data.name !== template.name) {
        const existing = await this.findByName(tenantContext, data.name);
        if (existing) {
          throw new FluxionError(
            ErrorCodes.VALIDATION_ERROR,
            `Template with name "${data.name}" already exists`,
            400
          );
        }
      }

      // Update template
      Object.assign(template, data);
      const updatedTemplate = await this.repository.save(template);

      this.logger.info('Invoice template updated', { 
        templateId,
        tenantId: tenantContext.tenantId 
      });

      return updatedTemplate;
    } catch (error: any) {
      this.logger.error('Failed to update template', { 
        error: error.message,
        templateId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Soft delete template (deactivate)
   */
  async softDelete(tenantContext: TenantContext, templateId: string): Promise<void> {
    await this.setTenantContext(tenantContext);

    try {
      const template = await this.findById(tenantContext, templateId);
      if (!template) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
      }

      template.isActive = false;
      await this.repository.save(template);

      this.logger.info('Invoice template soft deleted', { 
        templateId,
        tenantId: tenantContext.tenantId 
      });
    } catch (error: any) {
      this.logger.error('Failed to soft delete template', { 
        error: error.message,
        templateId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Hard delete template (permanent)
   */
  async hardDelete(tenantContext: TenantContext, templateId: string): Promise<void> {
    await this.setTenantContext(tenantContext);

    try {
      const result = await this.repository.delete({
        id: templateId,
        organizationId: tenantContext.tenantId,
      } as FindOptionsWhere<InvoiceTemplate>);

      if (result.affected === 0) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
      }

      this.logger.info('Invoice template hard deleted', { 
        templateId,
        tenantId: tenantContext.tenantId 
      });
    } catch (error: any) {
      this.logger.error('Failed to hard delete template', { 
        error: error.message,
        templateId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Increment template usage count
   */
  async incrementUsageCount(tenantContext: TenantContext, templateId: string): Promise<void> {
    await this.setTenantContext(tenantContext);

    try {
      await this.repository.increment(
        { 
          id: templateId, 
          organizationId: tenantContext.tenantId 
        } as FindOptionsWhere<InvoiceTemplate>,
        'usageCount',
        1
      );

      this.logger.info('Template usage count incremented', { 
        templateId,
        tenantId: tenantContext.tenantId 
      });
    } catch (error: any) {
      this.logger.error('Failed to increment usage count', { 
        error: error.message,
        templateId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(tenantContext: TenantContext): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalUsage: number;
    mostUsed?: InvoiceTemplate;
  }> {
    await this.setTenantContext(tenantContext);

    try {
      const [templates, total] = await this.repository.findAndCount({
        where: {
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<InvoiceTemplate>,
      });

      const active = templates.filter(t => t.isActive).length;
      const inactive = templates.filter(t => !t.isActive).length;
      const totalUsage = templates.reduce((sum, t) => sum + t.usageCount, 0);
      const mostUsed = templates.sort((a, b) => b.usageCount - a.usageCount)[0];

      return {
        total,
        active,
        inactive,
        totalUsage,
        mostUsed,
      };
    } catch (error: any) {
      this.logger.error('Failed to get template stats', { 
        error: error.message,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Duplicate template with new name
   */
  async duplicate(
    tenantContext: TenantContext, 
    templateId: string, 
    newName: string
  ): Promise<InvoiceTemplate> {
    await this.setTenantContext(tenantContext);

    try {
      const originalTemplate = await this.findById(tenantContext, templateId);
      if (!originalTemplate) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
      }

      // Check if new name is available
      const existing = await this.findByName(tenantContext, newName);
      if (existing) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          `Template with name "${newName}" already exists`,
          400
        );
      }

      // Create duplicate
      const duplicateData: CreateInvoiceTemplateData = {
        name: newName,
        description: originalTemplate.description ? `Copy of ${originalTemplate.description}` : undefined,
        defaultTitle: originalTemplate.defaultTitle,
        defaultDescription: originalTemplate.defaultDescription,
        defaultDueDays: originalTemplate.defaultDueDays,
        defaultNetworkId: originalTemplate.defaultNetworkId,
        defaultTokenId: originalTemplate.defaultTokenId,
        configuration: { ...originalTemplate.configuration },
        createdBy: tenantContext.userId || originalTemplate.createdBy,
      };

      const duplicatedTemplate = await this.create(tenantContext, duplicateData);

      this.logger.info('Template duplicated', { 
        originalId: templateId,
        duplicateId: duplicatedTemplate.id,
        newName,
        tenantId: tenantContext.tenantId 
      });

      return duplicatedTemplate;
    } catch (error: any) {
      this.logger.error('Failed to duplicate template', { 
        error: error.message,
        templateId,
        newName,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }
}