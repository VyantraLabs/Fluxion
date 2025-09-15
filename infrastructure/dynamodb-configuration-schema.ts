/**
 * DynamoDB Configuration Schema for Fluxion
 * 
 * This file defines the DynamoDB table structure for configuration management,
 * feature flags, caching, and runtime settings to stay within the free tier.
 */

// ====================================
// TABLE STRUCTURE OVERVIEW
// ====================================
/*
TABLE: fluxion-config-{environment}
- PK (Partition Key): CONFIG#{type}
- SK (Sort Key): {identifier}
- GSI1PK: TYPE#{type}
- GSI1SK: UPDATED#{timestamp}
- TTL: Optional expiration timestamp
- Data: JSON object with configuration data

SUPPORTED CONFIG TYPES:
1. NETWORK - Blockchain network configurations
2. TOKEN - Token contract configurations  
3. FEATURE - Feature flag settings
4. SYSTEM - System-wide settings
5. TEMPLATE - Email/invoice template configs
6. CACHE - Temporary cached data

TABLE: fluxion-cache-{environment}
- PK: CACHE#{key}
- TTL: Expiration timestamp (required)
- Data: Cached value
*/

export interface DynamoDBConfigItem {
  PK: string;           // Partition key: CONFIG#{type}
  SK: string;           // Sort key: {identifier}
  GSI1PK?: string;      // GSI1 partition key: TYPE#{type}
  GSI1SK?: string;      // GSI1 sort key: UPDATED#{timestamp}
  TTL?: number;         // Optional TTL for expiration
  Type: ConfigType;     // Configuration type
  Data: any;            // Configuration data (JSON)
  CreatedAt: string;    // ISO timestamp
  UpdatedAt: string;    // ISO timestamp
  Version: number;      // Version for optimistic locking
}

export interface DynamoDBCacheItem {
  PK: string;           // Partition key: CACHE#{key}
  TTL: number;          // Required TTL for expiration
  Data: any;            // Cached data
  CreatedAt: string;    // ISO timestamp
}

export type ConfigType = 
  | 'NETWORK'
  | 'TOKEN' 
  | 'FEATURE'
  | 'SYSTEM'
  | 'TEMPLATE'
  | 'CACHE';

// ====================================
// CONFIGURATION SCHEMAS
// ====================================

export interface NetworkConfig {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl: string;
  isTestnet: boolean;
  isActive: boolean;
  gasSettings: {
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  confirmations: number;
  blockTime: number; // Average block time in seconds
}

export interface TokenConfig {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  isActive: boolean;
  logoUrl?: string;
  isStablecoin: boolean;
  coingeckoId?: string; // For price fetching
  minAmount: string;    // Minimum transfer amount
  maxAmount: string;    // Maximum transfer amount
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  conditions?: {
    environments?: string[];
    userRoles?: string[];
    organizationIds?: string[];
  };
  metadata?: {
    description: string;
    createdBy: string;
    jiraTicket?: string;
  };
}

export interface SystemConfig {
  maxInvoicesPerOrg: number;
  maxUsersPerOrg: number;
  defaultTokenDecimals: number;
  paymentTimeoutMinutes: number;
  emailRateLimit: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  apiRateLimit: {
    perMinute: number;
    perHour: number;
  };
  maintenanceMode: boolean;
  maintenanceMessage?: string;
}

export interface TemplateConfig {
  templateId: string;
  name: string;
  category: 'EMAIL' | 'INVOICE' | 'RECEIPT';
  isDefault: boolean;
  htmlContent?: string;
  mjmlContent?: string;
  variables: string[]; // List of supported variables
  metadata: {
    description: string;
    previewUrl?: string;
    lastModified: string;
    version: number;
  };
}

// ====================================
// DYNAMODB ACCESS PATTERNS
// ====================================

export class ConfigurationService {
  
  // Network Configuration
  static getNetworkConfigKey(chainId: number): { PK: string; SK: string } {
    return {
      PK: 'CONFIG#NETWORK',
      SK: `CHAIN#${chainId}`
    };
  }

  static createNetworkConfig(chainId: number, config: NetworkConfig): DynamoDBConfigItem {
    const timestamp = new Date().toISOString();
    return {
      ...this.getNetworkConfigKey(chainId),
      GSI1PK: 'TYPE#NETWORK',
      GSI1SK: `UPDATED#${timestamp}`,
      Type: 'NETWORK',
      Data: config,
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
      Version: 1
    };
  }

