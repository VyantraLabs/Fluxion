import { BlockchainNetworkRepository } from '@/database/repositories/BlockchainNetworkRepository';
import { TokenRepository } from '@/database/repositories/TokenRepository';
import { AdminRepository, SystemStats, OrganizationWithStats, UserWithStats, ActivityLogEntry } from '@/database/repositories/AdminRepository';
import { UserRepository } from '@/database/repositories/UserRepository';
import { OrganizationRepository } from '@/database/repositories/OrganizationRepository';
import { TemplateRepository } from '@/database/repositories/TemplateRepository';
import { AuditLogRepository } from '@/database/repositories/AuditLogRepository';
import { BlockchainNetwork } from '@/database/entities/BlockchainNetwork';
import { Token } from '@/database/entities/Token';
import { User } from '@/database/entities/User';
import { Organization } from '@/database/entities/Organization';
import { Template } from '@/database/entities/Template';
import { SystemSettings } from '@/database/entities/SystemSettings';
import { AuditLog } from '@/database/entities/AuditLog';
import { TenantContext } from '@/types/common';
import { FluxionError, ErrorCodes } from '@/types/common';
import { Logger } from '@/shared/utils/logger';
import { RBACService } from '@/shared/services/rbac.service';

export interface CreateNetworkDto {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  symbol: string;
  logoUrl?: string;
  isTestnet?: boolean;
  isActive?: boolean;
  gasSettings?: {
    gasPrice: string;
    gasLimit: string;
  };
  multicallAddress?: string;
}

export interface UpdateNetworkDto {
  name?: string;
  rpcUrl?: string;
  explorerUrl?: string;
  logoUrl?: string;
  isActive?: boolean;
  gasSettings?: {
    gasPrice: string;
    gasLimit: string;
  };
  multicallAddress?: string;
}

export interface CreateTokenDto {
  name: string;
  symbol: string;
  decimals: number;
  contractAddress?: string;
  networkId: string;
  isNative?: boolean;
  isStablecoin?: boolean;
  isActive?: boolean;
  logoUrl?: string;
  coingeckoId?: string;
}

export interface UpdateTokenDto {
  name?: string;
  logoUrl?: string;
  isActive?: boolean;
  isStablecoin?: boolean;
  coingeckoId?: string;
}

export interface SystemHealthCheck {
  status: 'healthy' | 'degraded' | 'critical';
  checks: {
    database: { status: 'ok' | 'error'; message?: string };
    redis: { status: 'ok' | 'error'; message?: string };
    external_apis: { status: 'ok' | 'error'; message?: string };
    storage: { status: 'ok' | 'error'; message?: string };
  };
  uptime: number;
  timestamp: string;
}

export interface MaintenanceMode {
  enabled: boolean;
  message?: string;
  enabledAt?: Date;
  enabledBy?: string;
  estimatedDuration?: number; // minutes
}

export interface UpdateUserAdminStatusDto {
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  reason?: string;
}

export interface UpdateSystemSettingDto {
  value: any;
  description?: string;
}

export interface BulkTemplateOperationDto {
  templateIds: string[];
  operation: 'activate' | 'deactivate' | 'delete';
}

export class AdminService {
  private networkRepository: BlockchainNetworkRepository;
  private tokenRepository: TokenRepository;
  private adminRepository: AdminRepository;
  private userRepository: UserRepository;
  private organizationRepository: OrganizationRepository;
  private templateRepository: TemplateRepository;
  private auditLogRepository: AuditLogRepository;
  private rbacService: RBACService;
  private logger: Logger;

  constructor() {
    this.networkRepository = new BlockchainNetworkRepository();
    this.tokenRepository = new TokenRepository();
    this.adminRepository = new AdminRepository();
    this.userRepository = new UserRepository();
    this.organizationRepository = new OrganizationRepository();
    this.templateRepository = new TemplateRepository();
    this.auditLogRepository = new AuditLogRepository();
    this.rbacService = new RBACService();
    this.logger = new Logger('AdminService');
  }

