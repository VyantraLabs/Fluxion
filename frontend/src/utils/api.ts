import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config, apiEndpoints } from './config';
import { ApiResponse, PaginatedResponse, ErrorCodes, TenantContext } from '@/types/common';
import { authStorage } from './storage';

// Create axios instance
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: config.api.baseUrl,
    timeout: config.api.timeout,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Version': '1.0.0',
      'X-Request-Source': 'frontend',
      'X-Tenant-ID': 'default', // Required for multi-tenant backend
    },
  });

  // Request interceptor for authentication
  client.interceptors.request.use(
    (config) => {
      // Add auth token if available
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add request ID for tracking
      config.headers['X-Request-ID'] = generateRequestId();

      // Add timestamp
      config.headers['X-Request-Timestamp'] = new Date().toISOString();

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
      // Log successful responses in development
      if (config.debug.enabled) {
        console.log('API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
      }

      return response;
    },
    (error) => {
      console.error('API Error:', error);

      // Handle specific error cases
      if (error.response) {
        const { status, data } = error.response;

        // Handle authentication errors
        if (status === 401 || data?.error?.code === ErrorCodes.UNAUTHORIZED) {
          handleAuthError();
        }

        // Handle rate limiting
        if (status === 429 || data?.error?.code === ErrorCodes.RATE_LIMIT_EXCEEDED) {
          handleRateLimitError();
        }

        // Enhanced error structure to match backend
        const errorInfo = {
          status,
          message: data?.error?.message || data?.message || 'An error occurred',
          code: data?.error?.code || mapStatusToErrorCode(status),
          details: data?.error?.details || data?.details,
          // Additional context from enhanced error responses
          validation_errors: data?.error?.validation_errors,
          request_id: data?.meta?.requestId,
          timestamp: data?.meta?.timestamp,
        };

        console.error('API Error Details:', errorInfo);
        return Promise.reject(errorInfo);
      }

      // Handle network errors
      if (error.request) {
        return Promise.reject({
          status: 0,
          message: 'Network error - please check your connection',
          code: 'NETWORK_ERROR',
        });
      }

      // Handle other errors
      return Promise.reject({
        status: 0,
        message: error.message || 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
      });
    }
  );

  return client;
};

// Create API client instance
export const apiClient = createApiClient();

// Helper functions
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return authStorage.getToken();
};

const handleAuthError = (): void => {
  // Clear stored auth token using proper storage utilities
  if (typeof window !== 'undefined') {
    authStorage.removeToken();
    // Keep the legacy localStorage removal for backward compatibility
    localStorage.removeItem('fluxion_user');
  }

  // Redirect to login or show auth modal
  if (typeof window !== 'undefined' && window.location.pathname !== '/') {
    window.location.href = '/';
  }
};

const handleRateLimitError = (): void => {
  // Show rate limit notification
  console.warn('Rate limit exceeded. Please try again later.');
};

// Map HTTP status codes to error codes
const mapStatusToErrorCode = (status: number): string => {
  switch (status) {
    case 400:
      return ErrorCodes.VALIDATION_ERROR;
    case 401:
      return ErrorCodes.UNAUTHORIZED;
    case 403:
      return ErrorCodes.FORBIDDEN;
    case 404:
      return ErrorCodes.NOT_FOUND;
    case 409:
      return ErrorCodes.CONFLICT;
    case 429:
      return ErrorCodes.RATE_LIMIT_EXCEEDED;
    case 503:
      return ErrorCodes.SERVICE_UNAVAILABLE;
    case 500:
    default:
      return ErrorCodes.INTERNAL_ERROR;
  }
};

