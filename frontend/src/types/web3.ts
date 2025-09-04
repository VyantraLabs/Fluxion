import { ethers } from 'ethers';

// Wallet types
export type WalletAddress = `0x${string}`;
export type TransactionHash = `0x${string}`;
export type PrivateKey = `0x${string}`;

// Wallet connection status
export type WalletConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Supported wallet providers
export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase';

export interface WalletInfo {
  address: WalletAddress;
  chainId: number;
  provider: WalletProvider;
  isConnected: boolean;
  balance?: string;
  ensName?: string;
}

// Ethereum provider types
export interface EthereumProvider extends ethers.Eip1193Provider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  selectedAddress: string | null;
  chainId: string;
  networkVersion: string;
  
  // Methods
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  removeListener: (event: string, callback: (...args: any[]) => void) => void;
  
  // Legacy methods (for older dApps compatibility)
  sendAsync?: (request: any, callback: (error: any, response: any) => void) => void;
  send?: (request: any, callback: (error: any, response: any) => void) => void;
}

// Window ethereum extension
declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

// Transaction types
export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface TransactionResponse {
  hash: TransactionHash;
  blockNumber?: number;
  blockHash?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  status?: 'success' | 'failed';
  confirmations: number;
}

// Smart contract types
export interface ContractConfig {
  address: string;
  abi: any[];
  chainId: number;
}

// USDC Contract specific types
export interface USDCTransfer {
  to: WalletAddress;
  amount: string; // In wei (smallest unit)
  decimals: number;
}

export interface TokenTransfer extends USDCTransfer {
  tokenAddress: string;
  symbol: string;
  name: string;
}

// Gas estimation
export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  totalCost: string;
  totalCostUSD?: string;
}

// Network configuration
export interface NetworkInfo {
  chainId: number;
  name: string;
  currency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  iconUrls?: string[];
}

// Polygon network constants
export const POLYGON_MAINNET: NetworkInfo = {
  chainId: 137,
  name: 'Polygon',
  currency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: ['https://polygon-rpc.com'],
  blockExplorerUrls: ['https://polygonscan.com'],
  iconUrls: ['https://wallet-asset.matic.network/img/tokens/matic.svg'],
};

export const POLYGON_MUMBAI: NetworkInfo = {
  chainId: 80001,
  name: 'Polygon Mumbai',
  currency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
  blockExplorerUrls: ['https://mumbai.polygonscan.com'],
  iconUrls: ['https://wallet-asset.matic.network/img/tokens/matic.svg'],
};

// USDC token contracts
export const USDC_CONTRACTS = {
  [POLYGON_MAINNET.chainId]: {
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as WalletAddress,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
  },
  [POLYGON_MUMBAI.chainId]: {
    address: '0x9999f7fea5938fd3b1e26a12c3f2fb024e194f97' as WalletAddress,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin (Test)',
  },
} as const;

// Wallet connection errors
export enum WalletError {
  USER_REJECTED = 'USER_REJECTED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  UNSUPPORTED_METHOD = 'UNSUPPORTED_METHOD',
  DISCONNECTED = 'DISCONNECTED',
  CHAIN_DISCONNECTED = 'CHAIN_DISCONNECTED',
  WRONG_NETWORK = 'WRONG_NETWORK',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface WalletErrorInfo {
  code: WalletError;
  message: string;
  details?: any;
}

// Ensure WalletErrorInfo is properly exported
export type { WalletErrorInfo };

// Wallet events
export type WalletEvent = 
  | 'accountsChanged'
  | 'chainChanged'
  | 'connect'
  | 'disconnect'
  | 'message';

// Authentication types
export interface SignatureRequest {
  message: string;
  address: WalletAddress;
}

export interface SignatureResult {
  signature: string;
  message: string;
  address: WalletAddress;
}

// Transaction monitoring
export interface TransactionStatus {
  hash: TransactionHash;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

// Balance types
export interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string; // Raw balance
  formatted: string; // Human readable
  value?: string; // USD value if available
}

// Web3 context state
export interface Web3State {
  wallet: WalletInfo | null;
  isConnecting: boolean;
  error: WalletErrorInfo | null;
  chainId: number | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
}

// Web3 actions
export interface Web3Actions {
  connect: (provider?: WalletProvider) => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  sendTransaction: (transaction: TransactionRequest) => Promise<TransactionHash>;
  getBalance: (address?: WalletAddress) => Promise<string>;
  getTokenBalance: (tokenAddress: string, address?: WalletAddress) => Promise<TokenBalance>;
}