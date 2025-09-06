import { InvoiceTemplateRepository, CreateInvoiceTemplateData, UpdateInvoiceTemplateData, TemplateSearchOptions } from '@/database/repositories/InvoiceTemplateRepository';
import { InvoiceTemplate } from '@/database/entities/InvoiceTemplate';
import { TenantContext, PaginatedResult, QueryOptions } from '@/types/common';
import { FluxionError, ErrorCodes } from '@/types/common';
import { Logger } from '@/shared/utils/logger';

export interface CreateTemplateDto {
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

export interface UpdateTemplateDto {
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

export interface TemplatePreview {
  preview: {
    title: string;
    description: string;
    amount: number;
    dueDate: string;
    clientName: string;
    clientEmail: string;
    networkId?: string;
    tokenId?: string;
  };
  sampleData: {
    [key: string]: any;
  };
}

export class TemplateService {
  private templateRepository: InvoiceTemplateRepository;
  private logger: Logger;

  constructor() {
    this.templateRepository = new InvoiceTemplateRepository();
    this.logger = new Logger('TemplateService');
  }

  /**
   * Create a new invoice template
   */
  async createTemplate(
    tenantContext: TenantContext,
    templateData: CreateTemplateDto
  ): Promise<InvoiceTemplate> {
    this.logger.info('Creating invoice template', {
      name: templateData.name,
      tenantId: tenantContext.tenantId,
      createdBy: templateData.createdBy
    });

    try {
      const createData: CreateInvoiceTemplateData = {
        name: templateData.name,
        description: templateData.description,
        defaultTitle: templateData.defaultTitle,
        defaultDescription: templateData.defaultDescription,
        defaultDueDays: templateData.defaultDueDays,
        defaultNetworkId: templateData.defaultNetworkId,
        defaultTokenId: templateData.defaultTokenId,
        configuration: templateData.configuration,
        createdBy: templateData.createdBy
      };

      const template = await this.templateRepository.create(tenantContext, createData);

      this.logger.info('Invoice template created successfully', {
        templateId: template.id,
        name: template.name,
        tenantId: tenantContext.tenantId
      });

      return template;
    } catch (error: any) {
      this.logger.error('Failed to create invoice template', {
        error: error.message,
        templateData: { name: templateData.name },
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(
    tenantContext: TenantContext,
    templateId: string
  ): Promise<InvoiceTemplate> {
    this.logger.info('Retrieving template by ID', {
      templateId,
      tenantId: tenantContext.tenantId
    });

    const template = await this.templateRepository.findById(tenantContext, templateId);

    if (!template) {
      throw new FluxionError(
        ErrorCodes.NOT_FOUND,
        'Template not found',
        404
      );
    }

    return template;
  }

  /**
   * Update template
   */
  async updateTemplate(
    tenantContext: TenantContext,
    templateId: string,
    updateData: UpdateTemplateDto
  ): Promise<InvoiceTemplate> {
    this.logger.info('Updating template', {
      templateId,
      tenantId: tenantContext.tenantId
    });

    try {
      const updateTemplateData: UpdateInvoiceTemplateData = {
        name: updateData.name,
        description: updateData.description,
        defaultTitle: updateData.defaultTitle,
        defaultDescription: updateData.defaultDescription,
        defaultDueDays: updateData.defaultDueDays,
        defaultNetworkId: updateData.defaultNetworkId,
        defaultTokenId: updateData.defaultTokenId,
        configuration: updateData.configuration,
        isActive: updateData.isActive
      };

      const template = await this.templateRepository.update(
        tenantContext,
        templateId,
        updateTemplateData
      );

      this.logger.info('Template updated successfully', {
        templateId,
        tenantId: tenantContext.tenantId
      });

      return template;
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
   * Delete template (soft delete)
   */
  async deleteTemplate(
    tenantContext: TenantContext,
    templateId: string
  ): Promise<void> {
    this.logger.info('Deleting template', {
      templateId,
      tenantId: tenantContext.tenantId
    });

    try {
      await this.templateRepository.softDelete(tenantContext, templateId);

      this.logger.info('Template deleted successfully', {
        templateId,
        tenantId: tenantContext.tenantId
      });
    } catch (error: any) {
      this.logger.error('Failed to delete template', {
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
    this.logger.info('Searching templates', {
      searchOptions,
      queryOptions,
      tenantId: tenantContext.tenantId
    });

    try {
      const result = await this.templateRepository.searchTemplates(
        tenantContext,
        searchOptions,
        queryOptions
      );

      this.logger.info('Templates search completed', {
        count: result.items.length,
        total: result.total,
        tenantId: tenantContext.tenantId
      });

      return result;
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
   * Duplicate template
   */
  async duplicateTemplate(
    tenantContext: TenantContext,
    templateId: string,
    newName: string
  ): Promise<InvoiceTemplate> {
    this.logger.info('Duplicating template', {
      templateId,
      newName,
      tenantId: tenantContext.tenantId
    });

    try {
      const template = await this.templateRepository.duplicate(
        tenantContext,
        templateId,
        newName
      );

      this.logger.info('Template duplicated successfully', {
        originalId: templateId,
        duplicateId: template.id,
        newName,
        tenantId: tenantContext.tenantId
      });

      return template;
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

  /**
   * Generate template preview with sample data
   */
  async generateTemplatePreview(
    tenantContext: TenantContext,
    templateId: string
  ): Promise<TemplatePreview> {
    this.logger.info('Generating template preview', {
      templateId,
      tenantId: tenantContext.tenantId
    });

    try {
      const template = await this.getTemplateById(tenantContext, templateId);

      // Sample data for template variable substitution
      const sampleData = {
        client_name: 'Acme Corporation',
        client_email: 'contact@acme.com',
        month: new Date().toLocaleString('default', { month: 'long' }),
        year: new Date().getFullYear().toString(),
        project_id: 'PROJ-2025-001',
        service_period: `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
        amount: 2500.00,
        creator_name: 'John Doe'
      };

      // Template variable substitution function
      const substituteVariables = (text: string | undefined, data: any): string => {
        if (!text) return '';
        
        return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
          const trimmedKey = key.trim();
          return data[trimmedKey] !== undefined ? data[trimmedKey].toString() : match;
        });
      };

      // Generate preview data
      const preview = {
        title: substituteVariables(template.defaultTitle, sampleData) || 'Sample Invoice Title',
        description: substituteVariables(template.defaultDescription, sampleData) || 'Sample invoice description',
        amount: sampleData.amount,
        dueDate: new Date(Date.now() + (template.defaultDueDays || 30) * 24 * 60 * 60 * 1000).toISOString(),
        clientName: sampleData.client_name,
        clientEmail: sampleData.client_email,
        networkId: template.defaultNetworkId,
        tokenId: template.defaultTokenId
      };

      this.logger.info('Template preview generated successfully', {
        templateId,
        tenantId: tenantContext.tenantId
      });

      return {
        preview,
        sampleData
      };
    } catch (error: any) {
      this.logger.error('Failed to generate template preview', {
        error: error.message,
        templateId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get template usage statistics
   */
  async getTemplateStats(tenantContext: TenantContext): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalUsage: number;
    mostUsed?: InvoiceTemplate;
  }> {
    this.logger.info('Retrieving template statistics', {
      tenantId: tenantContext.tenantId
    });

    try {
      const stats = await this.templateRepository.getTemplateStats(tenantContext);

      this.logger.info('Template statistics retrieved successfully', {
        stats: {
          total: stats.total,
          active: stats.active,
          totalUsage: stats.totalUsage
        },
        tenantId: tenantContext.tenantId
      });

      return stats;
    } catch (error: any) {
      this.logger.error('Failed to get template statistics', {
        error: error.message,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get active templates for invoice creation
   */
  async getActiveTemplates(tenantContext: TenantContext): Promise<InvoiceTemplate[]> {
    this.logger.info('Retrieving active templates', {
      tenantId: tenantContext.tenantId
    });

    try {
      const templates = await this.templateRepository.getActiveTemplates(tenantContext);

      this.logger.info('Active templates retrieved successfully', {
        count: templates.length,
        tenantId: tenantContext.tenantId
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
  async getPopularTemplates(
    tenantContext: TenantContext,
    limit = 10
  ): Promise<InvoiceTemplate[]> {
    this.logger.info('Retrieving popular templates', {
      limit,
      tenantId: tenantContext.tenantId
    });

    try {
      const templates = await this.templateRepository.getPopularTemplates(tenantContext, limit);

      this.logger.info('Popular templates retrieved successfully', {
        count: templates.length,
        limit,
        tenantId: tenantContext.tenantId
      });

      return templates;
    } catch (error: any) {
      this.logger.error('Failed to get popular templates', {
        error: error.message,
        limit,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Create invoice from template
   */
  async createInvoiceFromTemplate(
    tenantContext: TenantContext,
    templateId: string,
    invoiceData: {
      clientName: string;
      clientEmail: string;
      clientWallet?: string;
      amount: number;
      dueDate?: string;
      customData?: Record<string, any>;
    }
  ): Promise<{
    title: string;
    description: string;
    amount: number;
    dueDate: string;
    clientName: string;
    clientEmail: string;
    clientWallet?: string;
    networkId?: string;
    tokenId?: string;
  }> {
    this.logger.info('Creating invoice from template', {
      templateId,
      tenantId: tenantContext.tenantId
    });

    try {
      const template = await this.getTemplateById(tenantContext, templateId);

      // Increment template usage count
      await this.templateRepository.incrementUsageCount(tenantContext, templateId);

      // Template data for variable substitution
      const templateData = {
        client_name: invoiceData.clientName,
        client_email: invoiceData.clientEmail,
        amount: invoiceData.amount,
        month: new Date().toLocaleString('default', { month: 'long' }),
        year: new Date().getFullYear().toString(),
        ...invoiceData.customData
      };

      // Template variable substitution function
      const substituteVariables = (text: string | undefined, data: any): string => {
        if (!text) return '';
        
        return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
          const trimmedKey = key.trim();
          return data[trimmedKey] !== undefined ? data[trimmedKey].toString() : match;
        });
      };

      // Calculate due date
      const dueDate = invoiceData.dueDate || 
        new Date(Date.now() + (template.defaultDueDays || 30) * 24 * 60 * 60 * 1000).toISOString();

      const result = {
        title: substituteVariables(template.defaultTitle, templateData) || `Invoice for ${invoiceData.clientName}`,
        description: substituteVariables(template.defaultDescription, templateData) || 'Invoice description',
        amount: invoiceData.amount,
        dueDate,
        clientName: invoiceData.clientName,
        clientEmail: invoiceData.clientEmail,
        clientWallet: invoiceData.clientWallet,
        networkId: template.defaultNetworkId,
        tokenId: template.defaultTokenId
      };

      this.logger.info('Invoice data created from template successfully', {
        templateId,
        invoiceTitle: result.title,
        tenantId: tenantContext.tenantId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to create invoice from template', {
        error: error.message,
        templateId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }
}