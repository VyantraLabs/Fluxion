import { repositories } from '../../database/repositories';
import { TemplateRepository, CreateTemplateData, UpdateTemplateData, TemplateSearchOptions } from '../../database/repositories/TemplateRepository';
import { TemplateCategoryRepository } from '../../database/repositories/TemplateCategoryRepository';
import { Template } from '../../database/entities/Template';
import { TemplateCategory } from '../../database/entities/TemplateCategory';
import { TenantContext, PaginatedResult, QueryOptions } from '../../types/common';
import { FluxionError, ErrorCodes } from '../../types/common';
import { Logger } from '../../shared/utils/logger';

export interface CreateTemplateDto {
  name: string;
  description?: string;
  categoryId: string;
  content: Record<string, any>;
  isSystemTemplate?: boolean; // For admin use only
}

export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  categoryId?: string;
  content?: Record<string, any>;
  isActive?: boolean;
}

export interface TemplatePreview {
  renderedContent: Record<string, any>;
  sampleData: Record<string, any>;
}

export interface CategoryWithCount {
  id: string;
  name: string;
  description?: string;
  slug: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  count: number;
}

export class TemplateService {
  private templateRepository: TemplateRepository;
  private templateCategoryRepository: TemplateCategoryRepository;
  private logger: Logger;

  constructor() {
    this.templateRepository = repositories.templates;
    this.templateCategoryRepository = repositories.templateCategories;
    this.logger = new Logger('TemplateService');
  }

  /**
   * Create a new invoice template
   */
  async createTemplate(
    tenantContext: TenantContext,
    templateData: CreateTemplateDto
  ): Promise<Template> {
    this.logger.info('Creating template', {
      name: templateData.name,
      tenantId: tenantContext.tenantId,
      categoryId: templateData.categoryId
    });

    try {
      // Validate category exists
      const category = await this.templateCategoryRepository.findById(tenantContext, templateData.categoryId);
      if (!category) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Template category not found',
          404
        );
      }

      const createData: CreateTemplateData = {
        name: templateData.name,
        description: templateData.description,
        categoryId: templateData.categoryId,
        content: templateData.content,
        organizationId: templateData.isSystemTemplate ? undefined : tenantContext.tenantId,
      };

      const template = await this.templateRepository.create(tenantContext, createData);

      this.logger.info('Template created successfully', {
        templateId: template.id,
        name: template.name,
        isSystem: template.isSystemTemplate,
        tenantId: tenantContext.tenantId
      });

