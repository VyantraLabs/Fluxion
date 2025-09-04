'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { 
  DynamicConfig, 
  NetworkConfig, 
  TokenConfig, 
  ConfigSummary,
  NetworksResponse,
  TokensResponse 
} from '@/types/config';
import { configApi, handleApiResponse, handleApiError } from '@/utils/api';
import toast from 'react-hot-toast';

// Initial state
const initialState: DynamicConfig = {
  networks: [],
  tokens: [],
  defaultNetworkId: 137, // Polygon mainnet as fallback
  supportedChainIds: [],
  isLoaded: false,
  isLoading: false,
  error: null,
  lastUpdated: null,
};

// Action types
type ConfigAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: { networks: NetworkConfig[]; tokens: TokenConfig[]; defaultNetwork: number } }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'UPDATE_NETWORKS'; payload: NetworkConfig[] }
  | { type: 'UPDATE_TOKENS'; payload: TokenConfig[] }
  | { type: 'RESET' };

// Reducer
const configReducer = (state: DynamicConfig, action: ConfigAction): DynamicConfig => {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, isLoading: true, error: null };
    
    case 'LOAD_SUCCESS':
      return {
        ...state,
        networks: action.payload.networks,
        tokens: action.payload.tokens,
        defaultNetworkId: action.payload.defaultNetwork,
        supportedChainIds: action.payload.networks.map(n => n.chainId),
        isLoaded: true,
        isLoading: false,
        error: null,
        lastUpdated: new Date().toISOString(),
      };
    
    case 'LOAD_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
        isLoaded: false,
      };
    
    case 'UPDATE_NETWORKS':
      return {
        ...state,
        networks: action.payload,
        supportedChainIds: action.payload.map(n => n.chainId),
        lastUpdated: new Date().toISOString(),
      };
    
    case 'UPDATE_TOKENS':
      return {
        ...state,
        tokens: action.payload,
        lastUpdated: new Date().toISOString(),
      };
    
    case 'RESET':
      return initialState;
    
    default:
      return state;
  }
};

// Context interface
interface ConfigContextType {
  config: DynamicConfig;
  loadConfig: () => Promise<void>;
  loadSummary: () => Promise<void>;
  getNetworkById: (chainId: number) => NetworkConfig | undefined;
  getTokensByNetworkId: (networkId: string) => TokenConfig[];
  getTokensByChainId: (chainId: number) => TokenConfig[];
  getStablecoins: () => TokenConfig[];
  getNativeTokens: () => TokenConfig[];
  isNetworkSupported: (chainId: number) => boolean;
  refreshConfig: () => Promise<void>;
}

// Context
const ConfigContext = createContext<ConfigContextType | null>(null);