  // Token Configuration
  static getTokenConfigKey(chainId: number, address: string): { PK: string; SK: string } {
    return {
      PK: 'CONFIG#TOKEN',
      SK: `${chainId}#${address.toLowerCase()}`
    };
  }

  static createTokenConfig(config: TokenConfig): DynamoDBConfigItem {
    const timestamp = new Date().toISOString();
    return {
      ...this.getTokenConfigKey(config.chainId, config.address),
      GSI1PK: 'TYPE#TOKEN',
      GSI1SK: `UPDATED#${timestamp}`,
      Type: 'TOKEN',
      Data: config,
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
      Version: 1
    };
  }

  // Feature Flag Configuration
  static getFeatureFlagKey(flagKey: string): { PK: string; SK: string } {
    return {
      PK: 'CONFIG#FEATURE',
      SK: `FLAG#${flagKey}`
    };
  }

  static createFeatureFlag(flag: FeatureFlag): DynamoDBConfigItem {
    const timestamp = new Date().toISOString();
    return {
      ...this.getFeatureFlagKey(flag.key),
      GSI1PK: 'TYPE#FEATURE',
      GSI1SK: `UPDATED#${timestamp}`,
      Type: 'FEATURE',
      Data: flag,
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
      Version: 1
    };
  }

  // System Configuration
  static getSystemConfigKey(configKey: string): { PK: string; SK: string } {
    return {
      PK: 'CONFIG#SYSTEM',
      SK: `SETTING#${configKey}`
    };
  }

  static createSystemConfig(configKey: string, config: Partial<SystemConfig>): DynamoDBConfigItem {
    const timestamp = new Date().toISOString();
    return {
      ...this.getSystemConfigKey(configKey),
      GSI1PK: 'TYPE#SYSTEM',
      GSI1SK: `UPDATED#${timestamp}`,
      Type: 'SYSTEM',
      Data: config,
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
      Version: 1
    };
  }

  // Template Configuration
  static getTemplateConfigKey(templateId: string): { PK: string; SK: string } {
    return {
      PK: 'CONFIG#TEMPLATE',
      SK: `TEMPLATE#${templateId}`
    };
  }

  static createTemplateConfig(config: TemplateConfig): DynamoDBConfigItem {
    const timestamp = new Date().toISOString();
    return {
      ...this.getTemplateConfigKey(config.templateId),
      GSI1PK: 'TYPE#TEMPLATE',
      GSI1SK: `UPDATED#${timestamp}`,
      Type: 'TEMPLATE',
      Data: config,
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
      Version: 1
    };
  }

  // Cache Management
  static getCacheKey(key: string): { PK: string } {
    return {
      PK: `CACHE#${key}`
    };
  }

  static createCacheItem(key: string, data: any, ttlSeconds: number = 3600): DynamoDBCacheItem {
    const now = new Date();
    const ttlTimestamp = Math.floor((now.getTime() + (ttlSeconds * 1000)) / 1000);
    
    return {
      ...this.getCacheKey(key),
      TTL: ttlTimestamp,
      Data: data,
      CreatedAt: now.toISOString()
    };
  }
}

// ====================================
// SAMPLE DATA INITIALIZATION
// ====================================

export const DEFAULT_NETWORK_CONFIGS: NetworkConfig[] = [
  {
    chainId: 1,
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}',
    explorerUrl: 'https://etherscan.io',
    isTestnet: false,
    isActive: true,
    gasSettings: {
      maxFeePerGas: '20000000000',
      maxPriorityFeePerGas: '2000000000'
    },
    confirmations: 12,
    blockTime: 12
  },
  {
    chainId: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}',
    explorerUrl: 'https://polygonscan.com',
    isTestnet: false,
    isActive: true,
    gasSettings: {
      gasPrice: '30000000000'
    },
    confirmations: 20,
    blockTime: 2
  },
  {
    chainId: 42161,
    name: 'Arbitrum One',
    symbol: 'ETH',
    rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}',
    explorerUrl: 'https://arbiscan.io',
    isTestnet: false,
    isActive: true,
    gasSettings: {},
    confirmations: 1,
    blockTime: 1
  },
  {
    chainId: 8453,
    name: 'Base',
    symbol: 'ETH',
    rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}',
    explorerUrl: 'https://basescan.org',
    isTestnet: false,
    isActive: true,
    gasSettings: {},
    confirmations: 1,
    blockTime: 2
  }
];

