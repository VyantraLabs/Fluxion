import { BlockchainNetworkRepository } from '@/database/repositories/BlockchainNetworkRepository';
import { TokenRepository } from '@/database/repositories/TokenRepository';
import { BlockchainNetwork } from '@/database/entities/BlockchainNetwork';
import { Token } from '@/database/entities/Token';
import { TenantContext } from '@/types/common';
import { FluxionError, ErrorCodes } from '@/types/common';
import { Logger } from '@/shared/utils/logger';

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

export class AdminService {
  private networkRepository: BlockchainNetworkRepository;
  private tokenRepository: TokenRepository;
  private logger: Logger;

  constructor() {
    this.networkRepository = new BlockchainNetworkRepository();
    this.tokenRepository = new TokenRepository();
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
   * Validate admin permissions
   */
  async validateAdminAccess(tenantContext: TenantContext): Promise<boolean> {
    this.logger.info('Validating admin access', {
      userId: tenantContext.userId,
      tenantId: tenantContext.tenantId
    });

    try {
      // Import user repository dynamically to avoid circular dependencies
      const { UserRepository } = await import('@/database/repositories/UserRepository');
      const userRepository = new UserRepository();

      const user = await userRepository.findByWallet(tenantContext.userId!);
      if (!user) {
        throw new FluxionError(
          ErrorCodes.NOT_FOUND,
          'User not found',
          404
        );
      }

      // Check if user is admin (assuming there's an isAdmin field or role-based system)
      // For now, we'll use a simple check - in production this should be more sophisticated
      const isAdmin = user.email?.includes('admin') || 
                     user.walletAddress === process.env.ADMIN_WALLET || 
                     user.displayName?.toLowerCase().includes('admin');

      this.logger.info('Admin access validation completed', {
        userId: tenantContext.userId,
        isAdmin
      });

      return isAdmin;
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
}