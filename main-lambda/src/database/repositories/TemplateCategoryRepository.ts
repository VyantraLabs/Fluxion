import { FindOptionsWhere, FindManyOptions, DeepPartial } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { TemplateCategory } from '@/database/entities/TemplateCategory';
import { TenantContext } from '@/types/common';
import { FluxionError, ErrorCodes } from '@/types/common';
import { Logger } from '@/shared/utils/logger';
import { ulid } from 'ulid';

export interface CreateTemplateCategoryData {
  name: string;
  description?: string;
  slug: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isSystem?: boolean;
}

export interface UpdateTemplateCategoryData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * Repository for managing template categories
 * Template categories are global (not tenant-specific) but have system/custom distinction
 */
export class TemplateCategoryRepository extends BaseRepository<TemplateCategory> {
  private logger: Logger;

  constructor() {
    super(TemplateCategory, 'TemplateCategory');
    this.logger = new Logger('TemplateCategoryRepository');
  }

  /**
   * Create a new template category
   */
  async create(_tenantContext: TenantContext, data: CreateTemplateCategoryData): Promise<TemplateCategory> {
    try {
      const categoryData: DeepPartial<TemplateCategory> = {
        id: ulid(),
        name: data.name,
        description: data.description,
        slug: data.slug,
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder || 0,
        isSystem: data.isSystem || false,
        isActive: true,
      };

      const entity = this.repository.create(categoryData);
      const savedEntity = await this.repository.save(entity);
      
      this.logger.info('Template category created', {
        categoryId: savedEntity.id,
        name: savedEntity.name,
        slug: savedEntity.slug,
        isSystem: savedEntity.isSystem,
      });
      
      return savedEntity;
    } catch (error: any) {
      this.logger.error('Failed to create template category', {
        error: error.message,
        categoryName: data.name,
        slug: data.slug,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create template category',
        500,
        error
      );
    }
  }

  /**
   * Find category by ID
   */
  async findById(_tenantContext: TenantContext, id: string): Promise<TemplateCategory | null> {
    try {
      const category = await this.repository.findOne({
        where: { id },
        relations: ['templates'],
      });

      return category;
    } catch (error: any) {
      this.logger.error('Failed to find template category by ID', {
        error: error.message,
        categoryId: id,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find template category',
        500,
        error
      );
    }
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string): Promise<TemplateCategory | null> {
    try {
      const category = await this.repository.findOne({
        where: { slug },
        relations: ['templates'],
      });

      return category;
    } catch (error: any) {
      this.logger.error('Failed to find template category by slug', {
        error: error.message,
        slug,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find template category by slug',
        500,
        error
      );
    }
  }

  /**
   * Get all active categories
   */
  async getActiveCategories(): Promise<TemplateCategory[]> {
    try {
      const categories = await this.repository.find({
        where: { isActive: true },
        order: {
          sortOrder: 'ASC',
          name: 'ASC',
        },
      });

      this.logger.debug('Active template categories retrieved', {
        count: categories.length,
      });

      return categories;
    } catch (error: any) {
      this.logger.error('Failed to get active template categories', {
        error: error.message,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to get active template categories',
        500,
        error
      );
    }
  }

  /**
   * Get system categories only
   */
  async getSystemCategories(): Promise<TemplateCategory[]> {
    try {
      const categories = await this.repository.find({
        where: {
          isSystem: true,
          isActive: true,
        },
        order: {
          sortOrder: 'ASC',
          name: 'ASC',
        },
      });

      this.logger.debug('System template categories retrieved', {
        count: categories.length,
      });

      return categories;
    } catch (error: any) {
      this.logger.error('Failed to get system template categories', {
        error: error.message,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to get system template categories',
        500,
        error
      );
    }
  }

  /**
   * Update category
   */
  async update(
    _tenantContext: TenantContext,
    id: string,
    updateData: UpdateTemplateCategoryData
  ): Promise<TemplateCategory> {
    try {
      const category = await this.repository.findOne({ where: { id } });
      
      if (!category) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Template category not found',
          404
        );
      }

      // Only allow updating non-system categories for most fields
      if (category.isSystem && (updateData.name || updateData.slug)) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Cannot modify name or slug of system categories',
          400
        );
      }

      // Perform update
      await this.repository.update(id, updateData);
      
      // Fetch updated category
      const updatedCategory = await this.findById(_tenantContext, id);
      
      this.logger.info('Template category updated', {
        categoryId: id,
        updateFields: Object.keys(updateData),
      });
      
      return updatedCategory!;
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      
      this.logger.error('Failed to update template category', {
        error: error.message,
        categoryId: id,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update template category',
        500,
        error
      );
    }
  }

  /**
   * Delete category (only non-system categories)
   */
  async delete(_tenantContext: TenantContext, id: string): Promise<void> {
    try {
      const category = await this.repository.findOne({ where: { id } });
      
      if (!category) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Template category not found',
          404
        );
      }

      if (category.isSystem) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Cannot delete system categories',
          400
        );
      }

      // Check if category has templates
      const templatesCount = await this.repository
        .createQueryBuilder('category')
        .leftJoin('category.templates', 'template')
        .where('category.id = :categoryId', { categoryId: id })
        .andWhere('template.deletedAt IS NULL')
        .getCount();

      if (templatesCount > 0) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Cannot delete category that contains templates',
          400,
          { templatesCount }
        );
      }

      // Perform hard delete for categories (they don't have soft delete)
      await this.repository.delete(id);
      
      this.logger.info('Template category deleted', {
        categoryId: id,
      });
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      
      this.logger.error('Failed to delete template category', {
        error: error.message,
        categoryId: id,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to delete template category',
        500,
        error
      );
    }
  }

  /**
   * Reorder categories
   */
  async reorderCategories(categoryOrders: Array<{ id: string; sortOrder: number }>): Promise<void> {
    try {
      for (const { id, sortOrder } of categoryOrders) {
        await this.repository.update(id, { sortOrder });
      }

      this.logger.info('Template categories reordered', {
        categoriesCount: categoryOrders.length,
      });
    } catch (error: any) {
      this.logger.error('Failed to reorder template categories', {
        error: error.message,
        categoriesCount: categoryOrders.length,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to reorder template categories',
        500,
        error
      );
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<{
    totalCategories: number;
    systemCategories: number;
    customCategories: number;
    activeCategories: number;
    inactiveCategories: number;
  }> {
    try {
      const [total, system, active] = await Promise.all([
        this.repository.count(),
        this.repository.count({ where: { isSystem: true } }),
        this.repository.count({ where: { isActive: true } }),
      ]);

      const stats = {
        totalCategories: total,
        systemCategories: system,
        customCategories: total - system,
        activeCategories: active,
        inactiveCategories: total - active,
      };

      this.logger.debug('Category statistics retrieved', { stats });

      return stats;
    } catch (error: any) {
      this.logger.error('Failed to get category statistics', {
        error: error.message,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to get category statistics',
        500,
        error
      );
    }
  }
}