// Provider component
export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, dispatch] = useReducer(configReducer, initialState);

  // Load configuration on mount
  useEffect(() => {
    loadSummary(); // Load lightweight summary first for faster bootstrap
  }, []);

  const loadConfig = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    
    try {
      // Load networks and tokens in parallel
      const [networksResponse, tokensResponse] = await Promise.all([
        configApi.getNetworks({ active: true }),
        configApi.getTokens({ active: true }),
      ]);

      const networks = handleApiResponse<NetworksResponse>(networksResponse);
      const tokens = handleApiResponse<TokensResponse>(tokensResponse);

      // Determine default network (prefer mainnet)
      const defaultNetwork = networks.networks.find(n => !n.isTestnet)?.chainId || 137;

      dispatch({
        type: 'LOAD_SUCCESS',
        payload: {
          networks: networks.networks,
          tokens: tokens.tokens,
          defaultNetwork,
        },
      });

      console.log('Configuration loaded successfully', {
        networksCount: networks.count,
        tokensCount: tokens.count,
        defaultNetwork,
      });
    } catch (error: any) {
      console.error('Error loading configuration:', error);
      const errorMessage = error.message || 'Failed to load configuration';
      dispatch({ type: 'LOAD_ERROR', payload: errorMessage });
      
      // Show user-friendly error
      toast.error('Failed to load blockchain configuration. Some features may not work properly.');
      
      // Fallback to default configuration
      handleFallbackConfig();
    }
  }, []);

  const loadSummary = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    
    try {
      // Try loading summary first
      try {
        const summaryResponse = await configApi.getSummary();
        const summary = handleApiResponse<ConfigSummary>(summaryResponse);

        // Convert summary to full config format
        const networks: NetworkConfig[] = summary.networks.map(n => ({
          id: `network-${n.chainId}`,
          chainId: n.chainId,
          name: n.name,
          symbol: n.symbol,
          rpcUrl: '', // Will be populated by Web3 provider
          isTestnet: n.isTestnet,
          isActive: true,
          gasSettings: n.gasSettings,
          networkType: n.isTestnet ? 'testnet' : 'mainnet',
          hasEIP1559Support: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        const tokens: TokenConfig[] = summary.tokens.map(t => ({
          id: `token-${t.symbol}-${t.networkId}`,
          networkId: t.networkId,
          contractAddress: t.contractAddress,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          isNative: t.isNative,
          isStablecoin: t.isStablecoin,
          logoUrl: t.logoUrl,
          isActive: true,
          displayName: t.name,
          isERC20: !t.isNative,
          tokenType: t.isNative ? 'native' : 'erc20',
          decimalsForDisplay: t.decimals,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        dispatch({
          type: 'LOAD_SUCCESS',
          payload: {
            networks,
            tokens,
            defaultNetwork: summary.defaultNetwork,
          },
        });

        console.log('Configuration summary loaded successfully', {
          networksCount: networks.length,
          tokensCount: tokens.length,
          defaultNetwork: summary.defaultNetwork,
        });
        return;
      } catch (summaryError) {
        console.warn('Summary endpoint failed, trying individual endpoints:', summaryError);
      }

      // If summary fails, try loading networks and tokens separately
      const networksResponse = await configApi.getNetworks({ active: true });
      const networksData = handleApiResponse<NetworksResponse>(networksResponse);

      // Try to load tokens, but continue if it fails
      let tokensData: TokensResponse = { tokens: [], count: 0, stablecoins: [], nativeTokens: [], erc20Tokens: [] };
      try {
        const tokensResponse = await configApi.getTokens({ active: true });
        tokensData = handleApiResponse<TokensResponse>(tokensResponse);
      } catch (tokensError) {
        console.warn('Tokens endpoint failed, continuing with networks only:', tokensError);
      }

      // Determine default network (prefer mainnet)
      const defaultNetwork = networksData.networks.find(n => !n.isTestnet)?.chainId || 137;

      dispatch({
        type: 'LOAD_SUCCESS',
        payload: {
          networks: networksData.networks,
          tokens: tokensData.tokens,
          defaultNetwork,
        },
      });

      console.log('Configuration loaded successfully (fallback method)', {
        networksCount: networksData.count,
        tokensCount: tokensData.count,
        defaultNetwork,
      });
    } catch (error: any) {
      console.error('Error loading configuration:', error);
      const errorMessage = error.message || 'Failed to load configuration';
      dispatch({ type: 'LOAD_ERROR', payload: errorMessage });
      
      // Fallback to default configuration
      handleFallbackConfig();
    }
  }, []);

  const handleFallbackConfig = useCallback(() => {
    // Provide minimal fallback configuration
    const fallbackNetworks: NetworkConfig[] = [
      {
        id: 'polygon-mainnet',
        chainId: 137,
        name: 'Polygon',
        symbol: 'MATIC',
        rpcUrl: 'https://polygon-rpc.com',
        explorerUrl: 'https://polygonscan.com',
        isTestnet: false,
        isActive: true,
        gasSettings: { gasPrice: '30000000000', gasLimit: '21000' },
        networkType: 'mainnet',
        hasEIP1559Support: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const fallbackTokens: TokenConfig[] = [
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
        displayName: 'USD Coin',
        isERC20: true,
        tokenType: 'erc20',
        decimalsForDisplay: 6,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    dispatch({
      type: 'LOAD_SUCCESS',
      payload: {
        networks: fallbackNetworks,
        tokens: fallbackTokens,
        defaultNetwork: 137,
      },
    });

    console.warn('Using fallback configuration due to backend unavailability');
  }, []);

  const getNetworkById = useCallback((chainId: number): NetworkConfig | undefined => {
    return config.networks.find(network => network.chainId === chainId);
  }, [config.networks]);

  const getTokensByNetworkId = useCallback((networkId: string): TokenConfig[] => {
    return config.tokens.filter(token => token.networkId === networkId);
  }, [config.tokens]);

  const getTokensByChainId = useCallback((chainId: number): TokenConfig[] => {
    const network = getNetworkById(chainId);
    if (!network) return [];
    return getTokensByNetworkId(network.id);
  }, [config.tokens, getNetworkById, getTokensByNetworkId]);

  const getStablecoins = useCallback((): TokenConfig[] => {
    return config.tokens.filter(token => token.isStablecoin);
  }, [config.tokens]);

  const getNativeTokens = useCallback((): TokenConfig[] => {
    return config.tokens.filter(token => token.isNative);
  }, [config.tokens]);

  const isNetworkSupported = useCallback((chainId: number): boolean => {
    return config.supportedChainIds.includes(chainId);
  }, [config.supportedChainIds]);

  const refreshConfig = useCallback(async () => {
    await loadConfig(); // Load full configuration for refresh
  }, [loadConfig]);

  const contextValue: ConfigContextType = {
    config,
    loadConfig,
    loadSummary,
    getNetworkById,
    getTokensByNetworkId,
    getTokensByChainId,
    getStablecoins,
    getNativeTokens,
    isNetworkSupported,
    refreshConfig,
  };

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
};

// Hook to use config context
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

// Convenience hooks
export const useNetworks = () => {
  const { config } = useConfig();
  return config.networks;
};

export const useTokens = () => {
  const { config } = useConfig();
  return config.tokens;
};

export const useNetworkById = (chainId: number) => {
  const { getNetworkById } = useConfig();
  return getNetworkById(chainId);
};

export const useTokensByChainId = (chainId: number) => {
  const { getTokensByChainId } = useConfig();
  return getTokensByChainId(chainId);
};

export const useIsNetworkSupported = (chainId: number) => {
  const { isNetworkSupported } = useConfig();
  return isNetworkSupported(chainId);
};

export const useDefaultNetwork = () => {
  const { config } = useConfig();
  return config.defaultNetworkId;
};

export const useConfigLoading = () => {
  const { config } = useConfig();
  return {
    isLoading: config.isLoading,
    isLoaded: config.isLoaded,
    error: config.error,
  };
};