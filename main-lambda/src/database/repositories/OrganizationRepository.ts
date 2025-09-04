import { FindOptionsWhere } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { Organization } from '../entities/Organization';
import { TenantContext, FluxionError, ErrorCodes } from '@/types/common';

export class OrganizationRepository extends BaseRepository<Organization> {
  constructor() {
    super(Organization, 'Organization');
  }

  /**
   * Find organization by slug
   */
  async findBySlug(slug: string): Promise<Organization | null> {
    try {
      const organization = await this.repository.findOne({
        where: { slug } as FindOptionsWhere<Organization>,
        relations: ['users', 'organizationSettings'],
      });
      
      this.logger.debug('Organization search by slug', { 
        slug, 
        found: !!organization,
      });
      
      return organization;
    } catch (error: any) {
      this.logger.error('Failed to find organization by slug', { 
        error: error.message, 
        slug,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find organization by slug',
        500,
        error
      );
    }
  }

  /**
   * Override create to not require tenant context for organizations
   */
  async create(tenantContext: TenantContext, data: Partial<Organization>): Promise<Organization> {
    try {
      const organization = this.repository.create(data);
      const savedOrganization = await this.repository.save(organization);
      
      this.logger.info('Organization created', { 
        id: savedOrganization.id,
        slug: savedOrganization.slug,
        name: savedOrganization.name,
      });
      
      return savedOrganization;
    } catch (error: any) {
      this.logger.error('Failed to create organization', { 
        error: error.message,
        data,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create organization',
        500,
        error
      );
    }
  }

  /**
   * Check if slug is available
   */
  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    try {
      const where: FindOptionsWhere<Organization> = { slug };
      
      if (excludeId) {
        (where as any).id = { $ne: excludeId };
      }

      const exists = await this.repository.exist({ where });
      
      this.logger.debug('Slug availability check', { 
        slug,
        available: !exists,
        excludeId,
      });
      
      return !exists;
    } catch (error: any) {
      this.logger.error('Failed to check slug availability', { 
        error: error.message,
        slug,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to check slug availability',
        500,
        error
      );
    }
  }
}