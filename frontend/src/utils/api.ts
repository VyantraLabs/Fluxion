import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config, apiEndpoints } from './config';
import { ApiResponse, PaginatedResponse, ErrorCodes, TenantContext } from '@/types/common';

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
  return localStorage.getItem('fluxion_auth_token');
};

const handleAuthError = (): void => {
  // Clear stored auth token
  if (typeof window !== 'undefined') {
    localStorage.removeItem('fluxion_auth_token');
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
};

export const userApi = {
  exists: (wallet: string) =>
    apiRequest.get(apiEndpoints.users.exists(wallet)),

  getProfile: (wallet: string) =>
    apiRequest.get(apiEndpoints.users.profile(wallet)),

  updateProfile: (wallet: string, data: any) =>
    apiRequest.put(apiEndpoints.users.profile(wallet), data),

  deleteProfile: (wallet: string) =>
    apiRequest.delete(apiEndpoints.users.profile(wallet)),

  validateAddress: (walletAddress: string) =>
    apiRequest.post(apiEndpoints.users.validateAddress, { wallet_address: walletAddress }),
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

  getUserInvoices: (
    wallet: string,
    params?: {
      limit?: number;
      nextToken?: string;
      status?: string;
    }
  ) => apiRequest.get(apiEndpoints.invoices.user(wallet), params),
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

  getUser: (wallet: string) =>
    apiRequest.get(apiEndpoints.analytics.user(wallet)),
};

// Configuration API
export const configApi = {
  // Get all blockchain networks
  getNetworks: (params?: {
    active?: boolean;
    testnet?: boolean;
    chainIds?: number[];
    symbols?: string[];
    includeTokens?: boolean;
  }) => {
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

    return apiRequest.get(apiEndpoints.config.networks, queryParams);
  },

  // Get specific network by chain ID
  getNetworkByChainId: (chainId: number) =>
    apiRequest.get(apiEndpoints.config.networkByChainId(chainId)),

  // Get all tokens
  getTokens: (params?: {
    active?: boolean;
    stablecoin?: boolean;
    native?: boolean;
    networkId?: string;
    chainId?: number;
    symbols?: string[];
    includeNetwork?: boolean;
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

    return apiRequest.get(apiEndpoints.config.tokens, queryParams);
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
  getSummary: () =>
    apiRequest.get(apiEndpoints.config.summary),

  // Validate network support
  validateNetwork: (chainId: number) =>
    apiRequest.get(apiEndpoints.config.validateNetwork(chainId)),

  // Get configuration health status
  getHealth: () =>
    apiRequest.get(apiEndpoints.config.health),
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