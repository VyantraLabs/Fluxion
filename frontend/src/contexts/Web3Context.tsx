'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  Web3State,
  Web3Actions,
  WalletInfo,
  WalletProvider,
  WalletErrorInfo,
  WalletError,
  WalletAddress,
  TransactionRequest,
  TransactionHash,
  TokenBalance,
} from '@/types/web3';
import {
  isMetaMaskInstalled,
  requestWalletConnection,
  getCurrentChainId,
  switchNetwork,
  signMessage,
  sendUSDCTransfer,
  getWalletBalance,
  getUSDCBalance,
  createBrowserProvider,
} from '@/utils/web3';
import { config } from '@/utils/config';
import { walletStorage } from '@/utils/storage';
import { useConfig, useDefaultNetwork } from './ConfigContext';
import toast from 'react-hot-toast';

// Initial state
const initialState: Web3State = {
  wallet: null,
  isConnecting: false,
  error: null,
  chainId: null,
  provider: null,
  signer: null,
};

// Action types
type Web3Action =
  | { type: 'SET_CONNECTING'; payload: boolean }
  | { type: 'SET_WALLET'; payload: WalletInfo }
  | { type: 'SET_ERROR'; payload: WalletErrorInfo | null }
  | { type: 'SET_CHAIN_ID'; payload: number }
  | { type: 'SET_PROVIDER'; payload: ethers.BrowserProvider | null }
  | { type: 'SET_SIGNER'; payload: ethers.JsonRpcSigner | null }
  | { type: 'RESET' };

// Reducer
const web3Reducer = (state: Web3State, action: Web3Action): Web3State => {
  switch (action.type) {
    case 'SET_CONNECTING':
      return { ...state, isConnecting: action.payload, error: null };
    
    case 'SET_WALLET':
      return { ...state, wallet: action.payload, isConnecting: false, error: null };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isConnecting: false };
    
    case 'SET_CHAIN_ID':
      return { ...state, chainId: action.payload };
    
    case 'SET_PROVIDER':
      return { ...state, provider: action.payload };
    
    case 'SET_SIGNER':
      return { ...state, signer: action.payload };
    
    case 'RESET':
      return initialState;
    
    default:
      return state;
  }
};

// Context
const Web3Context = createContext<{
  state: Web3State;
  actions: Web3Actions;
} | null>(null);

