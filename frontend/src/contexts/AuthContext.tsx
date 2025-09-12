'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  User,
  AuthMessage,
  AuthResponse,
  UpdateUserProfileRequest,
  UserExistsResponse,
  UserContextState,
  UserContextActions,
  CompleteOnboardingRequest,
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
  isOnboarding: false,
  needsOnboarding: false,
};

// Action types
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_ONBOARDING'; payload: boolean }
  | { type: 'SET_NEEDS_ONBOARDING'; payload: boolean }
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
        isOnboarding: false, // User is authenticated, not onboarding
        needsOnboarding: false, // User is authenticated, onboarding complete
      };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    
    case 'SET_ONBOARDING':
      return { ...state, isOnboarding: action.payload };
    
    case 'SET_NEEDS_ONBOARDING':
      return { ...state, needsOnboarding: action.payload };
    
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
  const web3 = useWeb3();

  // Initialize authentication on page load
  useEffect(() => {
    initializeAuth();
  }, []);

  // Watch for wallet connection changes
  useEffect(() => {
    if (web3.wallet?.address && !state.isAuthenticated) {
      console.log('Wallet connected, user not authenticated');
    } else if (!web3.wallet && state.isAuthenticated) {
      logout();
    }
  }, [web3.wallet?.address, state.isAuthenticated]);

  const initializeAuth = async () => {
    try {
      const token = authStorage.getToken();
      const cachedUser = userStorage.getProfile();

      if (token && cachedUser) {
        try {
          // Validate token by making an API call
          await userApi.getProfile();
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
      // Try to authenticate existing user first
      console.debug('Attempting to authenticate existing user');
      const response = await authApi.verifySignature(walletAddress, signature, message);
      const { token, user, expires_at, needsOnboarding, organization }: AuthResponse = handleApiResponse(response);

      // Calculate expiration time in milliseconds
      const expiresAt = new Date(expires_at).getTime();
      const expiresInMs = expiresAt - Date.now();

      // Store authentication data with enhanced debugging
      console.debug('🔄 Storing authentication token:', {
        tokenLength: token?.length,
        expiresInMs,
        tokenPreview: token?.substring(0, 30) + '...'
      });
      
      // Store token and verify immediately
      const tokenStored = authStorage.setToken(token, expiresInMs);
      const profileStored = userStorage.setProfile(user);
      
      console.debug('✅ Token storage result:', tokenStored, 'Profile storage result:', profileStored);
      
      // Immediate verification of token storage
      const verifyToken = authStorage.getToken();
      const verifyProfile = userStorage.getProfile();
      console.debug('🔍 Immediate verification:', {
        tokenRetrieved: !!verifyToken,
        tokenMatch: verifyToken === token,
        profileRetrieved: !!verifyProfile,
        profileMatch: verifyProfile?.id === user.id,
        rawLocalStorageToken: localStorage.getItem('fluxion_auth_token') ? 'exists' : 'missing'
      });
      
      if (!verifyToken) {
        console.error('❌ CRITICAL: Token was not stored properly!');
        throw new Error('Authentication token storage failed');
      }

      // Set user state
      dispatch({ type: 'SET_USER', payload: user });

      // Handle onboarding state for existing users
      if (needsOnboarding) {
        dispatch({ type: 'SET_NEEDS_ONBOARDING', payload: true });
        console.log('Existing user needs onboarding completion, organization:', organization);
        toast.success('Welcome back! Please complete your profile setup.');
      } else {
        dispatch({ type: 'SET_NEEDS_ONBOARDING', payload: false });
        toast.success('Welcome back!');
      }
      
    } catch (error: any) {
      console.error('Authentication error:', error);
      
      // Handle NOT_FOUND error (user doesn't exist) - trigger onboarding flow
      if (error.status === 404 || error.code === 'NOT_FOUND') {
        console.debug('User not found, triggering onboarding flow');
        dispatch({ type: 'SET_ONBOARDING', payload: true });
        dispatch({ type: 'SET_NEEDS_ONBOARDING', payload: true });
        
        // Store signature data for onboarding completion
        (window as any).__onboardingData = { walletAddress, signature, message };
        
        toast.info('Welcome to Fluxion! Please complete your profile setup to get started.');
        return; // Don't throw error, let onboarding handle it
      }

      let errorMessage = 'Authentication failed';
      
      // Handle other error responses
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
    if (web3.wallet?.isConnected) {
      web3.disconnect();
    }

    toast.success('Logged out successfully');
  }, [web3.wallet?.isConnected, web3]);

  const updateProfile = async (updates: UpdateUserProfileRequest): Promise<void> => {
    if (!state.user) {
      throw new Error('User not authenticated');
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await userApi.updateProfile(updates);
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
      const response = await userApi.getProfile();
      
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

  const completeOnboarding = async (data: CompleteOnboardingRequest): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      console.debug('Completing onboarding with data:', data);
      
      // If user is already authenticated, use the update endpoint
      if (state.user && state.isAuthenticated) {
        console.debug('Updating existing user organization');
        const response = await userApi.completeOnboarding(data);
        const updatedUser: User = handleApiResponse(response);
        
        // Update storage and state with the updated user
        userStorage.setProfile(updatedUser);
        dispatch({ type: 'SET_USER', payload: updatedUser });
        
        // Mark onboarding as complete
        dispatch({ type: 'SET_NEEDS_ONBOARDING', payload: false });
        dispatch({ type: 'SET_ONBOARDING', payload: false });
        
        console.debug('Onboarding completed successfully for existing user');
        toast.success('Welcome to Fluxion! Your account is now set up.');
        return;
      }

      // For new users, get signature data stored during login attempt
      const onboardingData = (window as any).__onboardingData;
      if (!onboardingData) {
        throw new Error('Missing authentication data. Please reconnect your wallet.');
      }

      console.debug('Creating new user with organization');
      
      // Create new user with organization
      const response = await authApi.createUser(
        onboardingData.walletAddress,
        onboardingData.signature,
        onboardingData.message,
        data.organizationName,
        data.displayName,
        data.email
      );
      
      const { token, user, expires_at }: AuthResponse = handleApiResponse(response);

      // Calculate expiration time in milliseconds
      const expiresAt = new Date(expires_at).getTime();
      const expiresInMs = expiresAt - Date.now();

      // Store authentication data with enhanced debugging
      console.debug('🔄 Storing authentication token:', {
        tokenLength: token?.length,
        expiresInMs,
        tokenPreview: token?.substring(0, 30) + '...'
      });
      
      // Store token and verify immediately
      const tokenStored = authStorage.setToken(token, expiresInMs);
      const profileStored = userStorage.setProfile(user);
      
      console.debug('✅ Token storage result:', tokenStored, 'Profile storage result:', profileStored);
      
      // Immediate verification of token storage
      const verifyToken = authStorage.getToken();
      const verifyProfile = userStorage.getProfile();
      console.debug('🔍 Immediate verification:', {
        tokenRetrieved: !!verifyToken,
        tokenMatch: verifyToken === token,
        profileRetrieved: !!verifyProfile,
        profileMatch: verifyProfile?.id === user.id,
        rawLocalStorageToken: localStorage.getItem('fluxion_auth_token') ? 'exists' : 'missing'
      });
      
      if (!verifyToken) {
        console.error('❌ CRITICAL: Token was not stored properly!');
        throw new Error('Authentication token storage failed');
      }

      // Set user state
      dispatch({ type: 'SET_USER', payload: user });
      
      // Mark onboarding as complete
      dispatch({ type: 'SET_NEEDS_ONBOARDING', payload: false });
      dispatch({ type: 'SET_ONBOARDING', payload: false });
      
      // Clean up stored onboarding data
      delete (window as any).__onboardingData;
      
      console.debug('New user created and onboarding completed successfully');
      toast.success('Welcome to Fluxion! Your account has been created.');
      
    } catch (error: any) {
      console.error('Onboarding completion error:', error);
      let errorMessage = 'Failed to complete setup';
      
      // Handle enhanced error responses
      if (error.code) {
        switch (error.code) {
          case 'VALIDATION_ERROR':
            errorMessage = 'Please check your information and try again.';
            break;
          case 'UNAUTHORIZED':
            errorMessage = 'Invalid wallet signature. Please reconnect your wallet and try again.';
            break;
          case 'CONFLICT':
            if (error.message && error.message.includes('User already exists')) {
              errorMessage = 'Account already exists. Please use the login flow instead.';
              // Clear onboarding state and let user try login again
              dispatch({ type: 'SET_NEEDS_ONBOARDING', payload: false });
              dispatch({ type: 'SET_ONBOARDING', payload: false });
              delete (window as any).__onboardingData;
            } else {
              errorMessage = 'Organization name already exists. Please choose another.';
            }
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      } else if (error.status === 401) {
        errorMessage = 'Invalid wallet signature. Please reconnect your wallet and try again.';
      } else if (error.validation_errors) {
        // Handle validation errors from backend
        const firstError = Object.values(error.validation_errors)[0];
        errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
      } else {
        errorMessage = error.message || errorMessage;
      }

      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  const authenticateWithWallet = async (): Promise<void> => {
    if (!web3.wallet?.address) {
      throw new Error('Wallet not connected');
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      console.debug('Starting wallet authentication for:', web3.wallet.address);
      
      // Step 1: Get authentication message from backend
      const messageResponse = await authApi.getMessage(web3.wallet.address);
      const authMessage: AuthMessage = handleApiResponse(messageResponse);
      console.debug('Received auth message from backend');

      // Step 2: Sign the message with wallet
      const signature = await web3.signMessage(authMessage.message);
      console.debug('Message signed by wallet');

      // Step 3: Authenticate with signature
      await login(web3.wallet.address, signature, authMessage.message);
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
    completeOnboarding,
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
  const web3 = useWeb3();
  const { state: authState, actions: authActions } = useAuth();

  const connectAndAuthenticate = async (): Promise<void> => {
    try {
      console.debug('🔄 Auth: Starting chain-agnostic wallet connection...');
      
      // Use the new chain-agnostic wallet connection
      const { connectAndAuth } = await import('@/utils/walletConnection');
      
      const authResult = await connectAndAuth('http://localhost:3000');
      
      console.debug(`✅ Auth: Connected on chain ${authResult.chainId} with address ${authResult.address}`);
      
      // Authenticate with backend
      await authActions.login(authResult.address, authResult.signature, authResult.message);
      
      console.debug('✅ Auth: Authentication completed successfully');

    } catch (error: any) {
      console.error('❌ Auth: Connect and authenticate error:', error);
      
      // Handle specific error codes
      if (error.code === 4001) {
        console.debug('💡 Auth: User rejected the connection request');
        const userError = new Error('Connection cancelled by user');
        (userError as any).code = 'USER_REJECTED';
        throw userError;
      } else if (error.code === -32002) {
        console.debug('💡 Auth: Request already pending');
        const pendingError = new Error('Connection request already pending. Please check your wallet extension.');
        (pendingError as any).code = 'REQUEST_PENDING';
        throw pendingError;
      }
      
      throw error;
    }
  };

  const disconnectAndLogout = () => {
    authActions.logout();
  };

  return {
    isWalletConnected: !!web3.wallet?.isConnected,
    isAuthenticated: authState.isAuthenticated,
    isConnecting: web3.isConnecting,
    isAuthenticating: authState.isLoading,
    user: authState.user,
    wallet: web3.wallet,
    error: authState.error || web3.error,
    connectAndAuthenticate,
    disconnectAndLogout,
  };
};