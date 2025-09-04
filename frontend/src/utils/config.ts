import { NetworkInfo, POLYGON_MAINNET, POLYGON_MUMBAI } from '@/types/web3';

// Environment configuration
export const config = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    version: process.env.NEXT_PUBLIC_API_VERSION || 'v1',
    timeout: 30000, // 30 seconds
  },
  
  // Frontend Configuration
  frontend: {
    url: process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://fluxion.pay',
  },
  
  // Environment
  env: process.env.NEXT_PUBLIC_ENV || 'production',
  isDevelopment: process.env.NEXT_PUBLIC_ENV === 'development',
  isProduction: process.env.NEXT_PUBLIC_ENV === 'production',
  
  // Blockchain Configuration
  blockchain: {
    defaultChainId: parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '137'),
    networks: {
      polygon: POLYGON_MAINNET,
      mumbai: POLYGON_MUMBAI,
    } as Record<string, NetworkInfo>,
    rpcUrls: {
      137: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com',
      80001: process.env.NEXT_PUBLIC_POLYGON_MUMBAI_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
    },
  },
  
  // USDC Contract Configuration
  usdc: {
    contracts: {
      137: {
        address: process.env.NEXT_PUBLIC_USDC_POLYGON || '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
      },
      80001: {
        address: process.env.NEXT_PUBLIC_USDC_MUMBAI || '0x9999f7fea5938fd3b1e26a12c3f2fb024e194f97',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin (Test)',
      },
    },
  },
  
  // External APIs
  external: {
    alchemy: {
      apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
    },
    infura: {
      projectId: process.env.NEXT_PUBLIC_INFURA_PROJECT_ID,
    },
  },
  
  // Analytics
  analytics: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    google: {
      trackingId: process.env.NEXT_PUBLIC_GA_TRACKING_ID,
    },
    mixpanel: {
      token: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
    },
  },
  
  // Error Reporting
  sentry: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true',
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  
  // Feature Flags
  features: {
    notifications: process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true',
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    errorReporting: process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true',
  },
  
  // Rate Limiting
  rateLimit: {
    maxRequestsPerMinute: parseInt(process.env.NEXT_PUBLIC_MAX_REQUESTS_PER_MINUTE || '60'),
  },
  
  // File Upload
  upload: {
    maxFileSizeMB: parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '5'),
  },
  
  // Debug Configuration
  debug: {
    enabled: process.env.NEXT_PUBLIC_DEBUG === 'true',
    verboseLogging: process.env.NEXT_PUBLIC_VERBOSE_LOGGING === 'true',
  },
  
  // Wallet Configuration
  wallet: {
    connectTimeout: 30000, // 30 seconds
    transactionTimeout: 300000, // 5 minutes
    confirmations: {
      required: 1, // Minimum confirmations for payment confirmation
      safe: 12, // Recommended confirmations for large amounts
    },
  },
  
  // Invoice Configuration
  invoice: {
    maxLineItems: 20,
    maxDescriptionLength: 500,
    dueDateRange: {
      minDays: 1,
      maxDays: 365,
    },
    amounts: {
      min: 0.01, // $0.01 USD
      max: 1000000, // $1M USD
    },
  },
  
  // UI Configuration
  ui: {
    toastDuration: 5000, // 5 seconds
    debounceDelay: 300, // 300ms
    animationDuration: 200, // 200ms
    pageSizes: [10, 20, 50, 100],
    defaultPageSize: 20,
  },
} as const;

// Helper functions (legacy - prefer using ConfigContext hooks)
export const getNetworkById = (chainId: number): NetworkInfo | undefined => {
  return Object.values(config.blockchain.networks).find(
    (network) => network.chainId === chainId
  );
};

export const getUSDCContract = (chainId: number) => {
  return config.usdc.contracts[chainId as keyof typeof config.usdc.contracts];
};

