// Network configuration management with session storage caching
import { apiEndpoints } from './config';

export interface NetworkWithTokens {
  id: string;
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl?: string;
  explorerUrl?: string;
  isTestnet: boolean;
  isActive: boolean;
  gasSettings?: any;
  tokens: TokenConfig[];
}

export interface TokenConfig {
  id: string;
  networkId: string;
  contractAddress?: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
  isStablecoin: boolean;
  logoUrl?: string;
  isActive: boolean;
  isERC20?: boolean;
  tokenType?: string;
  displayName?: string;
}

const NETWORK_CONFIG_KEY = 'fluxion_network_config';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface CachedNetworkConfig {
  networks: NetworkWithTokens[];
  timestamp: number;
}

export class NetworkConfigManager {
  private static instance: NetworkConfigManager;
  private configPromise: Promise<NetworkWithTokens[]> | null = null;

  private constructor() {}

  static getInstance(): NetworkConfigManager {
    if (!NetworkConfigManager.instance) {
      NetworkConfigManager.instance = new NetworkConfigManager();
    }
    return NetworkConfigManager.instance;
  }

  // Get cached config from session storage
  private getCachedConfig(): NetworkWithTokens[] | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const cached = sessionStorage.getItem(NETWORK_CONFIG_KEY);
      if (!cached) return null;
      
      const config: CachedNetworkConfig = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is still valid
      if (now - config.timestamp > CACHE_DURATION) {
        sessionStorage.removeItem(NETWORK_CONFIG_KEY);
        return null;
      }
      
      return config.networks;
    } catch (error) {
      console.error('Error reading cached network config:', error);
      return null;
    }
  }

  // Save config to session storage
  private setCachedConfig(networks: NetworkWithTokens[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      const config: CachedNetworkConfig = {
        networks,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(NETWORK_CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Error caching network config:', error);
    }
  }

  // Fetch network configurations from API
  async fetchNetworkConfigs(): Promise<NetworkWithTokens[]> {
    // Check cache first
    const cached = this.getCachedConfig();
    if (cached) {
      return cached;
    }

    // If already fetching, return the existing promise
    if (this.configPromise) {
      return this.configPromise;
    }

    // Create new fetch promise
    this.configPromise = this.fetchFromAPI();
    
    try {
      const networks = await this.configPromise;
      this.setCachedConfig(networks);
      return networks;
    } finally {
      this.configPromise = null;
    }
  }

  private async fetchFromAPI(): Promise<NetworkWithTokens[]> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(
        `${baseUrl}${apiEndpoints.config.networks}?active=true&includeTokens=true`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch network configs: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data?.networks) {
        return data.data.networks;
      }
      
      throw new Error('Invalid response format from network config API');
    } catch (error) {
      console.error('Error fetching network configs:', error);
      // Return fallback configuration
      return this.getFallbackConfig();
    }
  }

  // Get all networks
  async getNetworks(): Promise<NetworkWithTokens[]> {
    return this.fetchNetworkConfigs();
  }

  // Get a specific network by chain ID
  async getNetworkByChainId(chainId: number): Promise<NetworkWithTokens | undefined> {
    const networks = await this.fetchNetworkConfigs();
    return networks.find(n => n.chainId === chainId);
  }

  // Get tokens for a specific network
  async getTokensByChainId(chainId: number): Promise<TokenConfig[]> {
    const network = await this.getNetworkByChainId(chainId);
    return network?.tokens || [];
  }

  // Get all active tokens across all networks
  async getAllTokens(): Promise<TokenConfig[]> {
    const networks = await this.fetchNetworkConfigs();
    return networks.flatMap(n => n.tokens);
  }

  // Clear cache
  clearCache(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(NETWORK_CONFIG_KEY);
    }
    this.configPromise = null;
  }

  // Get fallback configuration for development
  private getFallbackConfig(): NetworkWithTokens[] {
    return [
      {
        id: 'polygon-mainnet',
        chainId: 137,
        name: 'Polygon',
        symbol: 'MATIC',
        rpcUrl: 'https://polygon-rpc.com',
        explorerUrl: 'https://polygonscan.com',
        isTestnet: false,
        isActive: true,
        tokens: [
          {
            id: 'matic-native',
            networkId: 'polygon-mainnet',
            symbol: 'MATIC',
            name: 'Polygon',
            decimals: 18,
            isNative: true,
            isStablecoin: false,
            isActive: true,
          },
          {
            id: 'usdc-polygon',
            networkId: 'polygon-mainnet',
            contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            isNative: false,
            isStablecoin: true,
            isActive: true,
          },
          {
            id: 'usdt-polygon',
            networkId: 'polygon-mainnet',
            contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            symbol: 'USDT',
            name: 'Tether USD',
            decimals: 6,
            isNative: false,
            isStablecoin: true,
            isActive: true,
          },
        ],
      },
    ];
  }
}

// Export singleton instance methods for convenience
export const networkConfigManager = NetworkConfigManager.getInstance();

export const getNetworks = () => networkConfigManager.getNetworks();
export const getNetworkByChainId = (chainId: number) => networkConfigManager.getNetworkByChainId(chainId);
export const getTokensByChainId = (chainId: number) => networkConfigManager.getTokensByChainId(chainId);
export const getAllTokens = () => networkConfigManager.getAllTokens();
export const clearNetworkCache = () => networkConfigManager.clearCache();