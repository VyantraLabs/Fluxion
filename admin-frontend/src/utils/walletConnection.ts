/**
 * Chain-agnostic wallet connection utility for Admin Frontend
 * Uses ethers.js for reliable wallet connection on any EVM chain
 */

import { ethers } from 'ethers';

export interface WalletConnection {
  address: string;
  chainId: number;
  chainName: string;
  provider: ethers.BrowserProvider;
  signer: ethers.JsonRpcSigner;
}

export interface SignatureResult {
  signature: string;
  message: string;
  address: string;
  chainId: number;
}

/**
 * Check if MetaMask or compatible wallet is available
 */
export function isWalletAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

/**
 * Get chain information from chain ID
 */
export function getChainInfo(chainId: number): { name: string; symbol: string } {
  const chains: Record<number, { name: string; symbol: string }> = {
    1: { name: 'Ethereum Mainnet', symbol: 'ETH' },
    137: { name: 'Polygon', symbol: 'MATIC' },
    80001: { name: 'Mumbai Testnet', symbol: 'MATIC' },
    56: { name: 'BNB Smart Chain', symbol: 'BNB' },
    43114: { name: 'Avalanche', symbol: 'AVAX' },
    42161: { name: 'Arbitrum One', symbol: 'ETH' },
    10: { name: 'Optimism', symbol: 'ETH' },
    8453: { name: 'Base', symbol: 'ETH' },
    250: { name: 'Fantom', symbol: 'FTM' },
    25: { name: 'Cronos', symbol: 'CRO' },
    1285: { name: 'Moonriver', symbol: 'MOVR' },
    1284: { name: 'Moonbeam', symbol: 'GLMR' },
    1337: { name: 'Localhost', symbol: 'ETH' },
  };
  
  return chains[chainId] || { name: `Chain ${chainId}`, symbol: 'ETH' };
}

/**
 * Connect to user's wallet and allow account selection if multiple accounts available
 * If targetAddress is provided, will attempt to switch to that account
 */
export async function connectWallet(targetAddress?: string): Promise<WalletConnection> {
  if (!isWalletAvailable()) {
    throw new Error('Wallet not available. Please install MetaMask or another compatible wallet.');
  }

  try {
    console.log('🔄 Admin: Requesting wallet connection via ethers...');
    
    // Create ethers provider
    const provider = new ethers.BrowserProvider(window.ethereum);
    
    // Request account access - this will open the wallet popup and allow user to select account
    await provider.send('eth_requestAccounts', []);
    
    // Get all available accounts
    const accounts = await provider.listAccounts();
    console.log('🔍 Admin: Available accounts:', accounts.map(acc => acc.address));
    
    let selectedSigner: ethers.JsonRpcSigner;
    let selectedAddress: string;
    
    if (targetAddress) {
      // User wants to connect with a specific address
      const targetAccount = accounts.find(acc => 
        acc.address.toLowerCase() === targetAddress.toLowerCase()
      );
      
      if (targetAccount) {
        // Target address is available in wallet
        selectedSigner = await provider.getSigner(targetAccount.address);
        selectedAddress = targetAccount.address;
        console.log(`✅ Admin: Using target address: ${selectedAddress}`);
      } else {
        // Target address not found in wallet
        const availableAddresses = accounts.map(acc => acc.address).join(', ');
        throw new Error(`Target address ${targetAddress} not found in wallet. Available addresses: ${availableAddresses}`);
      }
    } else {
      // No target address specified, use the currently selected account
      selectedSigner = await provider.getSigner();
      selectedAddress = await selectedSigner.getAddress();
      console.log(`✅ Admin: Using currently selected address: ${selectedAddress}`);
    }
    
    // Get network info (current chain)
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const chainInfo = getChainInfo(chainId);
    
    console.log(`✅ Admin: Wallet connected on ${chainInfo.name} (Chain ID: ${chainId})`);
    
    return {
      address: selectedAddress,
      chainId,
      chainName: chainInfo.name,
      provider,
      signer: selectedSigner
    };

  } catch (error: any) {
    console.error('❌ Admin: Wallet connection failed:', error);
    
    // Handle specific error codes
    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('Connection cancelled by user');
    } else if (error.code === -32002) {
      throw new Error('Connection request already pending. Please check your wallet.');
    } else {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }
}

/**
 * Get all available accounts in the connected wallet
 */
export async function getAvailableAccounts(): Promise<string[]> {
  if (!isWalletAvailable()) {
    return [];
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.listAccounts();
    return accounts.map(acc => acc.address);
  } catch (error) {
    console.warn('Failed to get available accounts:', error);
    return [];
  }
}

/**
 * Sign a message using ethers.js
 */
export async function signMessage(message: string, signer: ethers.JsonRpcSigner): Promise<string> {
  try {
    console.log('🔄 Admin: Signing message with ethers...');
    const signature = await signer.signMessage(message);
    console.log('✅ Admin: Message signed successfully');
    return signature;
  } catch (error: any) {
    console.error('❌ Admin: Message signing failed:', error);
    
    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('Signing cancelled by user');
    } else {
      throw new Error(`Signing failed: ${error.message}`);
    }
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}