      return template;
    } catch (error: any) {
      this.logger.error('Failed to create template', {
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
  ): Promise<Template> {
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
  ): Promise<Template> {
    this.logger.info('Updating template', {
      templateId,
      tenantId: tenantContext.tenantId
    });

    try {
      // Validate category if provided
      if (updateData.categoryId) {
        const category = await this.templateCategoryRepository.findById(tenantContext, updateData.categoryId);
        if (!category) {
          throw new FluxionError(
            ErrorCodes.VALIDATION_ERROR,
            'Template category not found',
            404
          );
        }
      }

      const updateTemplateData: UpdateTemplateData = {
        name: updateData.name,
        description: updateData.description,
        categoryId: updateData.categoryId,
        content: updateData.content,
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
      await this.templateRepository.delete(tenantContext, templateId);

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
  ): Promise<PaginatedResult<Template>> {
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
  ): Promise<Template> {
    this.logger.info('Duplicating template', {
      templateId,
      newName,
      tenantId: tenantContext.tenantId
    });

    try {
      const template = await this.templateRepository.duplicateTemplate(
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
    mostUsed?: Template;
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
  async getActiveTemplates(tenantContext: TenantContext): Promise<Template[]> {
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
  ): Promise<Template[]> {
    this.logger.info('Retrieving popular templates', {
      limit,
      tenantId: tenantContext.tenantId
    });

    try {
      // Since popular templates are no longer supported in the new repository,
      // we'll return active templates ordered by name as a fallback
      const templates = await this.templateRepository.getActiveTemplates(tenantContext);

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

  /**
   * Get template categories with template counts
   */
  async getTemplateCategories(tenantContext: TenantContext): Promise<CategoryWithCount[]> {
    this.logger.info('Getting template categories', {
      tenantId: tenantContext.tenantId
    });

    try {
      // Get all active categories
      const activeCategories = await this.templateCategoryRepository.getActiveCategories();

      // Get template counts for each category with tenant-specific filtering
      const result: CategoryWithCount[] = [];
      
      for (const category of activeCategories) {
        // Count templates in this category for the current tenant (including system templates)
        const templateCount = await this.templateRepository.countTemplatesByCategory(
          tenantContext,
          category.id
        );

        result.push({
          id: category.id,
          name: category.name,
          description: category.description,
          slug: category.slug,
          icon: category.icon,
          color: category.color,
          sortOrder: category.sortOrder,
          isSystem: category.isSystem,
          isActive: category.isActive,
          count: templateCount,
        });
      }

      // Sort by sort order and name
      result.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return a.name.localeCompare(b.name);
      });

      this.logger.info('Template categories retrieved successfully', {
        categoriesCount: result.length,
        tenantId: tenantContext.tenantId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to get template categories', {
        error: error.message,
        tenantId: tenantContext.tenantId
      });
      throw new FluxionError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to retrieve template categories',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Get template with full S3 URLs constructed
   * This method ensures backward compatibility while using relative paths
   */
  async getTemplateWithFullUrls(
    tenantContext: TenantContext,
    templateId: string
  ): Promise<Template & { fullS3Url?: string; fullPreviewImageUrl?: string }> {
    this.logger.info('Retrieving template with full URLs', {
      templateId,
      tenantId: tenantContext.tenantId
    });

    const template = await this.getTemplateById(tenantContext, templateId);

    // URLs are now constructed via the entity getter methods
    return {
      ...template,
      fullS3Url: template.fullS3Url,
      fullPreviewImageUrl: template.fullPreviewImageUrl
    };
  }

  /**
   * Get system templates (public templates available to all organizations)
   */
  async getSystemTemplates(
    categoryId?: string,
    queryOptions: QueryOptions = {}
  ): Promise<PaginatedResult<Template>> {
    this.logger.info('Retrieving system templates', {
      categoryId,
      queryOptions
    });

    try {
      // Use a dummy tenant context for system templates since they're public
      const systemContext: TenantContext = {
        tenantId: 'system', // This won't be used for system templates
        userId: 'system',
        role: 'admin'
      };

      const searchOptions: TemplateSearchOptions = {
        isSystemTemplate: true,
        categoryId,
        isActive: true
      };

      const result = await this.templateRepository.searchTemplates(
        systemContext,
        searchOptions,
        queryOptions
      );

      this.logger.info('System templates retrieved successfully', {
        count: result.items.length,
        total: result.total,
        categoryId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to get system templates', {
        error: error.message,
        categoryId
      });
      throw error;
    }
  }

  /**
   * Get template content for rendering
   * Returns the template content stored in JSONB format
   */
  async getTemplateContent(
    tenantContext: TenantContext,
    templateId: string
  ): Promise<Record<string, any>> {
    this.logger.info('Fetching template content', {
      templateId,
      tenantId: tenantContext.tenantId
    });

    try {
      const template = await this.getTemplateById(tenantContext, templateId);

      this.logger.info('Template content retrieved', {
        templateId,
        contentKeys: Object.keys(template.content),
        tenantId: tenantContext.tenantId
      });

      return template.content;
    } catch (error: any) {
      this.logger.error('Failed to get template content', {
        error: error.message,
        templateId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Validate template structure and content
   */
  async validateTemplate(
    tenantContext: TenantContext,
    templateId: string
  ): Promise<{
    isValid: boolean;
    issues: string[];
    contentSummary: {
      hasContent: boolean;
      contentKeys: string[];
      contentSize: number;
    };
  }> {
    this.logger.info('Validating template', {
      templateId,
      tenantId: tenantContext.tenantId
    });

    try {
      const template = await this.getTemplateById(tenantContext, templateId);
      const issues: string[] = [];

      // Check if content is present
      if (!template.content || typeof template.content !== 'object') {
        issues.push('Missing or invalid template content');
      }

      // Check if template has a valid category
      if (!template.category) {
        issues.push('Template category not found or inactive');
      }

      // Validate template name
      if (!template.name || template.name.trim().length === 0) {
        issues.push('Template name is required');
      }

      const contentKeys = template.content ? Object.keys(template.content) : [];
      const contentSize = JSON.stringify(template.content || {}).length;

      const result = {
        isValid: issues.length === 0,
        issues,
        contentSummary: {
          hasContent: contentKeys.length > 0,
          contentKeys,
          contentSize,
        }
      };

      this.logger.info('Template validation completed', {
        templateId,
        isValid: result.isValid,
        issuesCount: issues.length,
        contentSize,
        tenantId: tenantContext.tenantId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to validate template', {
        error: error.message,
        templateId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }
}