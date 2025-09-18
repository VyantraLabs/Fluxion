import { FindOptionsWhere } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { Organization } from '../entities/Organization';
import { TenantContext, FluxionError, ErrorCodes } from '../../types/common';

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

  /**
   * Find organization by ID without tenant context (for global access)
   */
  async findByIdGlobal(organizationId: string): Promise<Organization | null> {
    try {
      const organization = await this.repository.findOne({
        where: { id: organizationId } as FindOptionsWhere<Organization>,
        relations: ['organizationSettings'],
      });
      
      this.logger.debug('Organization found by ID', { 
        organizationId, 
        found: !!organization,
      });
      
      return organization;
    } catch (error: any) {
      this.logger.error('Failed to find organization by ID', { 
        error: error.message, 
        organizationId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to find organization by ID',
        500,
        error
      );
    }
  }

  /**
   * Create organization with settings (used by user creation)
   */
  async createWithSettings(organizationData: {
    id?: string;
    name: string;
    slug: string;
    plan?: string;
    settings?: any;
  }): Promise<Organization> {
    try {
      return await this.transaction(async (transactionalRepo) => {
        // Create organization
        const organization = transactionalRepo.create({
          id: organizationData.id || this.generateId(),
          name: organizationData.name,
          slug: organizationData.slug,
          plan: (organizationData.plan || 'basic') as 'basic' | 'professional' | 'enterprise',
          settings: organizationData.settings || {
            timezone: 'UTC',
            currency: 'USD',
            invoiceNumberPrefix: 'INV',
            paymentTerms: 30,
            features: {
              multiCurrency: false,
              customBranding: false,
              advancedReporting: false
            }
          }
        });

        const savedOrganization = await transactionalRepo.save(organization);
        
        this.logger.info('Organization created with settings', {
          id: savedOrganization.id,
          name: savedOrganization.name,
          slug: savedOrganization.slug
        });

        return savedOrganization;
      });
    } catch (error: any) {
      this.logger.error('Failed to create organization with settings', {
        error: error.message,
        organizationData
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to create organization with settings',
        500,
        error
      );
    }
  }

  /**
   * Update organization name and slug (used for onboarding)
   */
  async updateNameAndSlug(
    organizationId: string,
    name: string,
    slug: string
  ): Promise<Organization> {
    try {
      // First verify organization exists (organizations don't use tenant context)
      const organization = await this.findByIdWithoutTenant(organizationId);
      if (!organization) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Organization not found',
          404
        );
      }

      // Check if new slug is available (excluding current org)
      const slugAvailable = await this.isSlugAvailable(slug, organizationId);
      if (!slugAvailable) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Organization slug is already in use',
          400
        );
      }

      await this.repository.update(organizationId, {
        name,
        slug,
        updatedAt: new Date()
      });

      const updatedOrganization = await this.findByIdWithoutTenant(organizationId);
      
      this.logger.info('Organization name and slug updated', {
        organizationId,
        newName: name,
        newSlug: slug
      });

      return updatedOrganization!;
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      this.logger.error('Failed to update organization name and slug', {
        error: error.message,
        organizationId,
        name,
        slug
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to update organization',
        500,
        error
      );
    }
  }

  /**
   * Get or create default organization (used for backward compatibility)
   */
  async getOrCreateDefaultOrganization(): Promise<Organization> {
    const defaultOrgId = '01HBXYZ0000000000000000000'; // Fixed ULID for consistency
    
    try {
      // First try to find existing default organization
      let defaultOrg = await this.findByIdWithoutTenant(defaultOrgId);
      
      if (!defaultOrg) {
        // Create default organization using raw query to ensure specific ULID
        const result = await this.query(`
          INSERT INTO organizations (
            id, name, slug, plan, settings, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING
          RETURNING id, name, slug
        `, [
          defaultOrgId,
          'Default Organization',
          'default',
          'basic',
          JSON.stringify({
            timezone: 'UTC',
            currency: 'USD',
            invoiceNumberPrefix: 'INV',
            paymentTerms: 30
          })
        ]);

        if (result.length > 0) {
          this.logger.info('Default organization created', { id: defaultOrgId });
        }
        
        // Fetch the organization (whether created or already existed)
        defaultOrg = await this.findByIdWithoutTenant(defaultOrgId);
      }

      if (!defaultOrg) {
        throw new Error(`Default organization ${defaultOrgId} could not be created or found`);
      }

      this.logger.debug('Using default organization', { 
        id: defaultOrg.id, 
        name: defaultOrg.name 
      });
      
      return defaultOrg;
    } catch (error: any) {
      this.logger.error('Failed to get or create default organization', { 
        error: error.message 
      });
      throw new FluxionError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to resolve default organization',
        500,
        error
      );
    }
  }

  /**
   * Generate organization slug from name and wallet address
   */
  generateSlug(name: string, walletAddress: string): string {
    // Create a slug from the organization name
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
    
    // Ensure it's not empty and add wallet suffix for uniqueness
    if (!slug || slug.length < 3) {
      slug = 'org-' + walletAddress.substring(2, 10).toLowerCase();
    } else {
      slug = slug + '-' + walletAddress.substring(2, 10).toLowerCase();
    }
    
    return slug;
  }
}