export const DEFAULT_TOKEN_CONFIGS: TokenConfig[] = [
  // Ethereum Mainnet Tokens
  {
    address: '0xA0b86a33E6441f8C5a1a98fcE30A6EBD8F9dC5B9',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: 1,
    isActive: true,
    isStablecoin: true,
    coingeckoId: 'usd-coin',
    minAmount: '1',
    maxAmount: '1000000'
  },
  // Polygon Tokens
  {
    address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    symbol: 'USDC',
    name: 'USD Coin (PoS)',
    decimals: 6,
    chainId: 137,
    isActive: true,
    isStablecoin: true,
    coingeckoId: 'usd-coin',
    minAmount: '1',
    maxAmount: '1000000'
  },
  // Arbitrum Tokens
  {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: 42161,
    isActive: true,
    isStablecoin: true,
    coingeckoId: 'usd-coin',
    minAmount: '1',
    maxAmount: '1000000'
  },
  // Base Tokens
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: 8453,
    isActive: true,
    isStablecoin: true,
    coingeckoId: 'usd-coin',
    minAmount: '1',
    maxAmount: '1000000'
  }
];

export const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: 'enable_multi_token_payments',
    enabled: true,
    rolloutPercentage: 100,
    metadata: {
      description: 'Allow payments in multiple tokens beyond USDC',
      createdBy: 'system'
    }
  },
  {
    key: 'enable_invoice_templates',
    enabled: true,
    rolloutPercentage: 100,
    metadata: {
      description: 'Enable custom invoice templates',
      createdBy: 'system'
    }
  },
  {
    key: 'enable_bulk_operations',
    enabled: false,
    rolloutPercentage: 0,
    conditions: {
      userRoles: ['admin', 'super_admin']
    },
    metadata: {
      description: 'Enable bulk invoice operations',
      createdBy: 'system'
    }
  },
  {
    key: 'enable_advanced_analytics',
    enabled: false,
    rolloutPercentage: 25,
    metadata: {
      description: 'Enable advanced analytics dashboard',
      createdBy: 'system'
    }
  }
];

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  maxInvoicesPerOrg: 10000,
  maxUsersPerOrg: 100,
  defaultTokenDecimals: 6,
  paymentTimeoutMinutes: 60,
  emailRateLimit: {
    perMinute: 10,
    perHour: 100,
    perDay: 1000
  },
  apiRateLimit: {
    perMinute: 1000,
    perHour: 10000
  },
  maintenanceMode: false
};

// ====================================
// QUERY HELPERS
// ====================================

export interface QueryPatterns {
  // Get all networks
  getAllNetworks(): { PK: string };
  
  // Get active tokens for a chain
  getActiveTokensForChain(chainId: number): { GSI1PK: string; filterExpression: string };
  
  // Get all feature flags
  getAllFeatureFlags(): { PK: string };
  
  // Get system settings
  getSystemSettings(): { PK: string };
  
  // Get templates by category
  getTemplatesByCategory(category: string): { GSI1PK: string; filterExpression: string };
}

export const QueryHelpers: QueryPatterns = {
  getAllNetworks: () => ({
    PK: 'CONFIG#NETWORK'
  }),
  
  getActiveTokensForChain: (chainId: number) => ({
    GSI1PK: 'TYPE#TOKEN',
    filterExpression: '#data.chainId = :chainId AND #data.isActive = :isActive'
  }),
  
  getAllFeatureFlags: () => ({
    PK: 'CONFIG#FEATURE'
  }),
  
  getSystemSettings: () => ({
    PK: 'CONFIG#SYSTEM'
  }),
  
  getTemplatesByCategory: (category: string) => ({
    GSI1PK: 'TYPE#TEMPLATE',
    filterExpression: '#data.category = :category'
  })
};

// ====================================
// MIGRATION SCRIPT HELPERS
// ====================================

export const generateMigrationScript = () => {
  const networks = DEFAULT_NETWORK_CONFIGS.map(config => 
    ConfigurationService.createNetworkConfig(config.chainId, config)
  );
  
  const tokens = DEFAULT_TOKEN_CONFIGS.map(config =>
    ConfigurationService.createTokenConfig(config)
  );
  
  const features = DEFAULT_FEATURE_FLAGS.map(flag =>
    ConfigurationService.createFeatureFlag(flag)
  );
  
  const systemConfig = ConfigurationService.createSystemConfig('default', DEFAULT_SYSTEM_CONFIG);
  
  return {
    networks,
    tokens,
    features,
    system: [systemConfig]
  };
};

export default {
  ConfigurationService,
  QueryHelpers,
  generateMigrationScript,
  DEFAULT_NETWORK_CONFIGS,
  DEFAULT_TOKEN_CONFIGS,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_SYSTEM_CONFIG
};