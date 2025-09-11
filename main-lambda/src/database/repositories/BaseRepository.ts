import { Repository, FindOptionsWhere, FindManyOptions, DeepPartial } from 'typeorm';
import { ulid } from 'ulid';
import { AppDataSource, setTenantContext, setUserContext } from '../data-source';
import { FluxionError, ErrorCodes, TenantContext } from '@/types/common';
import { Logger } from '@/shared/utils/logger';

/**
 * Base repository class providing common database operations
 * with multi-tenancy and audit logging support
 */
export abstract class BaseRepository<T extends { id: string; organizationId?: string }> {
  protected repository: Repository<T>;
  protected logger: Logger;
  protected entityName: string;

  constructor(entity: new () => T, entityName: string) {
    this.repository = AppDataSource.getRepository(entity);
    this.entityName = entityName;
    this.logger = new Logger(`${entityName}Repository`);
  }

  /**
   * Set tenant context for multi-tenant queries
   */
  protected async setTenantContext(tenantContext: TenantContext): Promise<void> {
    if (tenantContext.tenantId) {
      await setTenantContext(tenantContext.tenantId);
    }
    if (tenantContext.userId) {
      await setUserContext(tenantContext.userId);
    }
  }

  /**
   * Create a new entity
   */
  async create(tenantContext: TenantContext, data: DeepPartial<T>): Promise<T> {
    await this.setTenantContext(tenantContext);
    
    try {
      // Add organization ID for multi-tenant entities and generate ULID if not provided
      const entityData = {
        ...data,
        ...(this.isMultiTenant() && { organizationId: tenantContext.tenantId }),
        ...(!data.id && { id: ulid() }),
      } as DeepPartial<T>;

      const entity = this.repository.create(entityData);
      const savedEntity = await this.repository.save(entity);
      
      this.logger.info('Entity created', { 
        entityName: this.entityName, 
        id: savedEntity.id,
        tenantId: tenantContext.tenantId,
      });
      
      return savedEntity;
    } catch (error: any) {
      this.logger.error('Failed to create entity', { 
        error: error.message, 
        entityName: this.entityName,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to create ${this.entityName}`,
        500,
        error
      );
    }
  }

  /**
   * Find entity by ID
   */
  async findById(tenantContext: TenantContext, id: string): Promise<T | null> {
    await this.setTenantContext(tenantContext);
    
    try {
      const whereCondition: FindOptionsWhere<T> = { id } as FindOptionsWhere<T>;
      
      // Add tenant filter for multi-tenant entities
      if (this.isMultiTenant()) {
        (whereCondition as any).organizationId = tenantContext.tenantId;
      }

      const entity = await this.repository.findOne({ where: whereCondition });
      
      if (entity) {
        this.logger.debug('Entity found by ID', { 
          entityName: this.entityName, 
          id,
          tenantId: tenantContext.tenantId,
        });
      }
      
      return entity;
    } catch (error: any) {
      this.logger.error('Failed to find entity by ID', { 
        error: error.message, 
        entityName: this.entityName, 
        id,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to find ${this.entityName}`,
        500,
        error
      );
    }
  }

  /**
   * Find multiple entities with options
   */
  async find(tenantContext: TenantContext, options: FindManyOptions<T> = {}): Promise<T[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      // Add tenant filter for multi-tenant entities
      if (this.isMultiTenant()) {
        options.where = {
          ...options.where,
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<T>;
      }

      const entities = await this.repository.find(options);
      
      this.logger.debug('Entities found', { 
        entityName: this.entityName, 
        count: entities.length,
        tenantId: tenantContext.tenantId,
      });
      
      return entities;
    } catch (error: any) {
      this.logger.error('Failed to find entities', { 
        error: error.message, 
        entityName: this.entityName,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to find ${this.entityName} records`,
        500,
        error
      );
    }
  }

  /**
   * Update entity by ID
   */
  async update(tenantContext: TenantContext, id: string, updates: DeepPartial<T>): Promise<T> {
    await this.setTenantContext(tenantContext);
    
    try {
      // First, find the entity to ensure it exists and belongs to tenant
      const entity = await this.findById(tenantContext, id);
      if (!entity) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          `${this.entityName} not found`,
          404
        );
      }

      // Remove organization ID from updates to prevent tampering
      const { organizationId, ...safeUpdates } = updates as any;
      
      // Perform update
      await this.repository.update(id, safeUpdates);
      
      // Fetch updated entity
      const updatedEntity = await this.findById(tenantContext, id);
      
      this.logger.info('Entity updated', { 
        entityName: this.entityName, 
        id,
        tenantId: tenantContext.tenantId,
        updateFields: Object.keys(safeUpdates),
      });
      
      return updatedEntity!;
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      
      this.logger.error('Failed to update entity', { 
        error: error.message, 
        entityName: this.entityName, 
        id,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to update ${this.entityName}`,
        500,
        error
      );
    }
  }

  /**
   * Delete entity by ID (soft delete if supported)
   */
  async delete(tenantContext: TenantContext, id: string): Promise<void> {
    await this.setTenantContext(tenantContext);
    
    try {
      // First, find the entity to ensure it exists and belongs to tenant
      const entity = await this.findById(tenantContext, id);
      if (!entity) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          `${this.entityName} not found`,
          404
        );
      }

      // Check if entity supports soft delete
      if (this.supportsSoftDelete()) {
        await this.repository.softDelete(id);
        this.logger.info('Entity soft deleted', { 
          entityName: this.entityName, 
          id,
          tenantId: tenantContext.tenantId,
        });
      } else {
        await this.repository.delete(id);
        this.logger.info('Entity hard deleted', { 
          entityName: this.entityName, 
          id,
          tenantId: tenantContext.tenantId,
        });
      }
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      
      this.logger.error('Failed to delete entity', { 
        error: error.message, 
        entityName: this.entityName, 
        id,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to delete ${this.entityName}`,
        500,
        error
      );
    }
  }

  /**
   * Count entities with optional conditions
   */
  async count(tenantContext: TenantContext, where: FindOptionsWhere<T> = {}): Promise<number> {
    await this.setTenantContext(tenantContext);
    
    try {
      // Add tenant filter for multi-tenant entities
      if (this.isMultiTenant()) {
        (where as any).organizationId = tenantContext.tenantId;
      }

      const count = await this.repository.count({ where });
      
      this.logger.debug('Entity count retrieved', { 
        entityName: this.entityName, 
        count,
        tenantId: tenantContext.tenantId,
      });
      
      return count;
    } catch (error: any) {
      this.logger.error('Failed to count entities', { 
        error: error.message, 
        entityName: this.entityName,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to count ${this.entityName} records`,
        500,
        error
      );
    }
  }

  /**
   * Check if entity exists
   */
  async exists(tenantContext: TenantContext, where: FindOptionsWhere<T>): Promise<boolean> {
    await this.setTenantContext(tenantContext);
    
    try {
      // Add tenant filter for multi-tenant entities
      if (this.isMultiTenant()) {
        (where as any).organizationId = tenantContext.tenantId;
      }

      const exists = await this.repository.exist({ where });
      
      this.logger.debug('Entity existence checked', { 
        entityName: this.entityName, 
        exists,
        tenantId: tenantContext.tenantId,
      });
      
      return exists;
    } catch (error: any) {
      this.logger.error('Failed to check entity existence', { 
        error: error.message, 
        entityName: this.entityName,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to check ${this.entityName} existence`,
        500,
        error
      );
    }
  }

  /**
   * Find with pagination
   */
  async findWithPagination(
    tenantContext: TenantContext,
    page = 1,
    limit = 50,
    options: Omit<FindManyOptions<T>, 'skip' | 'take'> = {}
  ): Promise<{ items: T[]; total: number; page: number; limit: number; totalPages: number }> {
    await this.setTenantContext(tenantContext);
    
    try {
      // Add tenant filter for multi-tenant entities
      if (this.isMultiTenant()) {
        options.where = {
          ...options.where,
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<T>;
      }

      const skip = (page - 1) * limit;
      const [items, total] = await this.repository.findAndCount({
        ...options,
        skip,
        take: limit,
      });
      
      const totalPages = Math.ceil(total / limit);
      
      this.logger.debug('Paginated entities retrieved', { 
        entityName: this.entityName, 
        page,
        limit,
        total,
        totalPages,
        itemsCount: items.length,
        tenantId: tenantContext.tenantId,
      });
      
      return {
        items,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error: any) {
      this.logger.error('Failed to retrieve paginated entities', { 
        error: error.message, 
        entityName: this.entityName,
        page,
        limit,
        tenantId: tenantContext.tenantId,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to retrieve paginated ${this.entityName} records`,
        500,
        error
      );
    }
  }

  /**
   * Generate unique ID
   */
  generateId(): string {
    return ulid();
  }

  /**
   * Health check for repository
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.repository.query('SELECT 1');
      
      const latency = Date.now() - startTime;
      
      this.logger.debug('Repository health check passed', { 
        entityName: this.entityName, 
        latency,
      });
      return { status: 'healthy', latency };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('Repository health check failed', { 
        error: error.message, 
        entityName: this.entityName, 
        latency,
      });
      return { 
        status: 'unhealthy', 
        latency,
        error: error.message 
      };
    }
  }

  /**
   * Check if entity type is multi-tenant
   */
  protected isMultiTenant(): boolean {
    // Check if the entity has organizationId property
    const sampleEntity = this.repository.create({} as DeepPartial<T>);
    return 'organizationId' in sampleEntity;
  }

  /**
   * Check if entity supports soft delete
   */
  protected supportsSoftDelete(): boolean {
    // Check if the entity has deletedAt property
    const sampleEntity = this.repository.create({} as DeepPartial<T>);
    return 'deletedAt' in sampleEntity;
  }

  /**
   * Get raw TypeORM repository for advanced operations
   */
  getRawRepository(): Repository<T> {
    return this.repository;
  }

  /**
   * Save entity
   */
  async save(entity: T): Promise<T> {
    try {
      const savedEntity = await this.repository.save(entity);
      
      this.logger.debug('Entity saved', { 
        entityName: this.entityName, 
        id: savedEntity.id,
      });
      
      return savedEntity;
    } catch (error: any) {
      this.logger.error('Failed to save entity', { 
        error: error.message, 
        entityName: this.entityName,
        id: (entity as any).id,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to save ${this.entityName}`,
        500,
        error
      );
    }
  }

  /**
   * Create query builder
   */
  createQueryBuilder(alias?: string) {
    return this.repository.createQueryBuilder(alias);
  }

  /**
   * Find one entity
   */
  findOne(options: any) {
    return this.repository.findOne(options);
  }

  /**
   * Count entities without tenant context (for config service)
   */
  async countAll(where?: any): Promise<number> {
    try {
      const count = await this.repository.count({ where });
      this.logger.debug('Entity count retrieved (no tenant)', { 
        entityName: this.entityName, 
        count,
      });
      return count;
    } catch (error: any) {
      this.logger.error('Failed to count entities', { 
        error: error.message, 
        entityName: this.entityName,
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to count ${this.entityName} records`,
        500,
        error
      );
    }
  }

  /**
   * Execute raw SQL query
   */
  async query(sql: string, parameters?: any[]): Promise<any> {
    try {
      const result = await this.repository.query(sql, parameters);
      this.logger.debug('Raw query executed', {
        entityName: this.entityName,
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        paramCount: parameters?.length || 0
      });
      return result;
    } catch (error: any) {
      this.logger.error('Failed to execute raw query', {
        error: error.message,
        entityName: this.entityName,
        sql: sql.substring(0, 100)
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to execute query for ${this.entityName}`,
        500,
        error
      );
    }
  }

  /**
   * Find entity by ID without tenant context (for public access)
   */
  async findByIdWithoutTenant(id: string): Promise<T | null> {
    try {
      const entity = await this.repository.findOne({ where: { id } as FindOptionsWhere<T> });
      
      if (entity) {
        this.logger.debug('Entity found by ID (no tenant)', { 
          entityName: this.entityName, 
          id
        });
      }
      
      return entity;
    } catch (error: any) {
      this.logger.error('Failed to find entity by ID (no tenant)', { 
        error: error.message, 
        entityName: this.entityName, 
        id
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to find ${this.entityName}`,
        500,
        error
      );
    }
  }

  /**
   * Perform transaction
   */
  async transaction<R>(fn: (repository: Repository<T>) => Promise<R>): Promise<R> {
    try {
      return await this.repository.manager.transaction(async (entityManager) => {
        const transactionalRepository = entityManager.getRepository(this.repository.target);
        return await fn(transactionalRepository);
      });
    } catch (error: any) {
      this.logger.error('Transaction failed', {
        error: error.message,
        entityName: this.entityName
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Transaction failed for ${this.entityName}`,
        500,
        error
      );
    }
  }

  /**
   * Find entities with joins
   */
  async findWithRelations(
    tenantContext: TenantContext,
    relations: string[],
    where?: FindOptionsWhere<T>,
    options?: Omit<FindManyOptions<T>, 'relations' | 'where'>
  ): Promise<T[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      const whereCondition = { ...where } as FindOptionsWhere<T>;
      
      // Add tenant filter for multi-tenant entities
      if (this.isMultiTenant()) {
        (whereCondition as any).organizationId = tenantContext.tenantId;
      }

      const entities = await this.repository.find({
        ...options,
        where: whereCondition,
        relations
      });
      
      this.logger.debug('Entities with relations found', { 
        entityName: this.entityName, 
        count: entities.length,
        relations,
        tenantId: tenantContext.tenantId
      });
      
      return entities;
    } catch (error: any) {
      this.logger.error('Failed to find entities with relations', { 
        error: error.message, 
        entityName: this.entityName,
        relations,
        tenantId: tenantContext.tenantId
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to find ${this.entityName} with relations`,
        500,
        error
      );
    }
  }

  /**
   * Soft delete entity
   */
  async softDelete(tenantContext: TenantContext, id: string): Promise<void> {
    await this.setTenantContext(tenantContext);
    
    try {
      // First, verify entity exists and belongs to tenant
      const entity = await this.findById(tenantContext, id);
      if (!entity) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          `${this.entityName} not found`,
          404
        );
      }

      await this.repository.softDelete(id);
      
      this.logger.info('Entity soft deleted', { 
        entityName: this.entityName, 
        id,
        tenantId: tenantContext.tenantId
      });
    } catch (error: any) {
      if (error instanceof FluxionError) {
        throw error;
      }
      
      this.logger.error('Failed to soft delete entity', { 
        error: error.message, 
        entityName: this.entityName, 
        id,
        tenantId: tenantContext.tenantId
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to soft delete ${this.entityName}`,
        500,
        error
      );
    }
  }

  /**
   * Bulk create entities
   */
  async bulkCreate(tenantContext: TenantContext, dataArray: DeepPartial<T>[]): Promise<T[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      // Add organization ID and ULIDs to all entities
      const entities = dataArray.map(data => {
        return {
          ...data,
          ...(this.isMultiTenant() && { organizationId: tenantContext.tenantId }),
          ...(!data.id && { id: ulid() }),
        } as DeepPartial<T>;
      });

      const createdEntities = this.repository.create(entities);
      const savedEntities = await this.repository.save(createdEntities);
      
      this.logger.info('Entities bulk created', { 
        entityName: this.entityName, 
        count: savedEntities.length,
        tenantId: tenantContext.tenantId
      });
      
      return savedEntities;
    } catch (error: any) {
      this.logger.error('Failed to bulk create entities', { 
        error: error.message, 
        entityName: this.entityName,
        count: dataArray.length,
        tenantId: tenantContext.tenantId
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to bulk create ${this.entityName} records`,
        500,
        error
      );
    }
  }

  /**
   * Bulk update entities
   */
  async bulkUpdate(
    tenantContext: TenantContext,
    where: FindOptionsWhere<T>,
    updates: Partial<T>
  ): Promise<void> {
    await this.setTenantContext(tenantContext);
    
    try {
      // Add tenant filter for multi-tenant entities
      if (this.isMultiTenant()) {
        (where as any).organizationId = tenantContext.tenantId;
      }

      // Remove organization ID from updates to prevent tampering
      const { organizationId, ...safeUpdates } = updates as any;
      
      const result = await this.repository.update(where, safeUpdates);
      
      this.logger.info('Entities bulk updated', { 
        entityName: this.entityName, 
        affected: result.affected,
        tenantId: tenantContext.tenantId
      });
    } catch (error: any) {
      this.logger.error('Failed to bulk update entities', { 
        error: error.message, 
        entityName: this.entityName,
        tenantId: tenantContext.tenantId
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to bulk update ${this.entityName} records`,
        500,
        error
      );
    }
  }

  /**
   * Find entities with custom query builder operations
   */
  async findWithQueryBuilder(
    tenantContext: TenantContext,
    builderFn: (qb: any) => any,
    alias?: string
  ): Promise<T[]> {
    await this.setTenantContext(tenantContext);
    
    try {
      let queryBuilder = this.repository.createQueryBuilder(alias || this.entityName.toLowerCase());
      
      // Add tenant filter for multi-tenant entities
      if (this.isMultiTenant()) {
        queryBuilder = queryBuilder.where(`${alias || this.entityName.toLowerCase()}.organizationId = :organizationId`, {
          organizationId: tenantContext.tenantId
        });
      }
      
      // Apply custom query builder operations
      queryBuilder = builderFn(queryBuilder);
      
      const entities = await queryBuilder.getMany();
      
      this.logger.debug('Entities found with query builder', { 
        entityName: this.entityName, 
        count: entities.length,
        tenantId: tenantContext.tenantId
      });
      
      return entities;
    } catch (error: any) {
      this.logger.error('Failed to find entities with query builder', { 
        error: error.message, 
        entityName: this.entityName,
        tenantId: tenantContext.tenantId
      });
      throw new FluxionError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to query ${this.entityName} records`,
        500,
        error
      );
    }
  }
}