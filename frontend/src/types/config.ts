/**
 * Configuration types for blockchain networks, tokens, and application settings
 * These types match the backend API responses from /config endpoints
 */

export interface NetworkConfig {
  id: string;
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl?: string;
  isTestnet: boolean;
  isActive: boolean;
  gasSettings: GasSettings;
  networkType: 'mainnet' | 'testnet';
  explorerTxUrl?: string;
  explorerAddressUrl?: string;
  hasEIP1559Support: boolean;
  createdAt: string;
  updatedAt: string;
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
  priceFeedId?: string;
  isActive: boolean;
  displayName: string;
  isERC20: boolean;
  tokenType: 'native' | 'erc20';
  decimalsForDisplay: number;
  createdAt: string;
  updatedAt: string;
  network?: NetworkConfig;
}

export interface GasSettings {
  gasPrice?: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  type?: 'legacy' | 'eip1559';
}

export interface AppConfig {
  supportedNetworks: number[];
  supportedTokenSymbols: string[];
  defaultNetwork: number;
  defaultTokens: {
    [networkId: string]: string[];
  };
  features: {
    invoicing: boolean;
    payroll: boolean;
    escrow: boolean;
    subscriptions: boolean;
    crossChain: boolean;
  };
  limits: {
    maxInvoiceAmount: string;
    minInvoiceAmount: string;
    maxPayrollRecipients: number;
    rateLimitPerHour: number;
  };
  ui: {
    defaultCurrency: 'USD' | 'ETH' | 'BTC';
    theme: 'light' | 'dark' | 'auto';
    showTestnets: boolean;
  };
}

export interface NetworksResponse {
  networks: NetworkConfig[];
  count: number;
  mainnets: NetworkConfig[];
  testnets: NetworkConfig[];
}

export interface TokensResponse {
  tokens: TokenConfig[];
  count: number;
  stablecoins: TokenConfig[];
  nativeTokens: TokenConfig[];
  erc20Tokens: TokenConfig[];
}

export interface NetworkTokensResponse {
  networkId: string;
  network: NetworkConfig;
  tokens: TokenConfig[];
  count: number;
}

export interface ConfigResponse {
  networks: NetworkConfig[];
  tokens: TokenConfig[];
  appConfig: AppConfig;
  meta: {
    networksCount: number;
    tokensCount: number;
    lastUpdated: string;
    cacheExpiry: number;
  };
}

// Summary response for frontend bootstrap
export interface ConfigSummary {
  networks: Array<{
    chainId: number;
    name: string;
    symbol: string;
    isTestnet: boolean;
    gasSettings: GasSettings;
  }>;
  tokens: Array<{
    symbol: string;
    name: string;
    decimals: number;
    isNative: boolean;
    isStablecoin: boolean;
    contractAddress?: string;
    networkId: string;
    logoUrl?: string;
  }>;
  defaultNetwork: number;
  showTestnets: boolean;
  features: {
    invoicing: boolean;
    payroll: boolean;
    escrow: boolean;
    subscriptions: boolean;
    crossChain: boolean;
  };
}

// Filter and query interfaces
export interface NetworkFilter {
  isActive?: boolean;
  isTestnet?: boolean;
  chainIds?: number[];
  symbols?: string[];
}

export interface TokenFilter {
  isActive?: boolean;
  isStablecoin?: boolean;
  isNative?: boolean;
  networkId?: string;
  symbols?: string[];
  chainId?: number;
}

// API request parameters
export interface GetNetworksParams {
  active?: boolean;
  testnet?: boolean;
  chainIds?: number[];
  symbols?: string[];
  includeTokens?: boolean;
}

export interface GetTokensParams {
  active?: boolean;
  stablecoin?: boolean;
  native?: boolean;
  networkId?: string;
  chainId?: number;
  symbols?: string[];
  includeNetwork?: boolean;
}

export interface GetNetworkTokensParams {
  active?: boolean;
  stablecoin?: boolean;
  native?: boolean;
  symbols?: string[];
}

// Validation types
export interface NetworkValidation {
  chainId: number;
  isValid: boolean;
  message: string;
}

// Health check response
export interface ConfigHealthResponse {
  status: 'healthy' | 'unhealthy';
  data?: {
    networksCount: number;
    tokensCount: number;
    cacheStatus: string;
    lastUpdate: string;
  };
  error?: string;
}

// Dynamic configuration state for frontend
export interface DynamicConfig {
  networks: NetworkConfig[];
  tokens: TokenConfig[];
  defaultNetworkId: number;
  supportedChainIds: number[];
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}