import { 
  BlockchainNetworkRepository, 
  TokenRepository 
} from '@/database/repositories';
import { Logger } from '@/shared/utils/logger';
import { 
  NetworkConfig,
  TokenConfig,
  AppConfig,
  NetworksResponse,
  TokensResponse,
  NetworkTokensResponse,
  ConfigResponse,
  NetworkFilter,
  TokenFilter
} from '@/types/config';
import { BlockchainNetwork } from '@/database/entities/BlockchainNetwork';
import { Token } from '@/database/entities/Token';

export class ConfigService {
  private readonly logger = new Logger('ConfigService');
  private readonly networkRepo = new BlockchainNetworkRepository();
  private readonly tokenRepo = new TokenRepository();

  // Cache configuration (in production, this would use Redis)
  private static readonly CACHE_TTL = {
    networks: 3600, // 1 hour
    tokens: 1800, // 30 minutes
    appConfig: 900, // 15 minutes
  };

  /**
   * Get all blockchain networks with optional filtering
   */
  async getNetworks(filter: NetworkFilter = {}, includeTokens: boolean = false): Promise<NetworksResponse> {
    this.logger.info('Fetching blockchain networks', { filter, includeTokens });

    try {
      const queryBuilder = this.networkRepo.createQueryBuilder('network');

      // Apply filters
      if (filter.isActive !== undefined) {
        queryBuilder.andWhere('network.isActive = :isActive', { isActive: filter.isActive });
      }

      if (filter.isTestnet !== undefined) {
        queryBuilder.andWhere('network.isTestnet = :isTestnet', { isTestnet: filter.isTestnet });
      }

      if (filter.chainIds && filter.chainIds.length > 0) {
        queryBuilder.andWhere('network.chainId IN (:...chainIds)', { chainIds: filter.chainIds });
      }

      if (filter.symbols && filter.symbols.length > 0) {
        queryBuilder.andWhere('network.symbol IN (:...symbols)', { symbols: filter.symbols });
      }

      queryBuilder.orderBy('network.chainId', 'ASC');

      const networks = await queryBuilder.getMany();
      
      // If includeTokens is true, fetch tokens for each network
      let networkConfigs: any[] = [];
      
      if (includeTokens) {
        // Fetch all active tokens with their network relationships in one query
        const tokenQueryBuilder = this.tokenRepo.createQueryBuilder('token')
          .leftJoinAndSelect('token.network', 'network')
          .where('token.isActive = :isActive', { isActive: true })
          .andWhere('network.isActive = :networkActive', { networkActive: true })
          .orderBy('network.chainId', 'ASC')
          .addOrderBy('token.isNative', 'DESC')
          .addOrderBy('token.isStablecoin', 'DESC')
          .addOrderBy('token.symbol', 'ASC');
        
        const allTokens = await tokenQueryBuilder.getMany();
        
        // Group tokens by chain ID
        const tokensByChainId = allTokens.reduce((acc, token) => {
          if (!acc[token.chainId]) {
            acc[token.chainId] = [];
          }
          acc[token.chainId].push(this.transformTokenEntity(token));
          return acc;
        }, {} as { [chainId: number]: TokenConfig[] });
        
        // Transform networks with their tokens
        networkConfigs = networks.map(network => ({
          ...this.transformNetworkEntity(network),
          tokens: tokensByChainId[network.chainId] || []
        }));
      } else {
        networkConfigs = networks.map(network => this.transformNetworkEntity(network));
      }

      const mainnets = networkConfigs.filter(n => !n.isTestnet);
      const testnets = networkConfigs.filter(n => n.isTestnet);

      this.logger.info('Successfully fetched networks', { 
        total: networks.length,
        mainnets: mainnets.length,
        testnets: testnets.length,
        includeTokens
      });

      return {
        networks: networkConfigs,
        count: networkConfigs.length,
        mainnets,
        testnets,
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch networks', { error: error.message });
      throw new Error(`Failed to fetch networks: ${error.message}`);
    }
  }

  /**
   * Get network by chain ID
   */
  async getNetworkByChainId(chainId: number): Promise<NetworkConfig | null> {
    this.logger.info('Fetching network by chain ID', { chainId });

    try {
      const network = await this.networkRepo.findOne({
        where: { chainId, isActive: true },
      });

      if (!network) {
        this.logger.warn('Network not found or inactive', { chainId });
        return null;
      }

      return this.transformNetworkEntity(network);
    } catch (error: any) {
      this.logger.error('Failed to fetch network by chain ID', { chainId, error: error.message });
      throw new Error(`Failed to fetch network: ${error.message}`);
    }
  }

  /**
   * Get all tokens with optional filtering
   */
  async getTokens(filter: TokenFilter = {}): Promise<TokensResponse> {
    this.logger.info('Fetching tokens', { filter });

    try {
      const queryBuilder = this.tokenRepo.createQueryBuilder('token')
        .leftJoinAndSelect('token.network', 'network');

      // Apply filters
      if (filter.isActive !== undefined) {
        queryBuilder.andWhere('token.isActive = :isActive', { isActive: filter.isActive });
      }

      if (filter.isStablecoin !== undefined) {
        queryBuilder.andWhere('token.isStablecoin = :isStablecoin', { isStablecoin: filter.isStablecoin });
      }

      if (filter.isNative !== undefined) {
        queryBuilder.andWhere('token.isNative = :isNative', { isNative: filter.isNative });
      }

      if (filter.networkId) {
        queryBuilder.andWhere('token.networkId = :networkId', { networkId: filter.networkId });
      }

      if (filter.symbols && filter.symbols.length > 0) {
        queryBuilder.andWhere('token.symbol IN (:...symbols)', { symbols: filter.symbols });
      }

      if (filter.chainId) {
        queryBuilder.andWhere('network.chainId = :chainId', { chainId: filter.chainId });
      }

      // Only include active networks
      queryBuilder.andWhere('network.isActive = :networkActive', { networkActive: true });

      queryBuilder
        .orderBy('network.chainId', 'ASC')
        .addOrderBy('token.isNative', 'DESC')
        .addOrderBy('token.isStablecoin', 'DESC')
        .addOrderBy('token.symbol', 'ASC');

      const tokens = await queryBuilder.getMany();
      const tokenConfigs = tokens.map(token => this.transformTokenEntity(token));

      const stablecoins = tokenConfigs.filter(t => t.isStablecoin);
      const nativeTokens = tokenConfigs.filter(t => t.isNative);
      const erc20Tokens = tokenConfigs.filter(t => t.isERC20);

      this.logger.info('Successfully fetched tokens', { 
        total: tokens.length,
        stablecoins: stablecoins.length,
        native: nativeTokens.length,
        erc20: erc20Tokens.length
      });

      return {
        tokens: tokenConfigs,
        count: tokenConfigs.length,
        stablecoins,
        nativeTokens,
        erc20Tokens,
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch tokens', { error: error.message });
      throw new Error(`Failed to fetch tokens: ${error.message}`);
    }
  }

  /**
   * Get tokens for a specific network
   */
  async getNetworkTokens(chainId: number, filter: TokenFilter = {}): Promise<NetworkTokensResponse | null> {
    this.logger.info('Fetching tokens for network', { chainId, filter });

    try {
      // First get the network
      const network = await this.getNetworkByChainId(chainId);
      if (!network) {
        return null;
      }

      // Get tokens for this network
      const tokensResponse = await this.getTokens({
        ...filter,
        chainId,
      });

      return {
        networkId: network.id,
        network,
        tokens: tokensResponse.tokens,
        count: tokensResponse.tokens.length,
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch network tokens', { chainId, error: error.message });
      throw new Error(`Failed to fetch network tokens: ${error.message}`);
    }
  }

  /**
   * Get complete application configuration
   */
  async getAppConfig(): Promise<ConfigResponse> {
    this.logger.info('Fetching complete app configuration');

    try {
      const [networksResponse, tokensResponse] = await Promise.all([
        this.getNetworks({ isActive: true }, false),
        this.getTokens({ isActive: true }),
      ]);

      const appConfig: AppConfig = {
        supportedNetworks: networksResponse.networks.map(n => n.chainId),
        supportedTokenSymbols: [...new Set(tokensResponse.tokens.map(t => t.symbol))],
        defaultNetwork: 137, // Polygon as default
        defaultTokens: this.getDefaultTokensByNetwork(tokensResponse.tokens),
        features: {
          invoicing: true,
          payroll: true,
          escrow: false, // Phase 2 feature
          subscriptions: false, // Phase 4 feature
          crossChain: false, // Phase 5 feature
        },
        limits: {
          maxInvoiceAmount: '1000000', // $1M
          minInvoiceAmount: '1', // $1
          maxPayrollRecipients: 1000,
          rateLimitPerHour: 1000,
        },
        ui: {
          defaultCurrency: 'USD',
          theme: 'light',
          showTestnets: process.env.NODE_ENV !== 'production',
        },
      };

      const response: ConfigResponse = {
        networks: networksResponse.networks,
        tokens: tokensResponse.tokens,
        appConfig,
        meta: {
          networksCount: networksResponse.count,
          tokensCount: tokensResponse.count,
          lastUpdated: new Date().toISOString(),
          cacheExpiry: Date.now() + (ConfigService.CACHE_TTL.appConfig * 1000),
        },
      };

      this.logger.info('Successfully generated app configuration', {
        networksCount: response.meta.networksCount,
        tokensCount: response.meta.tokensCount,
      });

      return response;
    } catch (error: any) {
      this.logger.error('Failed to fetch app configuration', { error: error.message });
      throw new Error(`Failed to fetch app configuration: ${error.message}`);
    }
  }

  /**
   * Get health status of configuration service
   */
  async getHealthStatus() {
    try {
      // For global configuration entities, we don't use tenant context
      // BlockchainNetwork and Token are global configuration data
      const [networkCount, tokenCount] = await Promise.all([
        this.networkRepo.createQueryBuilder('network')
          .where('network.isActive = :isActive', { isActive: true })
          .getCount(),
        this.tokenRepo.createQueryBuilder('token')
          .where('token.isActive = :isActive', { isActive: true })
          .getCount(),
      ]);

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        data: {
          activeNetworks: networkCount,
          activeTokens: tokenCount,
          cacheStatus: 'operational', // Would check Redis in production
        },
      };
    } catch (error: any) {
      this.logger.error('Config service health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: `Failed to count BlockchainNetwork records: ${error.message}`,
      };
    }
  }

  /**
   * Transform blockchain network entity to API response format
   */
  private transformNetworkEntity(network: BlockchainNetwork): NetworkConfig {
    return {
      id: network.chainId.toString(), // Use chainId as the id since it's the primary key
      chainId: network.chainId,
      name: network.name,
      symbol: network.symbol,
      rpcUrl: network.rpcUrl,
      explorerUrl: network.explorerUrl,
      isTestnet: network.isTestnet,
      isActive: network.isActive,
      gasSettings: network.gasSettings,
      networkType: network.networkType,
      explorerTxUrl: network.explorerTxUrl,
      explorerAddressUrl: network.explorerAddressUrl,
      hasEIP1559Support: network.hasEIP1559Support,
      createdAt: network.createdAt.toISOString(),
      updatedAt: network.updatedAt.toISOString(),
    };
  }

  /**
   * Transform token entity to API response format
   */
  private transformTokenEntity(token: Token): TokenConfig {
    return {
      id: token.id,
      networkId: token.chainId.toString(), // Map chainId to networkId for frontend compatibility
      contractAddress: token.contractAddress,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      isNative: token.isNative,
      isStablecoin: token.isStablecoin,
      logoUrl: token.logoUrl,
      priceFeedId: token.priceFeedId,
      isActive: token.isActive,
      displayName: token.displayName,
      isERC20: token.isERC20,
      tokenType: token.tokenType,
      decimalsForDisplay: token.decimalsForDisplay,
      createdAt: token.createdAt.toISOString(),
      updatedAt: token.updatedAt.toISOString(),
      network: token.network ? this.transformNetworkEntity(token.network) : undefined,
    };
  }

  /**
   * Generate default tokens by network for app config
   */
  private getDefaultTokensByNetwork(tokens: TokenConfig[]): { [networkId: string]: string[] } {
    const defaultTokens: { [networkId: string]: string[] } = {};

    // Group tokens by network
    const tokensByNetwork = tokens.reduce((acc, token) => {
      if (!acc[token.networkId]) {
        acc[token.networkId] = [];
      }
      acc[token.networkId].push(token);
      return acc;
    }, {} as { [networkId: string]: TokenConfig[] });

    // For each network, prioritize stablecoins and native tokens
    Object.entries(tokensByNetwork).forEach(([networkId, networkTokens]) => {
      const prioritized = networkTokens
        .sort((a, b) => {
          // Native tokens first
          if (a.isNative && !b.isNative) return -1;
          if (!a.isNative && b.isNative) return 1;
          
          // Then stablecoins
          if (a.isStablecoin && !b.isStablecoin) return -1;
          if (!a.isStablecoin && b.isStablecoin) return 1;
          
          // Then alphabetical
          return a.symbol.localeCompare(b.symbol);
        })
        .slice(0, 5) // Max 5 default tokens per network
        .map(token => token.symbol);

      defaultTokens[networkId] = prioritized;
    });

    return defaultTokens;
  }

  /**
   * Validate network configuration
   */
  async validateNetwork(chainId: number): Promise<boolean> {
    try {
      const network = await this.networkRepo.findOne({
        where: { chainId, isActive: true },
      });
      return !!network;
    } catch {
      return false;
    }
  }

  /**
   * Validate token for network
   */
  async validateToken(networkId: string, tokenSymbol: string): Promise<boolean> {
    try {
      const token = await this.tokenRepo.findOne({
        where: { 
          networkId, 
          symbol: tokenSymbol, 
          isActive: true 
        },
      });
      return !!token;
    } catch {
      return false;
    }
  }
}