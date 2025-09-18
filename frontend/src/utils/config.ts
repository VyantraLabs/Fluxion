// Environment configuration
export const config = {
  // API Configuration (Microservices)
  api: {
    // Main service (user-facing APIs)
    mainService: {
      baseUrl: process.env.NEXT_PUBLIC_MAIN_SERVICE_URL || 'http://localhost:3000',
      basePath: process.env.NEXT_PUBLIC_API_BASE_PATH || '/api',
      timeout: 30000, // 30 seconds
    },
    // Admin service (admin-facing APIs)
    adminService: {
      baseUrl: process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL || 'http://localhost:3001',
      basePath: process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '/admin',
      timeout: 30000, // 30 seconds
    },
    // Legacy support (fallback to main service)
    baseUrl: process.env.NEXT_PUBLIC_MAIN_SERVICE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    basePath: process.env.NEXT_PUBLIC_API_BASE_PATH || '/api',
    version: process.env.NEXT_PUBLIC_API_VERSION || '',
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
  
  // Blockchain Configuration (minimal, use ConfigContext for dynamic data)
  blockchain: {
    defaultChainId: parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '137'),
    // NOTE: Networks and tokens are now loaded dynamically from /config/networks API
    // Use ConfigContext hooks instead of hardcoded values
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

// Helper functions (DEPRECATED - use ConfigContext hooks instead)
// These functions are kept for backward compatibility but should not be used in new code
export const getNetworkById = (chainId: number) => {
  console.warn('getNetworkById is deprecated. Use useNetworkById from ConfigContext instead.');
  return undefined;
};

export const getUSDCContract = (chainId: number) => {
  console.warn('getUSDCContract is deprecated. Use useTokensByChainId and filter for stablecoins instead.');
  return undefined;
};

export const getRpcUrl = (chainId: number): string => {
  console.warn('getRpcUrl is deprecated. Use ConfigContext to get network RPC URLs.');
  // Fallback to public RPC for compatibility
  switch (chainId) {
    case 137:
      return 'https://polygon-rpc.com';
    case 80001:
      return 'https://rpc-mumbai.maticvigil.com';
    default:
      throw new Error(`Unsupported chain ID: ${chainId}. Use ConfigContext for dynamic network support.`);
  }
};

// Dynamic configuration helpers (use these with ConfigContext)
export const createNetworkInfo = (networkConfig: import('@/types/config').NetworkConfig): import('@/types/web3').NetworkInfo => {
  return {
    chainId: networkConfig.chainId,
    name: networkConfig.name,
    currency: {
      name: networkConfig.symbol,
      symbol: networkConfig.symbol,
      decimals: 18, // Default for most native tokens
    },
    rpcUrls: [networkConfig.rpcUrl || `https://rpc-${networkConfig.chainId}.fluxion.pay`],
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
  console.warn('isMainnet is deprecated. Use ConfigContext to get network information.');
  // Fallback logic for backward compatibility
  return chainId === 137; // Polygon mainnet
};

export const isTestnet = (chainId: number): boolean => {
  console.warn('isTestnet is deprecated. Use ConfigContext to get network information.');
  // Fallback logic for backward compatibility
  return chainId === 80001; // Polygon Mumbai testnet
};

// Create dynamic API endpoints using environment variables
export const createApiEndpoints = () => {
  const API_BASE_PATH = config.api.basePath;
  
  return {
    // Health (no prefix - root level)
    health: '/health',
    metrics: '/metrics',
    
    // Authentication (main service with configurable prefix)
    auth: {
      message: `${API_BASE_PATH}/users/auth/message`,
      verify: `${API_BASE_PATH}/users/auth/verify`,
      create: `${API_BASE_PATH}/users/auth/create`,
    },
    
    // Users (Authentication endpoints - no auth required, main service)
    users: {
      exists: (wallet: string) => `${API_BASE_PATH}/users/exists/${wallet}`,
      validateAddress: `${API_BASE_PATH}/users/validate-address`,
      platformStats: `${API_BASE_PATH}/users/platform/stats`,
    },
    
    // User (Authenticated endpoints - require auth, main service)
    user: {
      profile: `${API_BASE_PATH}/user/profile`,
      stats: `${API_BASE_PATH}/user/stats`,
      completeOnboarding: `${API_BASE_PATH}/users/onboarding/complete`,
    },
    
    // Invoices (main service)
    invoices: {
      base: `${API_BASE_PATH}/invoices`,
      byId: (id: string) => `${API_BASE_PATH}/invoices/${id}`,
      public: (id: string) => `${API_BASE_PATH}/invoices/${id}/public`,
      send: (id: string) => `${API_BASE_PATH}/invoices/${id}/send`,
      stats: `${API_BASE_PATH}/invoices/stats`,
    },
    
    // Payments (main service)
    payments: {
      verify: `${API_BASE_PATH}/payments/verify`,
      byId: (id: string) => `${API_BASE_PATH}/payments/${id}`,
      byTxHash: (hash: string) => `${API_BASE_PATH}/payments/tx/${hash}`,
    },
    
    // Analytics (main service)
    analytics: {
      platform: `${API_BASE_PATH}/analytics/platform`,
    },

    // Configuration (main service)
    config: {
      networks: `${API_BASE_PATH}/config/networks`,
      networkByChainId: (chainId: number) => `${API_BASE_PATH}/config/networks/${chainId}`,
      tokens: `${API_BASE_PATH}/config/tokens`,
      tokensByChainId: (chainId: number) => `${API_BASE_PATH}/config/tokens/${chainId}`,
      appConfig: `${API_BASE_PATH}/config/app-config`,
      health: `${API_BASE_PATH}/config/health`,
      validateNetwork: (chainId: number) => `${API_BASE_PATH}/config/validate/network/${chainId}`,
    },

    // Templates (main service)
    templates: {
      base: `${API_BASE_PATH}/templates`,
      byId: (id: string) => `${API_BASE_PATH}/templates/${id}`,
      categories: `${API_BASE_PATH}/templates/categories`,
      analytics: (id: string) => `${API_BASE_PATH}/templates/${id}/analytics`,
      incrementUsage: (id: string) => `${API_BASE_PATH}/templates/${id}/use`,
    },

    // Reminders (main service)
    reminders: {
      base: `${API_BASE_PATH}/reminders`,
      byId: (id: string) => `${API_BASE_PATH}/reminders/${id}`,
      execute: (id: string) => `${API_BASE_PATH}/reminders/${id}/execute`,
      pause: (id: string) => `${API_BASE_PATH}/reminders/${id}/pause`,
      resume: (id: string) => `${API_BASE_PATH}/reminders/${id}/resume`,
      analytics: (id: string) => `${API_BASE_PATH}/reminders/${id}/analytics`,
      stats: `${API_BASE_PATH}/reminders/stats`,
      templates: `${API_BASE_PATH}/reminders/templates`,
      byInvoice: (invoiceId: string) => `${API_BASE_PATH}/reminders/invoice/${invoiceId}`,
      setupForInvoice: (invoiceId: string) => `${API_BASE_PATH}/reminders/invoice/${invoiceId}/setup`,
      bulkCreate: `${API_BASE_PATH}/reminders/bulk/create`,
    },
  } as const;
};

// Create the apiEndpoints with current configuration
export const apiEndpoints = createApiEndpoints();

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