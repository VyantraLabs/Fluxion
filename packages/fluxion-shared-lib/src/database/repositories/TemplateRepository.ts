import { FindOptionsWhere, FindManyOptions, DeepPartial, Like, In, Not } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { Template } from '../entities/Template';
import { TenantContext, PaginatedResult, QueryOptions } from '../../types/common';
import { FluxionError, ErrorCodes } from '../../types/common';
import { Logger } from '../../utils/logger';
import { ulid } from 'ulid';

export interface CreateTemplateData {
  name: string;
  description?: string;
  categoryId: string;
  content: Record<string, any>;
  organizationId?: string; // null for system templates
  templateType?: string;
  s3TemplateUrl?: string;
  previewImageUrl?: string;
  isPublic?: boolean;
  tags?: string[];
  variables?: Record<string, any>;
}

export interface UpdateTemplateData {
  name?: string;
  description?: string;
  categoryId?: string;
  content?: Record<string, any>;
  isActive?: boolean;
  templateType?: string;
  s3TemplateUrl?: string;
  previewImageUrl?: string;
  isPublic?: boolean;
  tags?: string[];
  variables?: Record<string, any>;
}

export interface TemplateSearchOptions {
  categoryId?: string;
  categoryIds?: string[]; // Array of category IDs to filter by
  organizationIds?: string[]; // Array of organization IDs to filter by
  isActive?: boolean;
  name?: string;
  isSystemTemplate?: boolean; // true for system templates (organizationId is null)
  templateType?: string;
  isPublic?: boolean;
  tags?: string[];
}


/**
 * Repository for managing templates with multi-tenant support
 * System templates (organizationId = null) are available to all tenants
 * Organization templates (organizationId set) are only available to that organization
 */
export class TemplateRepository extends BaseRepository<Template> {
  constructor() {
    super(Template, 'Template');
  }

