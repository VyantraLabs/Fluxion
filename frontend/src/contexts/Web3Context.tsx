'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  WalletInfo,
  WalletProvider,
  WalletErrorInfo,
  WalletError,
  WalletAddress,
} from '@/types/web3';
import {
  isMetaMaskInstalled,
  requestWalletConnection,
  getCurrentChainId,
  switchNetwork,
  signMessage,
  getWalletBalance,
  createBrowserProvider,
} from '@/utils/web3';
import { walletStorage } from '@/utils/storage';
import toast from 'react-hot-toast';

interface Web3ContextType {
  wallet: WalletInfo | null;
  isConnecting: boolean;
  error: WalletErrorInfo | null;
  chainId: number | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  connect: (provider?: WalletProvider) => Promise<WalletInfo>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  signMessage: (message: string) => Promise<string>;
}

const Web3Context = createContext<Web3ContextType | null>(null);

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<WalletErrorInfo | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

  // Initialize wallet connection on page load
  useEffect(() => {
    initializeWallet();
  }, []);

  // Listen for wallet events
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('Accounts changed:', accounts);
        if (accounts.length === 0) {
          disconnect();
        } else if (accounts[0] !== wallet?.address) {
          initializeWallet();
        }
      };

      const handleChainChanged = (newChainId: string) => {
        const chainIdNum = parseInt(newChainId, 16);
        console.log('Chain changed:', chainIdNum);
        setChainId(chainIdNum);
        if (wallet) {
          setWallet({ ...wallet, chainId: chainIdNum });
        }
      };

      const handleDisconnect = () => {
        console.log('Wallet disconnected');
        disconnect();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('disconnect', handleDisconnect);

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
        window.ethereum?.removeListener('disconnect', handleDisconnect);
      };
    }
  }, [wallet]);

  const initializeWallet = async () => {
    try {
      if (!isMetaMaskInstalled()) {
        console.debug('MetaMask not installed');
        return;
      }

      const browserProvider = createBrowserProvider();
      if (!browserProvider) {
        console.debug('No browser provider available');
        return;
      }

      setProvider(browserProvider);

      // Check if already connected
      const accounts = await browserProvider.listAccounts();
      if (accounts.length > 0) {
        const walletSigner = await browserProvider.getSigner();
        const address = await walletSigner.getAddress() as WalletAddress;
        const walletChainId = await getCurrentChainId();

        setSigner(walletSigner);
        setChainId(walletChainId);

        const walletInfo: WalletInfo = {
          address,
          chainId: walletChainId,
          provider: 'metamask',
          isConnected: true,
        };

        setWallet(walletInfo);
        walletStorage.setAddress(address);
        walletStorage.setPreferredNetwork(walletChainId);

        // Get balance
        try {
          const balance = await getWalletBalance(address, walletChainId);
          walletInfo.balance = balance;
          setWallet(walletInfo);
        } catch (balanceError) {
          console.warn('Could not fetch wallet balance:', balanceError);
        }
      }
    } catch (error: any) {
      console.error('Error initializing wallet:', error);
    }
  };

  const connect = async (walletProvider: WalletProvider = 'metamask'): Promise<WalletInfo> => {
    if (walletProvider !== 'metamask') {
      throw new WalletErrorInfo({
        code: WalletError.UNSUPPORTED_METHOD,
        message: 'Only MetaMask is supported in this version',
      });
    }

    if (typeof window.ethereum === 'undefined') {
      throw new WalletErrorInfo({
        code: WalletError.UNKNOWN_ERROR,
        message: 'MetaMask is not installed. Please install MetaMask to continue.',
      });
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log('🔄 Web3: Requesting account access...');
      
      // Check if already connected first
      let accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (!accounts || accounts.length === 0) {
        // Request account access if not connected
        console.log('🔄 Web3: Not connected, requesting access...');
        
        // Add a small delay to ensure MetaMask is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      }
      
      if (!accounts || accounts.length === 0) {
        throw new WalletErrorInfo({
          code: WalletError.UNKNOWN_ERROR,
          message: 'No accounts found',
        });
      }

      console.log('🔄 Web3: Creating provider...');
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(browserProvider);

      const walletSigner = await browserProvider.getSigner();
      const address = await walletSigner.getAddress() as WalletAddress;
      const network = await browserProvider.getNetwork();
      const walletChainId = Number(network.chainId);

      console.log('✅ Web3: Wallet connected:', { address, chainId: walletChainId });

      setSigner(walletSigner);
      setChainId(walletChainId);

      const walletInfo: WalletInfo = {
        address,
        chainId: walletChainId,
        provider: 'metamask',
        isConnected: true,
      };

      setWallet(walletInfo);
      walletStorage.setAddress(address);
      walletStorage.setPreferredNetwork(walletChainId);

      // Get balance (non-blocking)
      try {
        const balance = await getWalletBalance(address, walletChainId);
        walletInfo.balance = balance;
        setWallet({ ...walletInfo });
      } catch (error) {
        console.warn('Could not fetch wallet balance:', error);
      }

      setIsConnecting(false);
      toast.success('Wallet connected successfully!');
      
      return walletInfo;
    } catch (error: any) {
      console.error('❌ Web3: Error connecting wallet:', error);
      setError(error as WalletErrorInfo);
      setIsConnecting(false);
      
      // Handle user rejection specifically
      if (error.code === 4001 || error.message?.includes('User rejected')) {
        const userRejectedError = new WalletErrorInfo({
          code: WalletError.USER_REJECTED_REQUEST,
          message: 'Connection cancelled by user',
        });
        throw userRejectedError;
      }
      
      throw error;
    }
  };

  const disconnect = useCallback(() => {
    setWallet(null);
    setIsConnecting(false);
    setError(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
    walletStorage.removeAddress();
    toast.success('Wallet disconnected');
  }, []);

  const switchNetworkHandler = async (newChainId: number): Promise<void> => {
    try {
      await switchNetwork(newChainId);
      setChainId(newChainId);
      walletStorage.setPreferredNetwork(newChainId);
      
      if (wallet) {
        setWallet({ ...wallet, chainId: newChainId });
      }

      toast.success('Network switched successfully');
    } catch (error) {
      console.error('Error switching network:', error);
      throw error;
    }
  };

  const signMessageHandler = async (message: string): Promise<string> => {
    if (!wallet || !signer) {
      throw new WalletErrorInfo({
        code: WalletError.DISCONNECTED,
        message: 'Wallet not connected',
      });
    }

    try {
      return await signMessage(message, wallet.address);
    } catch (error) {
      console.error('Error signing message:', error);
      throw error;
    }
  };

  const value: Web3ContextType = {
    wallet,
    isConnecting,
    error,
    chainId,
    provider,
    signer,
    connect,
    disconnect,
    switchNetwork: switchNetworkHandler,
    signMessage: signMessageHandler,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

// Utility hooks
export const useWallet = () => {
  const { wallet } = useWeb3();
  return wallet;
};

export const useIsConnected = () => {
  const { wallet } = useWeb3();
  return !!wallet?.isConnected;
};

export const useChainId = () => {
  const { chainId } = useWeb3();
  return chainId;
};

export const useProvider = () => {
  const { provider } = useWeb3();
  return provider;
};

export const useSigner = () => {
  const { signer } = useWeb3();
  return signer;
};

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}