// Provider component
export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(web3Reducer, initialState);
  const { config: dynamicConfig, isNetworkSupported } = useConfig();
  const defaultNetwork = useDefaultNetwork();

  // Initialize wallet connection on page load
  useEffect(() => {
    initializeWallet();
  }, []);

  // Listen for wallet events
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChangedWithCleanup = (accounts: string[]) => {
        try {
          handleAccountsChanged(accounts);
        } catch (error) {
          console.error('Error handling accounts changed:', error);
        }
      };

      const handleChainChangedWithCleanup = (chainId: string) => {
        try {
          handleChainChanged(chainId);
        } catch (error) {
          console.error('Error handling chain changed:', error);
        }
      };

      const handleDisconnectWithCleanup = () => {
        try {
          handleDisconnect();
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChangedWithCleanup);
      window.ethereum.on('chainChanged', handleChainChangedWithCleanup);
      window.ethereum.on('disconnect', handleDisconnectWithCleanup);

      return () => {
        try {
          window.ethereum?.removeListener('accountsChanged', handleAccountsChangedWithCleanup);
          window.ethereum?.removeListener('chainChanged', handleChainChangedWithCleanup);
          window.ethereum?.removeListener('disconnect', handleDisconnectWithCleanup);
        } catch (error) {
          console.warn('Error removing event listeners:', error);
        }
      };
    }
  }, []);

  const initializeWallet = async () => {
    try {
      if (!isMetaMaskInstalled()) {
        console.debug('MetaMask not installed, skipping wallet initialization');
        return;
      }

      const provider = createBrowserProvider();
      if (!provider) {
        console.debug('No browser provider available, skipping wallet initialization');
        return;
      }

      dispatch({ type: 'SET_PROVIDER', payload: provider });

      // Check if already connected
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        const signer = await provider.getSigner();
        const address = await signer.getAddress() as WalletAddress;
        const chainId = await getCurrentChainId();

        dispatch({ type: 'SET_SIGNER', payload: signer });
        dispatch({ type: 'SET_CHAIN_ID', payload: chainId });

        const wallet: WalletInfo = {
          address,
          chainId,
          provider: 'metamask',
          isConnected: true,
        };

        dispatch({ type: 'SET_WALLET', payload: wallet });
        walletStorage.setAddress(address);
        walletStorage.setPreferredNetwork(chainId);

        // Get balance with better error handling
        try {
          const balance = await getWalletBalance(address, chainId);
          wallet.balance = balance;
          dispatch({ type: 'SET_WALLET', payload: wallet });
        } catch (balanceError) {
          console.warn('Could not fetch wallet balance during initialization:', balanceError);
          // Continue without balance - it's not critical for functionality
        }
      } else {
        console.debug('No connected accounts found during initialization');
      }
    } catch (error: any) {
      console.error('Error initializing wallet:', error);
      // Don't dispatch error for initialization failures as they're often expected
      // (user hasn't connected yet, etc.)
    }
  };

  const connect = async (provider: WalletProvider = 'metamask'): Promise<void> => {
    if (provider !== 'metamask') {
      throw new WalletErrorInfo({
        code: WalletError.UNSUPPORTED_METHOD,
        message: 'Only MetaMask is supported in this version',
      });
    }

    if (!isMetaMaskInstalled()) {
      throw new WalletErrorInfo({
        code: WalletError.UNKNOWN_ERROR,
        message: 'MetaMask is not installed. Please install MetaMask to continue.',
      });
    }

    dispatch({ type: 'SET_CONNECTING', payload: true });

    try {
      const accounts = await requestWalletConnection();
      
      if (accounts.length === 0) {
        throw new WalletErrorInfo({
          code: WalletError.UNAUTHORIZED,
          message: 'No accounts found',
        });
      }

      const browserProvider = createBrowserProvider();
      if (!browserProvider) {
        throw new WalletErrorInfo({
          code: WalletError.UNKNOWN_ERROR,
          message: 'Could not create wallet provider',
        });
      }

      dispatch({ type: 'SET_PROVIDER', payload: browserProvider });

      const signer = await browserProvider.getSigner();
      const address = await signer.getAddress() as WalletAddress;
      const chainId = await getCurrentChainId();

      dispatch({ type: 'SET_SIGNER', payload: signer });
      dispatch({ type: 'SET_CHAIN_ID', payload: chainId });

      const wallet: WalletInfo = {
        address,
        chainId,
        provider: 'metamask',
        isConnected: true,
      };

      // Check if on correct network using dynamic config
      const correctNetworkId = dynamicConfig?.isLoaded ? defaultNetwork : config.blockchain.defaultChainId;
      const networkSupported = dynamicConfig?.isLoaded ? isNetworkSupported(chainId) : chainId === config.blockchain.defaultChainId;

      if (!networkSupported) {
        const networkName = dynamicConfig?.networks?.find(n => n.chainId === correctNetworkId)?.name || `Chain ID ${correctNetworkId}`;
        toast.error(`Please switch to ${networkName}`);
        try {
          await switchNetwork(correctNetworkId);
        } catch (switchError) {
          console.warn('Could not switch network automatically:', switchError);
          // Don't throw error for automatic network switching failures
        }
      }

      dispatch({ type: 'SET_WALLET', payload: wallet });
      walletStorage.setAddress(address);
      walletStorage.setPreferredNetwork(chainId);

      // Get balance
      try {
        const balance = await getWalletBalance(address, chainId);
        wallet.balance = balance;
        dispatch({ type: 'SET_WALLET', payload: wallet });
      } catch (error) {
        console.warn('Could not fetch wallet balance:', error);
      }

      toast.success('Wallet connected successfully!');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      dispatch({ type: 'SET_ERROR', payload: error as WalletErrorInfo });
      throw error;
    }
  };

  const disconnect = useCallback(() => {
    dispatch({ type: 'RESET' });
    walletStorage.removeAddress();
    toast.success('Wallet disconnected');
  }, []);

  const switchNetworkHandler = async (chainId: number): Promise<void> => {
    try {
      await switchNetwork(chainId);
      dispatch({ type: 'SET_CHAIN_ID', payload: chainId });
      walletStorage.setPreferredNetwork(chainId);
      
      // Update wallet info with new chain
      if (state.wallet) {
        const updatedWallet = { ...state.wallet, chainId };
        dispatch({ type: 'SET_WALLET', payload: updatedWallet });
      }

      toast.success('Network switched successfully');
    } catch (error) {
      console.error('Error switching network:', error);
      throw error;
    }
  };

  const signMessageHandler = async (message: string): Promise<string> => {
    if (!state.wallet || !state.signer) {
      throw new WalletErrorInfo({
        code: WalletError.DISCONNECTED,
        message: 'Wallet not connected',
      });
    }

    try {
      return await signMessage(message, state.wallet.address);
    } catch (error) {
      console.error('Error signing message:', error);
      throw error;
    }
  };

  const sendTransaction = async (transaction: TransactionRequest): Promise<TransactionHash> => {
    if (!state.signer) {
      throw new WalletErrorInfo({
        code: WalletError.DISCONNECTED,
        message: 'Wallet not connected',
      });
    }

    try {
      const tx = await state.signer.sendTransaction(transaction);
      return tx.hash as TransactionHash;
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  };

  const getBalance = async (address?: WalletAddress): Promise<string> => {
    const targetAddress = address || state.wallet?.address;
    if (!targetAddress) {
      throw new Error('No wallet address provided');
    }

    return await getWalletBalance(targetAddress, state.chainId || undefined);
  };

  const getTokenBalance = async (
    tokenAddress: string, 
    address?: WalletAddress
  ): Promise<TokenBalance> => {
    const targetAddress = address || state.wallet?.address;
    if (!targetAddress) {
      throw new Error('No wallet address provided');
    }

    return await getUSDCBalance(targetAddress, state.chainId || undefined);
  };

  const handleAccountsChanged = useCallback((accounts: string[]) => {
    console.log('Accounts changed:', accounts);
    
    if (accounts.length === 0) {
      disconnect();
    } else if (accounts[0] !== state.wallet?.address) {
      // Account changed, reinitialize
      initializeWallet();
    }
  }, [state.wallet?.address, disconnect]);

  const handleChainChanged = useCallback((chainId: string) => {
    const newChainId = parseInt(chainId, 16);
    console.log('Chain changed:', newChainId);
    
    dispatch({ type: 'SET_CHAIN_ID', payload: newChainId });
    walletStorage.setPreferredNetwork(newChainId);
    
    if (state.wallet) {
      const updatedWallet = { ...state.wallet, chainId: newChainId };
      dispatch({ type: 'SET_WALLET', payload: updatedWallet });
    }
  }, [state.wallet]);

  const handleDisconnect = useCallback(() => {
    console.log('Wallet disconnected');
    disconnect();
  }, [disconnect]);

  const actions: Web3Actions = {
    connect,
    disconnect,
    switchNetwork: switchNetworkHandler,
    signMessage: signMessageHandler,
    sendTransaction,
    getBalance,
    getTokenBalance,
  };

  return (
    <Web3Context.Provider value={{ state, actions }}>
      {children}
    </Web3Context.Provider>
  );
};

// Hook to use Web3 context
export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

// Utility hooks
export const useWallet = () => {
  const { state } = useWeb3();
  return state.wallet;
};

export const useIsConnected = () => {
  const { state } = useWeb3();
  return !!state.wallet?.isConnected;
};

export const useChainId = () => {
  const { state } = useWeb3();
  return state.chainId;
};

export const useProvider = () => {
  const { state } = useWeb3();
  return state.provider;
};

export const useSigner = () => {
  const { state } = useWeb3();
  return state.signer;
};