  /**
   * Get all networks (including inactive ones)
   */
  async getAllNetworks(tenantContext: TenantContext): Promise<BlockchainNetwork[]> {
    this.logger.info('Admin: Retrieving all networks', {
      adminUser: tenantContext.userId
    });

    try {
      const networks = await this.networkRepository.findAll();

      this.logger.info('Admin: All networks retrieved successfully', {
        count: networks.length,
        adminUser: tenantContext.userId
      });

      return networks;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve all networks', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Create a new blockchain network
   */
  async createNetwork(
    tenantContext: TenantContext,
    networkData: CreateNetworkDto
  ): Promise<BlockchainNetwork> {
    this.logger.info('Admin: Creating new network', {
      name: networkData.name,
      chainId: networkData.chainId,
      adminUser: tenantContext.userId
    });

    try {
      // Check if network with same chainId already exists
      const existingNetwork = await this.networkRepository.findByChainId(networkData.chainId);
      if (existingNetwork) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          `Network with chain ID ${networkData.chainId} already exists`,
          400
        );
      }

      const network = await this.networkRepository.create({
        name: networkData.name,
        chainId: networkData.chainId,
        rpcUrl: networkData.rpcUrl,
        explorerUrl: networkData.explorerUrl,
        symbol: networkData.symbol,
        logoUrl: networkData.logoUrl,
        isTestnet: networkData.isTestnet ?? false,
        isActive: networkData.isActive ?? true,
        gasSettings: networkData.gasSettings,
        multicallAddress: networkData.multicallAddress,
      });

      this.logger.info('Admin: Network created successfully', {
        networkId: network.id,
        name: network.name,
        chainId: network.chainId,
        adminUser: tenantContext.userId
      });

      return network;
    } catch (error: any) {
      this.logger.error('Admin: Failed to create network', {
        error: error.message,
        networkData: { name: networkData.name, chainId: networkData.chainId },
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Update an existing blockchain network
   */
  async updateNetwork(
    tenantContext: TenantContext,
    networkId: string,
    updateData: UpdateNetworkDto
  ): Promise<BlockchainNetwork> {
    this.logger.info('Admin: Updating network', {
      networkId,
      adminUser: tenantContext.userId
    });

    try {
      const network = await this.networkRepository.findById(networkId);
      if (!network) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Network not found',
          404
        );
      }

      const updatedNetwork = await this.networkRepository.update(networkId, updateData);

      this.logger.info('Admin: Network updated successfully', {
        networkId: updatedNetwork.id,
        name: updatedNetwork.name,
        adminUser: tenantContext.userId
      });

      return updatedNetwork;
    } catch (error: any) {
      this.logger.error('Admin: Failed to update network', {
        error: error.message,
        networkId,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get all tokens (including inactive ones)
   */
  async getAllTokens(tenantContext: TenantContext): Promise<Token[]> {
    this.logger.info('Admin: Retrieving all tokens', {
      adminUser: tenantContext.userId
    });

    try {
      const tokens = await this.tokenRepository.findAllWithNetwork();

      this.logger.info('Admin: All tokens retrieved successfully', {
        count: tokens.length,
        adminUser: tenantContext.userId
      });

      return tokens;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve all tokens', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Create a new token
   */
  async createToken(
    tenantContext: TenantContext,
    tokenData: CreateTokenDto
  ): Promise<Token> {
    this.logger.info('Admin: Creating new token', {
      name: tokenData.name,
      symbol: tokenData.symbol,
      networkId: tokenData.networkId,
      adminUser: tenantContext.userId
    });

    try {
      // Verify network exists
      const network = await this.networkRepository.findById(tokenData.networkId);
      if (!network) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Network not found',
          404
        );
      }

      // Check if token with same symbol already exists on this network
      const existingToken = await this.tokenRepository.findBySymbolAndNetwork(
        tokenData.symbol,
        tokenData.networkId
      );
      if (existingToken) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          `Token with symbol ${tokenData.symbol} already exists on this network`,
          400
        );
      }

      const token = await this.tokenRepository.create({
        name: tokenData.name,
        symbol: tokenData.symbol,
        decimals: tokenData.decimals,
        contractAddress: tokenData.contractAddress,
        networkId: tokenData.networkId,
        isNative: tokenData.isNative ?? false,
        isStablecoin: tokenData.isStablecoin ?? false,
        isActive: tokenData.isActive ?? true,
        logoUrl: tokenData.logoUrl,
        coingeckoId: tokenData.coingeckoId,
      });

      this.logger.info('Admin: Token created successfully', {
        tokenId: token.id,
        name: token.name,
        symbol: token.symbol,
        networkId: token.networkId,
        adminUser: tenantContext.userId
      });

      return token;
    } catch (error: any) {
      this.logger.error('Admin: Failed to create token', {
        error: error.message,
        tokenData: { 
          name: tokenData.name, 
          symbol: tokenData.symbol,
          networkId: tokenData.networkId 
        },
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Update an existing token
   */
  async updateToken(
    tenantContext: TenantContext,
    tokenId: string,
    updateData: UpdateTokenDto
  ): Promise<Token> {
    this.logger.info('Admin: Updating token', {
      tokenId,
      adminUser: tenantContext.userId
    });

    try {
      const token = await this.tokenRepository.findById(tokenId);
      if (!token) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Token not found',
          404
        );
      }

      const updatedToken = await this.tokenRepository.update(tokenId, updateData);

      this.logger.info('Admin: Token updated successfully', {
        tokenId: updatedToken.id,
        name: updatedToken.name,
        symbol: updatedToken.symbol,
        adminUser: tenantContext.userId
      });

      return updatedToken;
    } catch (error: any) {
      this.logger.error('Admin: Failed to update token', {
        error: error.message,
        tokenId,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Validate admin permissions using RBAC
   */
  async validateAdminAccess(tenantContext: TenantContext): Promise<boolean> {
    this.logger.info('Validating admin access', {
      userId: tenantContext.userId,
      tenantId: tenantContext.tenantId
    });

    try {
      if (!tenantContext.userId) {
        return false;
      }

      // Check if user has system admin permissions
      const hasSystemAdmin = await this.rbacService.hasPermission(
        tenantContext.userId, 
        ['system:admin', 'system:cross_tenant', 'system:*'],
        { requireAll: false, allowSystemOverride: true }
      );

      if (hasSystemAdmin) {
        this.logger.info('Admin access granted - system admin', {
          userId: tenantContext.userId
        });
        return true;
      }

      // Check if user has organization admin permissions in their organization
      if (tenantContext.tenantId) {
        const hasOrgAdmin = await this.rbacService.hasPermission(
          tenantContext.userId,
          ['org:admin', 'org:*', 'user:manage'],
          { 
            requireAll: false, 
            organizationId: tenantContext.tenantId,
            allowSystemOverride: false
          }
        );

        this.logger.info('Admin access validation completed', {
          userId: tenantContext.userId,
          hasSystemAdmin,
          hasOrgAdmin,
          organizationId: tenantContext.tenantId
        });

        return hasOrgAdmin;
      }

      return false;
    } catch (error: any) {
      this.logger.error('Failed to validate admin access', {
        error: error.message,
        userId: tenantContext.userId
      });
      return false;
    }
  }

  /**
   * Get admin dashboard statistics
   */
  async getAdminStats(tenantContext: TenantContext): Promise<{
    networks: {
      total: number;
      active: number;
      testnets: number;
      mainnets: number;
    };
    tokens: {
      total: number;
      active: number;
      stablecoins: number;
      nativeTokens: number;
    };
    systemHealth: {
      status: string;
      lastUpdated: string;
    };
  }> {
    this.logger.info('Admin: Retrieving dashboard statistics', {
      adminUser: tenantContext.userId
    });

    try {
      const [allNetworks, allTokens] = await Promise.all([
        this.networkRepository.findAll(),
        this.tokenRepository.findAll()
      ]);

      const networkStats = {
        total: allNetworks.length,
        active: allNetworks.filter(n => n.isActive).length,
        testnets: allNetworks.filter(n => n.isTestnet).length,
        mainnets: allNetworks.filter(n => !n.isTestnet).length
      };

      const tokenStats = {
        total: allTokens.length,
        active: allTokens.filter(t => t.isActive).length,
        stablecoins: allTokens.filter(t => t.isStablecoin).length,
        nativeTokens: allTokens.filter(t => t.isNative).length
      };

      const stats = {
        networks: networkStats,
        tokens: tokenStats,
        systemHealth: {
          status: 'healthy',
          lastUpdated: new Date().toISOString()
        }
      };

      this.logger.info('Admin: Dashboard statistics retrieved successfully', {
        stats: {
          networksTotal: networkStats.total,
          tokensTotal: tokenStats.total
        },
        adminUser: tenantContext.userId
      });

      return stats;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve dashboard statistics', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  // =============================================================================
  // COMPREHENSIVE SYSTEM MANAGEMENT METHODS
  // =============================================================================

  /**
   * Get comprehensive system statistics
   */
  async getSystemStats(tenantContext: TenantContext): Promise<SystemStats> {
    this.logger.info('Admin: Retrieving comprehensive system statistics', {
      adminUser: tenantContext.userId
    });

    try {
      const stats = await this.adminRepository.getSystemStats();

      this.logger.info('Admin: System statistics retrieved successfully', {
        totalUsers: stats.users.total,
        totalOrganizations: stats.organizations.total,
        adminUser: tenantContext.userId
      });

      return stats;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve system statistics', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get system health check
   */
  async getSystemHealth(tenantContext: TenantContext): Promise<SystemHealthCheck> {
    this.logger.info('Admin: Performing system health check', {
      adminUser: tenantContext.userId
    });

    const checks = {
      database: { status: 'ok' as const, message: undefined as string | undefined },
      redis: { status: 'ok' as const, message: undefined as string | undefined },
      external_apis: { status: 'ok' as const, message: undefined as string | undefined },
      storage: { status: 'ok' as const, message: undefined as string | undefined }
    };

    try {
      // Database connectivity check
      try {
        await this.userRepository.count();
        checks.database.status = 'ok';
      } catch (error: any) {
        checks.database.status = 'error';
        checks.database.message = `Database connection failed: ${error.message}`;
      }

      // Redis check (if available)
      try {
        const { CacheService } = await import('@/shared/cache/service');
        const cacheService = new CacheService();
        await cacheService.ping();
        checks.redis.status = 'ok';
      } catch (error: any) {
        checks.redis.status = 'error';
        checks.redis.message = `Redis connection failed: ${error.message}`;
      }

      // External API checks (blockchain RPCs, etc.)
      try {
        // Test a basic blockchain query
        const networks = await this.networkRepository.findActive();
        if (networks.length === 0) {
          checks.external_apis.status = 'error';
          checks.external_apis.message = 'No active blockchain networks found';
        }
      } catch (error: any) {
        checks.external_apis.status = 'error';
        checks.external_apis.message = `External API check failed: ${error.message}`;
      }

      // Storage check (file system or S3)
      try {
        // Basic file system check
        const fs = await import('fs/promises');
        await fs.access('/tmp');
        checks.storage.status = 'ok';
      } catch (error: any) {
        checks.storage.status = 'error';
        checks.storage.message = `Storage check failed: ${error.message}`;
      }

      // Determine overall status
      const errorCount = Object.values(checks).filter(check => check.status === 'error').length;
      const status = errorCount === 0 ? 'healthy' : errorCount < 2 ? 'degraded' : 'critical';

      const healthCheck: SystemHealthCheck = {
        status,
        checks,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };

      this.logger.info('Admin: System health check completed', {
        status,
        errorCount,
        adminUser: tenantContext.userId
      });

      return healthCheck;
    } catch (error: any) {
      this.logger.error('Admin: Failed to perform system health check', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Toggle maintenance mode
   */
  async toggleMaintenanceMode(
    tenantContext: TenantContext,
    enabled: boolean,
    message?: string,
    estimatedDuration?: number
  ): Promise<MaintenanceMode> {
    this.logger.info('Admin: Toggling maintenance mode', {
      enabled,
      adminUser: tenantContext.userId
    });

    try {
      const maintenanceData: MaintenanceMode = {
        enabled,
        message,
        enabledAt: enabled ? new Date() : undefined,
        enabledBy: enabled ? tenantContext.userId : undefined,
        estimatedDuration
      };

      // Update system setting
      await this.adminRepository.updateSystemSetting(
        'maintenance_mode',
        maintenanceData,
        tenantContext.userId!,
        `Maintenance mode ${enabled ? 'enabled' : 'disabled'} by admin`
      );

      // Create audit log for maintenance mode change
      const auditData = AuditLog.createForSystemOperation(
        tenantContext.userId!,
        'toggle_maintenance_mode',
        {
          enabled,
          message,
          estimatedDuration
        },
        'critical',
        {
          operation: enabled ? 'enable_maintenance' : 'disable_maintenance'
        }
      );

      await this.auditLogRepository.create(auditData);

      this.logger.info('Admin: Maintenance mode toggled successfully', {
        enabled,
        adminUser: tenantContext.userId
      });

      return maintenanceData;
    } catch (error: any) {
      this.logger.error('Admin: Failed to toggle maintenance mode', {
        error: error.message,
        enabled,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get all organizations with statistics
   */
  async getAllOrganizations(
    tenantContext: TenantContext,
    limit: number = 50,
    offset: number = 0,
    searchTerm?: string,
    status?: 'active' | 'inactive' | 'suspended'
  ): Promise<{ organizations: OrganizationWithStats[]; total: number }> {
    this.logger.info('Admin: Retrieving all organizations', {
      limit,
      offset,
      searchTerm,
      status,
      adminUser: tenantContext.userId
    });

    try {
      const result = await this.adminRepository.getAllOrganizationsWithStats(
        limit,
        offset,
        searchTerm,
        status
      );

      this.logger.info('Admin: Organizations retrieved successfully', {
        count: result.organizations.length,
        total: result.total,
        adminUser: tenantContext.userId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve organizations', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get organization details
   */
  async getOrganizationDetails(
    tenantContext: TenantContext,
    organizationId: string
  ): Promise<Organization> {
    this.logger.info('Admin: Retrieving organization details', {
      organizationId,
      adminUser: tenantContext.userId
    });

    try {
      const organization = await this.organizationRepository.findById(organizationId);
      if (!organization) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Organization not found',
          404
        );
      }

      this.logger.info('Admin: Organization details retrieved successfully', {
        organizationId: organization.id,
        name: organization.name,
        adminUser: tenantContext.userId
      });

      return organization;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve organization details', {
        error: error.message,
        organizationId,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get organization users
   */
  async getOrganizationUsers(
    tenantContext: TenantContext,
    organizationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ users: UserWithStats[]; total: number }> {
    this.logger.info('Admin: Retrieving organization users', {
      organizationId,
      limit,
      offset,
      adminUser: tenantContext.userId
    });

    try {
      const result = await this.adminRepository.getAllUsersWithStats(
        limit,
        offset,
        undefined, // searchTerm
        organizationId
      );

      this.logger.info('Admin: Organization users retrieved successfully', {
        organizationId,
        count: result.users.length,
        total: result.total,
        adminUser: tenantContext.userId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve organization users', {
        error: error.message,
        organizationId,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get organization activity feed
   */
  async getOrganizationActivity(
    tenantContext: TenantContext,
    organizationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ logs: ActivityLogEntry[]; total: number }> {
    this.logger.info('Admin: Retrieving organization activity', {
      organizationId,
      limit,
      offset,
      adminUser: tenantContext.userId
    });

    try {
      const result = await this.adminRepository.getActivityLogs(
        limit,
        offset,
        { organizationId }
      );

      this.logger.info('Admin: Organization activity retrieved successfully', {
        organizationId,
        count: result.logs.length,
        total: result.total,
        adminUser: tenantContext.userId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve organization activity', {
        error: error.message,
        organizationId,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get all users with statistics
   */
  async getAllUsers(
    tenantContext: TenantContext,
    limit: number = 50,
    offset: number = 0,
    searchTerm?: string,
    organizationId?: string,
    adminOnly?: boolean
  ): Promise<{ users: UserWithStats[]; total: number }> {
    this.logger.info('Admin: Retrieving all users', {
      limit,
      offset,
      searchTerm,
      organizationId,
      adminOnly,
      adminUser: tenantContext.userId
    });

    try {
      const result = await this.adminRepository.getAllUsersWithStats(
        limit,
        offset,
        searchTerm,
        organizationId,
        adminOnly
      );

      this.logger.info('Admin: Users retrieved successfully', {
        count: result.users.length,
        total: result.total,
        adminUser: tenantContext.userId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve users', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Update user admin status
   */
  async updateUserAdminStatus(
    tenantContext: TenantContext,
    userId: string,
    updateData: UpdateUserAdminStatusDto
  ): Promise<User> {
    this.logger.info('Admin: Updating user admin status', {
      userId,
      isAdmin: updateData.isAdmin,
      isSuperAdmin: updateData.isSuperAdmin,
      adminUser: tenantContext.userId
    });

    try {
      const updatedUser = await this.adminRepository.updateUserAdminStatus(
        userId,
        updateData.isAdmin,
        updateData.isSuperAdmin || false,
        tenantContext.userId!
      );

      this.logger.info('Admin: User admin status updated successfully', {
        userId: updatedUser.id,
        isAdmin: updatedUser.isAdmin,
        isSuperAdmin: updatedUser.isSuperAdmin,
        adminUser: tenantContext.userId
      });

      return updatedUser;
    } catch (error: any) {
      this.logger.error('Admin: Failed to update user admin status', {
        error: error.message,
        userId,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get user activity audit trail
   */
  async getUserActivity(
    tenantContext: TenantContext,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ logs: ActivityLogEntry[]; total: number }> {
    this.logger.info('Admin: Retrieving user activity', {
      userId,
      limit,
      offset,
      adminUser: tenantContext.userId
    });

    try {
      const result = await this.adminRepository.getActivityLogs(
        limit,
        offset,
        { userId }
      );

      this.logger.info('Admin: User activity retrieved successfully', {
        userId,
        count: result.logs.length,
        total: result.total,
        adminUser: tenantContext.userId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve user activity', {
        error: error.message,
        userId,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get all system templates with admin metadata
   */
  async getAllSystemTemplates(tenantContext: TenantContext): Promise<Template[]> {
    this.logger.info('Admin: Retrieving all system templates', {
      adminUser: tenantContext.userId
    });

    try {
      // Get system templates (organizationId is null)
      const templates = await this.templateRepository.findAll({ where: { organizationId: null } } as any);

      this.logger.info('Admin: System templates retrieved successfully', {
        count: templates.length,
        adminUser: tenantContext.userId
      });

      return templates;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve system templates', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Update system template
   */
  async updateSystemTemplate(
    tenantContext: TenantContext,
    templateId: string,
    updateData: Partial<Template>
  ): Promise<Template> {
    this.logger.info('Admin: Updating system template', {
      templateId,
      adminUser: tenantContext.userId
    });

    try {
      const template = await this.templateRepository.findById(templateId);
      if (!template) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'Template not found',
          404
        );
      }

      // Ensure this is a system template
      if (template.organizationId) {
        throw new FluxionError(
          ErrorCodes.FORBIDDEN,
          'Cannot update organizational template via system admin endpoint',
          403
        );
      }

      const updatedTemplate = await this.templateRepository.update(templateId, updateData);

      // Create audit log
      const auditData = AuditLog.createForAdminAction(
        'system', // system organization
        tenantContext.userId!,
        undefined,
        'templates',
        templateId,
        'UPDATE',
        'medium',
        template,
        updatedTemplate,
        {
          operation: 'update_system_template',
          templateName: template.name
        }
      );

      await this.auditLogRepository.create(auditData);

      this.logger.info('Admin: System template updated successfully', {
        templateId: updatedTemplate.id,
        name: updatedTemplate.name,
        adminUser: tenantContext.userId
      });

      return updatedTemplate;
    } catch (error: any) {
      this.logger.error('Admin: Failed to update system template', {
        error: error.message,
        templateId,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Toggle template activation status
   */
  async toggleTemplateStatus(
    tenantContext: TenantContext,
    templateId: string,
    isActive: boolean
  ): Promise<Template> {
    this.logger.info('Admin: Toggling template status', {
      templateId,
      isActive,
      adminUser: tenantContext.userId
    });

    try {
      const updatedTemplate = await this.updateSystemTemplate(
        tenantContext,
        templateId,
        { isActive }
      );

      this.logger.info('Admin: Template status toggled successfully', {
        templateId: updatedTemplate.id,
        isActive: updatedTemplate.isActive,
        adminUser: tenantContext.userId
      });

      return updatedTemplate;
    } catch (error: any) {
      this.logger.error('Admin: Failed to toggle template status', {
        error: error.message,
        templateId,
        isActive,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Bulk template operations
   */
  async bulkTemplateOperation(
    tenantContext: TenantContext,
    operationData: BulkTemplateOperationDto
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    this.logger.info('Admin: Performing bulk template operation', {
      operation: operationData.operation,
      templateCount: operationData.templateIds.length,
      adminUser: tenantContext.userId
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      for (const templateId of operationData.templateIds) {
        try {
          switch (operationData.operation) {
            case 'activate':
              await this.toggleTemplateStatus(tenantContext, templateId, true);
              break;
            case 'deactivate':
              await this.toggleTemplateStatus(tenantContext, templateId, false);
              break;
            case 'delete':
              await this.templateRepository.softDelete(templateId);
              break;
          }
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Template ${templateId}: ${error.message}`);
        }
      }

      // Create audit log for bulk operation
      const auditData = AuditLog.createForSystemOperation(
        tenantContext.userId!,
        'bulk_template_operation',
        {
          operation: operationData.operation,
          templateIds: operationData.templateIds,
          results
        },
        'medium',
        {
          operation: `bulk_${operationData.operation}`
        }
      );

      await this.auditLogRepository.create(auditData);

      this.logger.info('Admin: Bulk template operation completed', {
        operation: operationData.operation,
        success: results.success,
        failed: results.failed,
        adminUser: tenantContext.userId
      });

      return results;
    } catch (error: any) {
      this.logger.error('Admin: Failed to perform bulk template operation', {
        error: error.message,
        operation: operationData.operation,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get system settings
   */
  async getSystemSettings(
    tenantContext: TenantContext,
    category?: string,
    publicOnly?: boolean
  ): Promise<SystemSettings[]> {
    this.logger.info('Admin: Retrieving system settings', {
      category,
      publicOnly,
      adminUser: tenantContext.userId
    });

    try {
      const settings = await this.adminRepository.getSystemSettings(category, publicOnly);

      this.logger.info('Admin: System settings retrieved successfully', {
        count: settings.length,
        category,
        adminUser: tenantContext.userId
      });

      return settings;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve system settings', {
        error: error.message,
        category,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Update system setting
   */
  async updateSystemSetting(
    tenantContext: TenantContext,
    key: string,
    updateData: UpdateSystemSettingDto
  ): Promise<SystemSettings> {
    this.logger.info('Admin: Updating system setting', {
      key,
      adminUser: tenantContext.userId
    });

    try {
      const updatedSetting = await this.adminRepository.updateSystemSetting(
        key,
        updateData.value,
        tenantContext.userId!,
        updateData.description
      );

      this.logger.info('Admin: System setting updated successfully', {
        key: updatedSetting.key,
        adminUser: tenantContext.userId
      });

      return updatedSetting;
    } catch (error: any) {
      this.logger.error('Admin: Failed to update system setting', {
        error: error.message,
        key,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get comprehensive activity logs
   */
  async getActivityLogs(
    tenantContext: TenantContext,
    limit: number = 100,
    offset: number = 0,
    filters: {
      adminOnly?: boolean;
      highRiskOnly?: boolean;
      userId?: string;
      organizationId?: string;
      action?: string;
      tableName?: string;
      severityLevel?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ logs: ActivityLogEntry[]; total: number }> {
    this.logger.info('Admin: Retrieving activity logs', {
      limit,
      offset,
      filters,
      adminUser: tenantContext.userId
    });

    try {
      const result = await this.adminRepository.getActivityLogs(
        limit,
        offset,
        filters
      );

      this.logger.info('Admin: Activity logs retrieved successfully', {
        count: result.logs.length,
        total: result.total,
        adminUser: tenantContext.userId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Admin: Failed to retrieve activity logs', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }


  /**
   * Validate super admin access
   */
  async validateSuperAdminAccess(tenantContext: TenantContext): Promise<boolean> {
    this.logger.info('Validating super admin access', {
      userId: tenantContext.userId
    });

    try {
      if (!tenantContext.userId) {
        return false;
      }

      const user = await this.userRepository.findById(tenantContext.userId);
      if (!user) {
        return false;
      }

      const hasSuperAdminAccess = user.isSuperAdmin;

      this.logger.info('Super admin access validation completed', {
        userId: tenantContext.userId,
        hasSuperAdminAccess
      });

      return hasSuperAdminAccess;
    } catch (error: any) {
      this.logger.error('Failed to validate super admin access', {
        error: error.message,
        userId: tenantContext.userId
      });
      return false;
    }
  }
}