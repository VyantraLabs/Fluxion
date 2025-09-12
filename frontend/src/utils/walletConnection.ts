/**
 * Chain-agnostic wallet connection utility
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
 * Connect to user's wallet on ANY chain they have selected using ethers.js
 * Does not enforce any specific chain - respects user choice
 */
export async function connectWallet(): Promise<WalletConnection> {
  if (!isWalletAvailable()) {
    throw new Error('Wallet not available. Please install MetaMask or another compatible wallet.');
  }

  try {
    console.log('🔄 Requesting wallet connection via ethers...');
    
    // Create ethers provider
    const provider = new ethers.BrowserProvider(window.ethereum);
    
    // Request account access - this will open the wallet popup
    await provider.send('eth_requestAccounts', []);
    
    // Get signer and address
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    // Get network info (current chain)
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const chainInfo = getChainInfo(chainId);
    
    console.log(`✅ Wallet connected on ${chainInfo.name} (Chain ID: ${chainId})`);
    console.log(`✅ Address: ${address}`);
    
    return {
      address,
      chainId,
      chainName: chainInfo.name,
      provider,
      signer
    };

  } catch (error: any) {
    console.error('❌ Wallet connection failed:', error);
    
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
 * Sign a message using ethers.js
 */
export async function signMessage(message: string, signer: ethers.JsonRpcSigner): Promise<string> {
  try {
    console.log('🔄 Signing message with ethers...');
    const signature = await signer.signMessage(message);
    console.log('✅ Message signed successfully');
    return signature;
  } catch (error: any) {
    console.error('❌ Message signing failed:', error);
    
    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('Signing cancelled by user');
    } else {
      throw new Error(`Signing failed: ${error.message}`);
    }
  }
}

/**
 * Get current wallet connection status using ethers.js
 */
export async function getWalletStatus(): Promise<WalletConnection | null> {
  if (!isWalletAvailable()) {
    return null;
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    
    // Check if already connected (without triggering popup)
    const accounts = await provider.listAccounts();
    if (accounts.length === 0) {
      return null;
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const chainInfo = getChainInfo(chainId);
    
    return {
      address,
      chainId,
      chainName: chainInfo.name,
      provider,
      signer
    };

  } catch (error) {
    console.warn('Failed to get wallet status:', error);
    return null;
  }
}

/**
 * Combined connect and authenticate flow for Fluxion using ethers.js
 */
export async function connectAndAuth(authApiUrl: string): Promise<{
  address: string;
  signature: string;
  message: string;
  chainId: number;
}> {
  // Step 1: Connect wallet on user's current chain
  const connection = await connectWallet();
  
  // Step 2: Get auth message from backend
  console.log('🔄 Getting authentication message...');
  const messageResponse = await fetch(`${authApiUrl}/users/auth/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address: connection.address })
  });
  
  if (!messageResponse.ok) {
    throw new Error('Failed to get authentication message');
  }
  
  const messageData = await messageResponse.json();
  if (!messageData.success || !messageData.data?.message) {
    throw new Error('Invalid authentication message response');
  }
  
  // Step 3: Sign message using ethers
  const signature = await signMessage(messageData.data.message, connection.signer);
  
  return {
    address: connection.address,
    signature,
    message: messageData.data.message,
    chainId: connection.chainId
  };
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}