// Generic API functions
export const apiRequest = {
  get: async <T = any>(
    url: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> => {
    const response = await apiClient.get(url, { params });
    return response.data;
  },

  post: async <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => {
    const response = await apiClient.post(url, data, config);
    return response.data;
  },

  put: async <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => {
    const response = await apiClient.put(url, data, config);
    return response.data;
  },

  delete: async <T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => {
    const response = await apiClient.delete(url, config);
    return response.data;
  },
};

// Specific API functions
export const healthApi = {
  check: () => apiRequest.get(apiEndpoints.health),
  metrics: () => apiRequest.get(apiEndpoints.metrics),
};

export const authApi = {
  getMessage: (walletAddress: string) =>
    apiRequest.post(apiEndpoints.auth.message, { wallet_address: walletAddress }),

  verifySignature: (walletAddress: string, signature: string, message: string) =>
    apiRequest.post(apiEndpoints.auth.verify, {
      wallet_address: walletAddress,
      signature,
      message,
    }),

  createUser: (
    walletAddress: string, 
    signature: string, 
    message: string,
    organizationName: string,
    displayName?: string,
    email?: string
  ) =>
    apiRequest.post(apiEndpoints.auth.create, {
      wallet_address: walletAddress,
      signature,
      message,
      organizationName,
      displayName,
      email,
    }),
};

export const userApi = {
  // Public user endpoints (no auth required)
  exists: (wallet: string) =>
    apiRequest.get(apiEndpoints.users.exists(wallet)),

  // Alias for backwards compatibility
  checkUserExists: (wallet: string) =>
    apiRequest.get(apiEndpoints.users.exists(wallet)),

  validateAddress: (walletAddress: string) =>
    apiRequest.post(apiEndpoints.users.validateAddress, { wallet_address: walletAddress }),

  getPlatformStats: () =>
    apiRequest.get(apiEndpoints.users.platformStats),

  // Authenticated user endpoints (auth required, no wallet parameter)
  getProfile: () =>
    apiRequest.get(apiEndpoints.user.profile),

  updateProfile: (data: any) =>
    apiRequest.put(apiEndpoints.user.profile, data),

  deleteProfile: () =>
    apiRequest.delete(apiEndpoints.user.profile),

  getStats: () =>
    apiRequest.get(apiEndpoints.user.stats),

  completeOnboarding: (data: { organizationName: string; displayName?: string; email?: string }) =>
    apiRequest.post(apiEndpoints.user.completeOnboarding, data),
};

export const invoiceApi = {
  create: (data: any) =>
    apiRequest.post(apiEndpoints.invoices.base, data),

  getById: (id: string) =>
    apiRequest.get(apiEndpoints.invoices.byId(id)),

  getPublic: (id: string) =>
    apiRequest.get(apiEndpoints.invoices.public(id)),

  update: (id: string, data: any) =>
    apiRequest.put(apiEndpoints.invoices.byId(id), data),

  delete: (id: string) =>
    apiRequest.delete(apiEndpoints.invoices.byId(id)),

  send: (id: string) =>
    apiRequest.post(apiEndpoints.invoices.send(id)),

  getUserInvoices: (params?: {
    limit?: number;
    nextToken?: string;
    status?: string;
  }) => apiRequest.get(apiEndpoints.invoices.base, params),

  getStats: () =>
    apiRequest.get(apiEndpoints.invoices.stats),
};

export const paymentApi = {
  verify: (invoiceId: string, txHash: string, fromAddress: string) =>
    apiRequest.post(apiEndpoints.payments.verify, {
      invoice_id: invoiceId,
      tx_hash: txHash,
      from_address: fromAddress,
    }),

  getById: (id: string) =>
    apiRequest.get(apiEndpoints.payments.byId(id)),

  getByTxHash: (hash: string) =>
    apiRequest.get(apiEndpoints.payments.byTxHash(hash)),
};

export const analyticsApi = {
  getPlatform: () =>
    apiRequest.get(apiEndpoints.analytics.platform),
};

// Template API
export const templateApi = {
  // Template CRUD
  create: (data: any) =>
    apiRequest.post('/api/templates', data),

  getById: (id: string) =>
    apiRequest.get(`/api/templates/${id}`),

  update: (id: string, data: any) =>
    apiRequest.put(`/api/templates/${id}`, data),

  delete: (id: string) =>
    apiRequest.delete(`/api/templates/${id}`),

  // Template listing
  getAll: (params?: {
    category?: string;
    isPublic?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) => apiRequest.get('/api/templates', params),

  getPublic: (params?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => apiRequest.get('/api/templates/public', params),

  getCategories: () =>
    apiRequest.get('/api/templates/categories'),

  // Template analytics
  getAnalytics: (id: string) =>
    apiRequest.get(`/api/templates/${id}/analytics`),

  // Template usage
  incrementUsage: (id: string) =>
    apiRequest.post(`/api/templates/${id}/use`),
};

// Session storage utilities for configuration caching
const SESSION_STORAGE_KEYS = {
  NETWORKS: 'fluxion_networks_cache',
  TOKENS: 'fluxion_tokens_cache',
  CONFIG_SUMMARY: 'fluxion_config_summary',
  CONFIG_TIMESTAMP: 'fluxion_config_timestamp'
};

// Cache duration in milliseconds (15 minutes)
const CACHE_DURATION = 15 * 60 * 1000;

const sessionCache = {
  set: (key: string, data: any) => {
    try {
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      sessionStorage.setItem(key, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn('Failed to cache data in session storage:', error);
    }
  },
  
  get: (key: string) => {
    try {
      const cached = sessionStorage.getItem(key);
      if (!cached) return null;
      
      const cacheEntry = JSON.parse(cached);
      const isExpired = Date.now() - cacheEntry.timestamp > CACHE_DURATION;
      
      if (isExpired) {
        sessionStorage.removeItem(key);
        return null;
      }
      
      return cacheEntry.data;
    } catch (error) {
      console.warn('Failed to retrieve cached data from session storage:', error);
      return null;
    }
  },
  
  clear: (key?: string) => {
    try {
      if (key) {
        sessionStorage.removeItem(key);
      } else {
        // Clear all fluxion cache keys
        Object.values(SESSION_STORAGE_KEYS).forEach(k => sessionStorage.removeItem(k));
      }
    } catch (error) {
      console.warn('Failed to clear session storage:', error);
    }
  }
};

// Configuration API
export const configApi = {
  // Get all blockchain networks
  getNetworks: async (params?: {
    active?: boolean;
    testnet?: boolean;
    chainIds?: number[];
    symbols?: string[];
    includeTokens?: boolean;
  }) => {
    // Generate cache key based on parameters
    const cacheKey = `${SESSION_STORAGE_KEYS.NETWORKS}_${JSON.stringify(params || {})}`;
    
    // Try to get from cache first
    if (typeof window !== 'undefined') {
      const cached = sessionCache.get(cacheKey);
      if (cached) {
        console.log('Using cached networks data');
        return cached;
      }
    }
    
    // If not cached, fetch from API
    const queryParams: Record<string, string> = {};
    
    if (params?.active !== undefined) {
      queryParams.active = params.active.toString();
    }
    if (params?.testnet !== undefined) {
      queryParams.testnet = params.testnet.toString();
    }
    if (params?.chainIds?.length) {
      queryParams.chainIds = params.chainIds.join(',');
    }
    if (params?.symbols?.length) {
      queryParams.symbols = params.symbols.join(',');
    }
    if (params?.includeTokens !== undefined) {
      queryParams.includeTokens = params.includeTokens.toString();
    }

    const response = await apiRequest.get(apiEndpoints.config.networks, queryParams);
    
    // Cache the response for future use
    if (typeof window !== 'undefined') {
      sessionCache.set(cacheKey, response);
      console.log('Networks data cached');
    }
    
    return response;
  },

  // Get specific network by chain ID
  getNetworkByChainId: (chainId: number) =>
    apiRequest.get(apiEndpoints.config.networkByChainId(chainId)),

  // Get all tokens
  getTokens: async (params?: {
    active?: boolean;
    stablecoin?: boolean;
    native?: boolean;
    networkId?: string;
    chainId?: number;
    symbols?: string[];
    includeNetwork?: boolean;
  }) => {
    // Generate cache key based on parameters
    const cacheKey = `${SESSION_STORAGE_KEYS.TOKENS}_${JSON.stringify(params || {})}`;
    
    // Try to get from cache first
    if (typeof window !== 'undefined') {
      const cached = sessionCache.get(cacheKey);
      if (cached) {
        console.log('Using cached tokens data');
        return cached;
      }
    }
    
    // If not cached, fetch from API
    const queryParams: Record<string, string> = {};
    
    if (params?.active !== undefined) {
      queryParams.active = params.active.toString();
    }
    if (params?.stablecoin !== undefined) {
      queryParams.stablecoin = params.stablecoin.toString();
    }
    if (params?.native !== undefined) {
      queryParams.native = params.native.toString();
    }
    if (params?.networkId) {
      queryParams.networkId = params.networkId;
    }
    if (params?.chainId !== undefined) {
      queryParams.chainId = params.chainId.toString();
    }
    if (params?.symbols?.length) {
      queryParams.symbols = params.symbols.join(',');
    }
    if (params?.includeNetwork !== undefined) {
      queryParams.includeNetwork = params.includeNetwork.toString();
    }

    const response = await apiRequest.get(apiEndpoints.config.tokens, queryParams);
    
    // Cache the response for future use
    if (typeof window !== 'undefined') {
      sessionCache.set(cacheKey, response);
      console.log('Tokens data cached');
    }
    
    return response;
  },

  // Get tokens for specific network
  getTokensByChainId: (chainId: number, params?: {
    active?: boolean;
    stablecoin?: boolean;
    native?: boolean;
    symbols?: string[];
  }) => {
    const queryParams: Record<string, string> = {};
    
    if (params?.active !== undefined) {
      queryParams.active = params.active.toString();
    }
    if (params?.stablecoin !== undefined) {
      queryParams.stablecoin = params.stablecoin.toString();
    }
    if (params?.native !== undefined) {
      queryParams.native = params.native.toString();
    }
    if (params?.symbols?.length) {
      queryParams.symbols = params.symbols.join(',');
    }

    return apiRequest.get(apiEndpoints.config.tokensByChainId(chainId), queryParams);
  },

  // Get complete application configuration
  getAppConfig: () =>
    apiRequest.get(apiEndpoints.config.appConfig),

  // Get lightweight configuration summary for frontend bootstrap
  getSummary: async () => {
    const cacheKey = SESSION_STORAGE_KEYS.CONFIG_SUMMARY;
    
    // Try to get from cache first
    if (typeof window !== 'undefined') {
      const cached = sessionCache.get(cacheKey);
      if (cached) {
        console.log('Using cached summary data');
        return cached;
      }
    }
    
    // If not cached, fetch from API
    const response = await apiRequest.get(apiEndpoints.config.summary);
    
    // Cache the response for future use
    if (typeof window !== 'undefined') {
      sessionCache.set(cacheKey, response);
      console.log('Summary data cached');
    }
    
    return response;
  },

  // Validate network support
  validateNetwork: (chainId: number) =>
    apiRequest.get(apiEndpoints.config.validateNetwork(chainId)),

  // Get configuration health status
  getHealth: () =>
    apiRequest.get(apiEndpoints.config.health),
    
  // Clear all cached configuration data
  clearCache: () => {
    if (typeof window !== 'undefined') {
      sessionCache.clear();
      console.log('All configuration cache cleared');
    }
  }
};

// Utility functions for handling API responses
export const handleApiResponse = <T>(
  response: ApiResponse<T>
): T => {
  if (!response.success) {
    const error = new Error(response.error?.message || 'API request failed');
    (error as any).code = response.error?.code;
    (error as any).details = response.error?.details;
    (error as any).validation_errors = response.error?.validation_errors;
    throw error;
  }

  if (response.data === undefined || response.data === null) {
    throw new Error('No data in API response');
  }

  return response.data;
};

// Enhanced error handler with validation error support
export const handleApiError = (error: any): never => {
  // If it's already a structured error from our interceptor
  if (error.code && error.message) {
    const enhancedError = new Error(error.message);
    (enhancedError as any).code = error.code;
    (enhancedError as any).details = error.details;
    (enhancedError as any).validation_errors = error.validation_errors;
    (enhancedError as any).status = error.status;
    throw enhancedError;
  }

  // Fallback for other errors
  throw new Error(error.message || 'An unexpected error occurred');
};

export const handlePaginatedResponse = <T>(
  response: PaginatedResponse<T>
): {
  data: T[];
  hasMore: boolean;
  nextToken?: string;
} => {
  const data = handleApiResponse(response);
  return {
    data,
    hasMore: response.pagination.hasMore,
    nextToken: response.pagination.nextToken,
  };
};

// Retry logic for failed requests
export const retryApiRequest = async <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;

      // Don't retry on authentication or validation errors
      if (error.status === 401 || error.status === 400) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError;
};

// Upload file helper
export const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; filename: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(progress);
      }
    },
  });

  return handleApiResponse(response.data);
};

// WebSocket connection for real-time updates
export const createWebSocketConnection = (
  endpoint: string,
  onMessage: (data: any) => void,
  onError?: (error: Event) => void
): WebSocket | null => {
  if (typeof window === 'undefined') return null;

  const wsUrl = config.api.baseUrl.replace('http', 'ws') + endpoint;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (onError) {
      onError(error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };

  return ws;
};

// Export session cache utilities for external use
export { sessionCache, SESSION_STORAGE_KEYS };