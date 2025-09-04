'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import {
  User,
  AuthMessage,
  AuthResponse,
  UpdateUserProfileRequest,
  UserExistsResponse,
  UserContextState,
  UserContextActions,
} from '@/types/user';
import { WalletAddress } from '@/types/web3';
import { authApi, userApi, handleApiResponse, handleApiError } from '@/utils/api';
import { authStorage, userStorage } from '@/utils/storage';
import { useWeb3 } from './Web3Context';
import toast from 'react-hot-toast';

// Initial state
const initialState: UserContextState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Action types
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'LOGOUT' };

// Reducer
const authReducer = (state: UserContextState, action: AuthAction): UserContextState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    
    case 'LOGOUT':
      return {
        ...initialState,
        isAuthenticated: false,
      };
    
    default:
      return state;
  }
};

// Context
const AuthContext = createContext<{
  state: UserContextState;
  actions: UserContextActions;
} | null>(null);

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { state: web3State, actions: web3Actions } = useWeb3();

  // Initialize authentication on page load
  useEffect(() => {
    initializeAuth();
  }, []);

  // Watch for wallet connection changes
  useEffect(() => {
    if (web3State.wallet?.address && !state.isAuthenticated) {
      // Wallet connected but not authenticated
      // This could trigger automatic authentication or prompt user
      console.log('Wallet connected, user not authenticated');
    } else if (!web3State.wallet && state.isAuthenticated) {
      // Wallet disconnected but user is authenticated
      logout();
    }
  }, [web3State.wallet?.address, state.isAuthenticated]);

  const initializeAuth = async () => {
    try {
      const token = authStorage.getToken();
      const cachedUser = userStorage.getProfile();

      if (token && cachedUser) {
        try {
          // Validate token by making an API call
          await userApi.getProfile(cachedUser.wallet_address);
          dispatch({ type: 'SET_USER', payload: cachedUser });
          console.debug('Authentication initialized with cached user:', cachedUser.wallet_address);
        } catch (error) {
          // Token is invalid, clear storage
          console.debug('Cached token invalid, clearing storage');
          authStorage.removeToken();
          userStorage.removeProfile();
        }
      } else {
        console.debug('No cached authentication found');
      }
    } catch (error) {
      console.error('Error initializing authentication:', error);
      // Clear any corrupted storage
      authStorage.removeToken();
      userStorage.removeProfile();
    }
  };

  const login = async (
    walletAddress: WalletAddress,
    signature: string,
    message: string
  ): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Verify signature with backend
      const response = await authApi.verifySignature(walletAddress, signature, message);
      const { token, user, expires_at }: AuthResponse = handleApiResponse(response);

      // Calculate expiration time in milliseconds
      const expiresAt = new Date(expires_at).getTime();
      const expiresInMs = expiresAt - Date.now();

      // Store authentication data
      authStorage.setToken(token, expiresInMs);
      userStorage.setProfile(user);

      dispatch({ type: 'SET_USER', payload: user });
      toast.success('Successfully authenticated!');
    } catch (error: any) {
      console.error('Authentication error:', error);
      let errorMessage = 'Authentication failed';
      
      // Handle enhanced error responses
      if (error.code) {
        switch (error.code) {
          case 'VALIDATION_ERROR':
            errorMessage = 'Invalid wallet signature. Please try again.';
            break;
          case 'UNAUTHORIZED':
            errorMessage = 'Authentication failed. Please check your wallet signature.';
            break;
          case 'RATE_LIMIT_EXCEEDED':
            errorMessage = 'Too many authentication attempts. Please try again later.';
            break;
          case 'NETWORK_ERROR':
            errorMessage = 'Network connection error. Please check your connection and try again.';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      } else if (error.status === 401) {
        errorMessage = 'Authentication failed. Please try connecting your wallet again.';
      } else if (error.status === 0) {
        errorMessage = 'Unable to connect to authentication service. Please try again.';
      } else {
        errorMessage = error.message || errorMessage;
      }

      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      toast.error(errorMessage);
      
      // Re-throw with standardized error structure
      const authError = new Error(errorMessage);
      (authError as any).code = error.code || 'AUTH_FAILED';
      (authError as any).status = error.status;
      throw authError;
    }
  };

  const logout = useCallback(() => {
    // Clear storage
    authStorage.removeToken();
    userStorage.removeProfile();
    
    // Reset state
    dispatch({ type: 'LOGOUT' });
    
    // Disconnect wallet if connected
    if (web3State.wallet?.isConnected) {
      web3Actions.disconnect();
    }

    toast.success('Logged out successfully');
  }, [web3State.wallet?.isConnected, web3Actions]);

  const updateProfile = async (updates: UpdateUserProfileRequest): Promise<void> => {
    if (!state.user) {
      throw new Error('User not authenticated');
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await userApi.updateProfile(state.user.wallet_address, updates);
      const updatedUser: User = handleApiResponse(response);
      
      // Update storage and state
      userStorage.setProfile(updatedUser);
      dispatch({ type: 'SET_USER', payload: updatedUser });
      
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      console.error('Profile update error:', error);
      const errorMessage = error.message || 'Failed to update profile';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  const refreshUser = async (): Promise<void> => {
    if (!state.user) return;

    try {
      const response = await userApi.getProfile(state.user.wallet_address);
      
      if (response.success && response.data) {
        const refreshedUser: User = response.data;
        userStorage.setProfile(refreshedUser);
        dispatch({ type: 'SET_USER', payload: refreshedUser });
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const checkUserExists = async (walletAddress: WalletAddress): Promise<UserExistsResponse> => {
    try {
      const response = await userApi.exists(walletAddress);
      return handleApiResponse(response);
    } catch (error: any) {
      console.error('Error checking user existence:', error);
      throw error;
    }
  };

  const authenticateWithWallet = async (): Promise<void> => {
    if (!web3State.wallet?.address) {
      throw new Error('Wallet not connected');
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      console.debug('Starting wallet authentication for:', web3State.wallet.address);
      
      // Step 1: Get authentication message from backend
      const messageResponse = await authApi.getMessage(web3State.wallet.address);
      const authMessage: AuthMessage = handleApiResponse(messageResponse);
      console.debug('Received auth message from backend');

      // Step 2: Sign the message with wallet
      const signature = await web3Actions.signMessage(authMessage.message);
      console.debug('Message signed by wallet');

      // Step 3: Authenticate with signature
      await login(web3State.wallet.address, signature, authMessage.message);
      console.debug('Authentication completed successfully');

    } catch (error: any) {
      console.error('Wallet authentication failed:', error);
      const errorMessage = error.message || 'Authentication failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  };

  const actions: UserContextActions = {
    login,
    logout,
    updateProfile,
    refreshUser,
    checkUserExists,
  };

  return (
    <AuthContext.Provider value={{ state, actions }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use Auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Utility hooks
export const useUser = () => {
  const { state } = useAuth();
  return state.user;
};

export const useIsAuthenticated = () => {
  const { state } = useAuth();
  return state.isAuthenticated;
};

export const useAuthLoading = () => {
  const { state } = useAuth();
  return state.isLoading;
};

// Combined authentication hook
export const useWalletAuth = () => {
  const { state: web3State, actions: web3Actions } = useWeb3();
  const { state: authState, actions: authActions } = useAuth();

  const connectAndAuthenticate = async (): Promise<void> => {
    try {
      console.debug('Starting connect and authenticate flow');
      
      // Step 1: Connect wallet
      if (!web3State.wallet?.isConnected) {
        console.debug('Connecting wallet...');
        await web3Actions.connect();
      }

      // Wait a moment for wallet state to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 2: Authenticate with backend
      if (!authState.isAuthenticated) {
        // Make sure we have the wallet address after connection
        const walletAddress = web3State.wallet?.address;
        if (!walletAddress) {
          throw new Error('Wallet connected but address not available');
        }

        console.debug('Authenticating with backend...');
        
        // Get authentication message
        const messageResponse = await authApi.getMessage(walletAddress);
        const authMessage: AuthMessage = handleApiResponse(messageResponse);

        // Sign message
        const signature = await web3Actions.signMessage(authMessage.message);

        // Authenticate
        await authActions.login(walletAddress, signature, authMessage.message);
      } else {
        console.debug('Already authenticated, skipping auth flow');
      }
    } catch (error: any) {
      console.error('Connect and authenticate error:', error);
      throw error;
    }
  };

  const disconnectAndLogout = () => {
    authActions.logout();
    // Wallet will be disconnected automatically by the auth context
  };

  return {
    isWalletConnected: !!web3State.wallet?.isConnected,
    isAuthenticated: authState.isAuthenticated,
    isConnecting: web3State.isConnecting,
    isAuthenticating: authState.isLoading,
    user: authState.user,
    wallet: web3State.wallet,
    error: authState.error || web3State.error,
    connectAndAuthenticate,
    disconnectAndLogout,
  };
};