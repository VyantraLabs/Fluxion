/**
 * Configuration types for blockchain networks, tokens, and application settings
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

// API request/response types
export interface GetNetworksQuery {
  active?: 'true' | 'false';
  testnet?: 'true' | 'false';
  chainIds?: string; // comma-separated chain IDs
  symbols?: string; // comma-separated symbols
  includeTokens?: 'true' | 'false';
}

export interface GetTokensQuery {
  active?: 'true' | 'false';
  stablecoin?: 'true' | 'false';
  native?: 'true' | 'false';
  networkId?: string;
  chainId?: string;
  symbols?: string; // comma-separated symbols
  includeNetwork?: 'true' | 'false';
}

export interface GetNetworkTokensQuery {
  active?: 'true' | 'false';
  stablecoin?: 'true' | 'false';
  native?: 'true' | 'false';
  symbols?: string; // comma-separated symbols
}

// Error types
export interface ConfigError {
  code: string;
  message: string;
  details?: any;
}

// Cache-related types
export interface CacheMetadata {
  key: string;
  ttl: number;
  lastUpdated: string;
  hitCount: number;
}

// Validation types
export interface NetworkValidation {
  chainId: number;
  isValid: boolean;
  errors: string[];
}

export interface TokenValidation {
  contractAddress?: string;
  symbol: string;
  networkId: string;
  isValid: boolean;
  errors: string[];
}