  /**
   * Create a new template
   * @param tenantContext - Tenant context (only used for organization templates)
   * @param data - Template creation data
   */
  async create(tenantContext: TenantContext, data: CreateTemplateData): Promise<Template> {
    try {
      const templateData: DeepPartial<Template> = {
        id: ulid(),
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        content: data.content,
        organizationId: data.organizationId || undefined, // undefined for system templates
        templateType: data.templateType || 'custom',
        s3TemplateUrl: data.s3TemplateUrl,
        previewImageUrl: data.previewImageUrl,
        isPublic: data.isPublic || false,
        tags: data.tags,
        variables: data.variables || {},
        isActive: true,
      };

      const entity = this.repository.create(templateData);
      const savedEntity = await this.repository.save(entity);
      
      this.logger.info('Template created', {
        templateId: savedEntity.id,
        name: savedEntity.name,
        isSystem: savedEntity.isSystemTemplate,
        categoryId: savedEntity.categoryId,
        organizationId: savedEntity.organizationId,
      });
      
      return savedEntity;
    } catch (error: any) {
      this.logger.error('Failed to create template', {
        error: error.message,
        templateName: data.name,
        organizationId: data.organizationId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create template',
        500,
        error
      );
    }
  }

  /**
   * Find template by ID with tenant access control
   * Users can access:
   * 1. System templates (organizationId = null)
   * 2. Their organization's templates (organizationId = tenantId)
   */
  async findById(tenantContext: TenantContext, id: string): Promise<Template | null> {
    try {
      const template = await this.repository.findOne({
        where: {
          id,
          // Allow access to system templates OR organization templates
          organizationId: tenantContext.tenantId
        } as FindOptionsWhere<Template>,
        relations: ['category'],
      });

      // If not found in organization templates, try system templates
      if (!template) {
        const systemTemplate = await this.repository.findOne({
          where: {
            id,
            organizationId: undefined, // System templates
          } as FindOptionsWhere<Template>,
          relations: ['category'],
        });
        return systemTemplate;
      }

      return template;
    } catch (error: any) {
      this.logger.error('Failed to find template by ID', {
        error: error.message,
        templateId: id,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find template',
        500,
        error
      );
    }
  }

  /**
   * Find templates with access control and filtering
   */
  async find(
    tenantContext: TenantContext, 
    options: FindManyOptions<Template> = {}
  ): Promise<Template[]> {
    try {
      // Build where condition to include system templates and organization templates
      const baseWhere = options.where || {};
      
      const templates = await this.repository.find({
        ...options,
        where: [
          // Organization templates
          {
            ...baseWhere,
            organizationId: tenantContext.tenantId,
          },
          // System templates  
          {
            ...baseWhere,
            organizationId: undefined,
          },
        ],
        relations: ['category'],
      });

      this.logger.debug('Templates found', {
        count: templates.length,
        tenantId: tenantContext.tenantId,
      });

      return templates;
    } catch (error: any) {
      this.logger.error('Failed to find templates', {
        error: error.message,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find templates',
        500,
        error
      );
    }
  }

  /**
   * Update template with tenant access control
   * Only organization templates can be updated by tenant users
   */
  async update(
    tenantContext: TenantContext,
    id: string,
    updateData: UpdateTemplateData
  ): Promise<Template> {
    try {
      // First find the template to ensure it belongs to the tenant and is not a system template
      const template = await this.repository.findOne({
        where: {
          id,
          organizationId: tenantContext.tenantId, // Only allow updating organization templates
        },
      });

      if (!template) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Template not found or you do not have permission to update it',
          404
        );
      }

      // Perform update
      await this.repository.update(id, updateData);
      
      // Fetch updated template
      const updatedTemplate = await this.findById(tenantContext, id);
      
      this.logger.info('Template updated', {
        templateId: id,
        tenantId: tenantContext.tenantId,
        updateFields: Object.keys(updateData),
      });
      
      return updatedTemplate!;
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      
      this.logger.error('Failed to update template', {
        error: error.message,
        templateId: id,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update template',
        500,
        error
      );
    }
  }

  /**
   * Delete template (soft delete)
   * Only organization templates can be deleted
   */
  async delete(tenantContext: TenantContext, id: string): Promise<void> {
    try {
      // First find the template to ensure it belongs to the tenant and is not a system template
      const template = await this.repository.findOne({
        where: {
          id,
          organizationId: tenantContext.tenantId, // Only allow deleting organization templates
        },
      });

      if (!template) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Template not found or you do not have permission to delete it',
          404
        );
      }

      // Perform soft delete
      await this.repository.softDelete(id);
      
      this.logger.info('Template deleted', {
        templateId: id,
        tenantId: tenantContext.tenantId,
      });
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      
      this.logger.error('Failed to delete template', {
        error: error.message,
        templateId: id,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to delete template',
        500,
        error
      );
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
    try {
      const { limit = 50, skip = 0 } = queryOptions;

      // Build base where conditions
      const baseConditions: any = {};
      
      // Handle single category ID or array of category IDs
      if (searchOptions.categoryId) {
        baseConditions.categoryId = searchOptions.categoryId;
      } else if (searchOptions.categoryIds && searchOptions.categoryIds.length > 0) {
        baseConditions.categoryId = In(searchOptions.categoryIds);
      }
      
      if (searchOptions.isActive !== undefined) {
        baseConditions.isActive = searchOptions.isActive;
      }
      
      if (searchOptions.name) {
        baseConditions.name = Like(`%${searchOptions.name}%`);
      }

      if (searchOptions.templateType) {
        baseConditions.templateType = searchOptions.templateType;
      }

      if (searchOptions.isPublic !== undefined) {
        baseConditions.isPublic = searchOptions.isPublic;
      }

      if (searchOptions.tags && searchOptions.tags.length > 0) {
        baseConditions.tags = In(searchOptions.tags);
      }

      // Build where array for organization-based filtering
      const whereConditions: any[] = [];
      
      // Use organizationIds array if provided, otherwise fall back to legacy logic
      if (searchOptions.organizationIds && searchOptions.organizationIds.length > 0) {
        // Filter by specific organization IDs
        searchOptions.organizationIds.forEach(orgId => {
          whereConditions.push({
            ...baseConditions,
            organizationId: orgId,
          });
        });
      } else if (searchOptions.isSystemTemplate === true) {
        // Only system templates (legacy support)
        whereConditions.push({
          ...baseConditions,
          organizationId: '010000000000000000000000', // System organization ID
        });
      } else if (searchOptions.isSystemTemplate === false) {
        // Only organization templates (legacy support)
        whereConditions.push({
          ...baseConditions,
          organizationId: tenantContext.tenantId,
        });
      } else {
        // Both system and organization templates (legacy support)
        whereConditions.push(
          {
            ...baseConditions,
            organizationId: tenantContext.tenantId,
          },
          {
            ...baseConditions,
            organizationId: '010000000000000000000000', // System organization ID
          }
        );
      }

      const [items, total] = await this.repository.findAndCount({
        where: whereConditions,
        relations: ['category'],
        skip,
        take: limit,
        order: {
          createdAt: 'DESC',
        },
      });
      
      const page = Math.floor(skip / limit) + 1;
      const totalPages = Math.ceil(total / limit);
      
      this.logger.debug('Templates search completed', {
        searchOptions,
        itemsCount: items.length,
        total,
        page,
        totalPages,
        tenantId: tenantContext.tenantId,
      });
      
      return {
        items,
        total,
        totalCount: total,
        hasMore: skip + limit < total,
      };
    } catch (error: any) {
      this.logger.error('Failed to search templates', {
        error: error.message,
        searchOptions,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to search templates',
        500,
        error
      );
    }
  }

  /**
   * Get active templates for a tenant (system + organization)
   */
  async getActiveTemplates(tenantContext: TenantContext): Promise<Template[]> {
    return this.find(tenantContext, {
      where: {
        isActive: true,
      },
      order: {
        name: 'ASC',
      },
    });
  }

  /**
   * Get system templates only
   */
  async getSystemTemplates(categoryId?: string): Promise<Template[]> {
    try {
      const where: FindOptionsWhere<Template> = {
        organizationId: undefined, // System templates
        isActive: true,
      };
      
      if (categoryId) {
        where.categoryId = categoryId;
      }

      const templates = await this.repository.find({
        where,
        relations: ['category'],
        order: {
          name: 'ASC',
        },
      });

      this.logger.debug('System templates retrieved', {
        count: templates.length,
        categoryId,
      });

      return templates;
    } catch (error: any) {
      this.logger.error('Failed to get system templates', {
        error: error.message,
        categoryId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to get system templates',
        500,
        error
      );
    }
  }

  /**
   * Get organization templates only
   */
  async getOrganizationTemplates(
    tenantContext: TenantContext,
    categoryId?: string
  ): Promise<Template[]> {
    try {
      const where: FindOptionsWhere<Template> = {
        organizationId: tenantContext.tenantId,
        isActive: true,
      };
      
      if (categoryId) {
        where.categoryId = categoryId;
      }

      const templates = await this.repository.find({
        where,
        relations: ['category'],
        order: {
          name: 'ASC',
        },
      });

      this.logger.debug('Organization templates retrieved', {
        count: templates.length,
        categoryId,
        tenantId: tenantContext.tenantId,
      });

      return templates;
    } catch (error: any) {
      this.logger.error('Failed to get organization templates', {
        error: error.message,
        categoryId,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to get organization templates',
        500,
        error
      );
    }
  }

  /**
   * Count templates in a specific category for a tenant (system + organization)
   */
  async countTemplatesByCategory(
    tenantContext: TenantContext,
    categoryId: string
  ): Promise<number> {
    try {
      const count = await this.repository.count({
        where: [
          // Organization templates
          {
            categoryId,
            organizationId: tenantContext.tenantId,
          },
          // System templates
          {
            categoryId,
            organizationId: undefined,
          },
        ],
      });

      this.logger.debug('Templates counted for category', {
        categoryId,
        count,
        tenantId: tenantContext.tenantId,
      });

      return count;
    } catch (error: any) {
      this.logger.error('Failed to count templates by category', {
        error: error.message,
        categoryId,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to count templates by category',
        500,
        error
      );
    }
  }

  /**
   * Count templates by all categories for a tenant (system + organization)
   */
  async countTemplatesByAllCategories(
    tenantContext: TenantContext
  ): Promise<Record<string, number>> {
    try {
      const result = await this.repository
        .createQueryBuilder('template')
        .select('template.categoryId', 'categoryId')
        .addSelect('COUNT(template.id)', 'count')
        .where(
          '(template.organizationId = :tenantId OR template.organizationId IS NULL) AND template.deletedAt IS NULL',
          { tenantId: tenantContext.tenantId }
        )
        .groupBy('template.categoryId')
        .getRawMany();

      const counts: Record<string, number> = {};
      result.forEach(row => {
        counts[row.categoryId] = parseInt(row.count, 10);
      });

      this.logger.debug('Template counts by all categories retrieved', {
        categoriesCount: Object.keys(counts).length,
        tenantId: tenantContext.tenantId,
      });

      return counts;
    } catch (error: any) {
      this.logger.error('Failed to count templates by all categories', {
        error: error.message,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to count templates by all categories',
        500,
        error
      );
    }
  }

  /**
   * Duplicate an existing template (creates organization template from system or organization template)
   */
  async duplicateTemplate(
    tenantContext: TenantContext,
    templateId: string,
    newName: string
  ): Promise<Template> {
    try {
      // Find the source template (system or organization)
      const sourceTemplate = await this.findById(tenantContext, templateId);
      
      if (!sourceTemplate) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Source template not found',
          404
        );
      }

      // Create new template based on source (always creates organization template)
      const duplicatedTemplate = await this.create(tenantContext, {
        name: newName,
        description: sourceTemplate.description,
        categoryId: sourceTemplate.categoryId,
        content: JSON.parse(JSON.stringify(sourceTemplate.content)), // Deep copy
        organizationId: tenantContext.tenantId, // Always create as organization template
      });

      this.logger.info('Template duplicated successfully', {
        sourceTemplateId: templateId,
        newTemplateId: duplicatedTemplate.id,
        newName,
        tenantId: tenantContext.tenantId,
      });

      return duplicatedTemplate;
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      
      this.logger.error('Failed to duplicate template', {
        error: error.message,
        templateId,
        newName,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to duplicate template',
        500,
        error
      );
    }
  }

  /**
   * Get template statistics for a tenant
   */
  async getTemplateStats(tenantContext: TenantContext): Promise<{
    total: number;
    systemTemplates: number;
    organizationTemplates: number;
    activeTemplates: number;
    inactiveTemplates: number;
  }> {
    try {
      const [systemTemplates, organizationTemplates, activeTemplates, inactiveTemplates] = await Promise.all([
        this.repository.count({ where: { organizationId: undefined } }),
        this.repository.count({ where: { organizationId: tenantContext.tenantId } }),
        this.repository.count({
          where: [
            { organizationId: tenantContext.tenantId, isActive: true },
            { organizationId: undefined, isActive: true },
          ],
        }),
        this.repository.count({
          where: [
            { organizationId: tenantContext.tenantId, isActive: false },
            { organizationId: undefined, isActive: false },
          ],
        }),
      ]);

      const total = systemTemplates + organizationTemplates;

      const stats = {
        total,
        systemTemplates,
        organizationTemplates,
        activeTemplates,
        inactiveTemplates,
      };

      this.logger.debug('Template statistics retrieved', {
        stats,
        tenantId: tenantContext.tenantId,
      });

      return stats;
    } catch (error: any) {
      this.logger.error('Failed to get template statistics', {
        error: error.message,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to get template statistics',
        500,
        error
      );
    }
  }

  /**
   * Increment usage count for a template
   * Note: The current Template entity doesn't have a usage_count field
   * This is a placeholder for future usage tracking
   */
  async incrementUsageCount(
    tenantContext: TenantContext,
    templateId: string
  ): Promise<void> {
    try {
      // Verify template exists and user has access
      const template = await this.findById(tenantContext, templateId);
      
      if (!template) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Template not found',
          404
        );
      }

      // TODO: Implement usage tracking when usage_count field is added to Template entity
      // await this.repository.increment({ id: templateId }, 'usageCount', 1);

      this.logger.debug('Template usage incremented (placeholder)', {
        templateId,
        tenantId: tenantContext.tenantId,
      });
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      
      this.logger.error('Failed to increment template usage count', {
        error: error.message,
        templateId,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to increment template usage count',
        500,
        error
      );
    }
  }
}