export const getRpcUrl = (chainId: number): string => {
  const rpcUrl = config.blockchain.rpcUrls[chainId as keyof typeof config.blockchain.rpcUrls];
  
  // Fallback to public RPC if not configured
  if (!rpcUrl) {
    switch (chainId) {
      case 137:
        return 'https://polygon-rpc.com';
      case 80001:
        return 'https://rpc-mumbai.maticvigil.com';
      default:
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
  }
  
  return rpcUrl;
};

// Dynamic configuration helpers (use these with ConfigContext)
export const createNetworkInfo = (networkConfig: import('@/types/config').NetworkConfig): NetworkInfo => {
  return {
    chainId: networkConfig.chainId,
    name: networkConfig.name,
    currency: {
      name: networkConfig.symbol,
      symbol: networkConfig.symbol,
      decimals: 18, // Default for most native tokens
    },
    rpcUrls: [networkConfig.rpcUrl || getRpcUrl(networkConfig.chainId)], // Fallback to static config
    blockExplorerUrls: networkConfig.explorerUrl ? [networkConfig.explorerUrl] : [],
    iconUrls: [],
  };
};

export const getTokenInfoFromConfig = (tokenConfig: import('@/types/config').TokenConfig): import('@/types/common').TokenInfo => {
  return {
    address: tokenConfig.contractAddress || '',
    symbol: tokenConfig.symbol,
    name: tokenConfig.name,
    decimals: tokenConfig.decimals,
    logoURI: tokenConfig.logoUrl,
  };
};

export const isMainnet = (chainId: number): boolean => {
  return chainId === 137; // Polygon mainnet
};

export const isTestnet = (chainId: number): boolean => {
  return chainId === 80001; // Polygon Mumbai testnet
};

// API endpoints
export const apiEndpoints = {
  // Health
  health: '/health',
  metrics: '/metrics',
  
  // Authentication
  auth: {
    message: '/users/auth/message',
    verify: '/users/auth/verify',
  },
  
  // Users
  users: {
    exists: (wallet: string) => `/users/exists/${wallet}`,
    profile: (wallet: string) => `/users/profile/${wallet}`,
    validateAddress: '/users/validate-address',
  },
  
  // Invoices
  invoices: {
    base: '/invoices',
    byId: (id: string) => `/invoices/${id}`,
    public: (id: string) => `/invoices/${id}/public`,
    send: (id: string) => `/invoices/${id}/send`,
    user: (wallet: string) => `/invoices/user/${wallet}`,
  },
  
  // Payments
  payments: {
    verify: '/payments/verify',
    byId: (id: string) => `/payments/${id}`,
    byTxHash: (hash: string) => `/payments/tx/${hash}`,
  },
  
  // Analytics
  analytics: {
    platform: '/analytics/platform',
    user: (wallet: string) => `/analytics/user/${wallet}`,
  },

  // Configuration
  config: {
    networks: '/config/networks',
    networkByChainId: (chainId: number) => `/config/networks/${chainId}`,
    tokens: '/config/tokens',
    tokensByChainId: (chainId: number) => `/config/tokens/${chainId}`,
    appConfig: '/config/app-config',
    summary: '/config/summary',
    health: '/config/health',
    validateNetwork: (chainId: number) => `/config/validate/network/${chainId}`,
  },
} as const;

// Validation
export const validateConfig = () => {
  const errors: string[] = [];
  
  if (!config.api.baseUrl) {
    errors.push('API base URL is required');
  }
  
  if (!config.blockchain.defaultChainId) {
    errors.push('Default chain ID is required');
  }
  
  const defaultChainConfig = getUSDCContract(config.blockchain.defaultChainId);
  if (!defaultChainConfig) {
    errors.push(`USDC contract not configured for chain ID: ${config.blockchain.defaultChainId}`);
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
};

// Export types for better TypeScript support
export type Config = typeof config;
export type ApiEndpoints = typeof apiEndpoints;