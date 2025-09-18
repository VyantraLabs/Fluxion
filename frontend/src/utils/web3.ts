import { ethers } from 'ethers';
import { 
  EthereumProvider, 
  WalletAddress, 
  TransactionHash, 
  NetworkInfo,
  WalletError,
  WalletErrorInfo,
  TokenBalance,
  GasEstimate,
  TransactionRequest,
  USDCTransfer
} from '@/types/web3';
import { config, getRpcUrl, getUSDCContract } from './config';

// ERC-20 ABI for USDC transfers
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

// Check if MetaMask is installed
export const isMetaMaskInstalled = (): boolean => {
  return typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;
};

// Get Ethereum provider
export const getEthereumProvider = (): EthereumProvider | null => {
  if (typeof window === 'undefined') return null;
  return window.ethereum || null;
};

// Create ethers provider
export const createProvider = (chainId?: number): ethers.JsonRpcProvider => {
  const targetChainId = chainId || config.blockchain.defaultChainId;
  const rpcUrl = getRpcUrl(targetChainId);
  return new ethers.JsonRpcProvider(rpcUrl);
};

// Create browser provider (for wallet interactions)
export const createBrowserProvider = (): ethers.BrowserProvider | null => {
  const ethereum = getEthereumProvider();
  if (!ethereum) return null;
  return new ethers.BrowserProvider(ethereum);
};

// Get wallet accounts
export const getAccounts = async (): Promise<WalletAddress[]> => {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error('No Ethereum provider found');

  try {
    const accounts = await ethereum.request({
      method: 'eth_accounts'
    });
    return accounts as WalletAddress[];
  } catch (error) {
    console.error('Error getting accounts:', error);
    throw new WalletErrorInfo({
      code: WalletError.UNAUTHORIZED,
      message: 'Failed to get wallet accounts',
      details: error
    });
  }
};

// Request wallet connection
export const requestWalletConnection = async (): Promise<WalletAddress[]> => {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error('MetaMask not installed');

  try {
    const accounts = await ethereum.request({
      method: 'eth_requestAccounts'
    });
    return accounts as WalletAddress[];
  } catch (error: any) {
    console.error('Error requesting wallet connection:', error);
    
    if (error.code === 4001) {
      throw new WalletErrorInfo({
        code: WalletError.USER_REJECTED,
        message: 'User rejected wallet connection',
        details: error
      });
    }
    
    throw new WalletErrorInfo({
      code: WalletError.UNKNOWN_ERROR,
      message: 'Failed to connect wallet',
      details: error
    });
  }
};

// Get current chain ID
export const getCurrentChainId = async (): Promise<number> => {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error('No Ethereum provider found');

  try {
    const chainId = await ethereum.request({
      method: 'eth_chainId'
    });
    return parseInt(chainId, 16);
  } catch (error) {
    console.error('Error getting chain ID:', error);
    throw new WalletErrorInfo({
      code: WalletError.UNKNOWN_ERROR,
      message: 'Failed to get network information',
      details: error
    });
  }
};

// Switch network
export const switchNetwork = async (chainId: number): Promise<void> => {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error('No Ethereum provider found');

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
  } catch (error: any) {
    console.error('Error switching network:', error);
    
    // If network doesn't exist, try to add it
    if (error.code === 4902) {
      await addNetwork(chainId);
    } else if (error.code === 4001) {
      throw new WalletErrorInfo({
        code: WalletError.USER_REJECTED,
        message: 'User rejected network switch',
        details: error
      });
    } else {
      throw new WalletErrorInfo({
        code: WalletError.WRONG_NETWORK,
        message: 'Failed to switch network',
        details: error
      });
    }
  }
};

// Add network to wallet
export const addNetwork = async (chainId: number): Promise<void> => {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error('No Ethereum provider found');

  const networkConfig = getNetworkConfig(chainId);
  if (!networkConfig) {
    throw new Error(`Unsupported network: ${chainId}`);
  }

  try {
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [networkConfig],
    });
  } catch (error: any) {
    console.error('Error adding network:', error);
    
    if (error.code === 4001) {
      throw new WalletErrorInfo({
        code: WalletError.USER_REJECTED,
        message: 'User rejected adding network',
        details: error
      });
    }
    
    throw new WalletErrorInfo({
      code: WalletError.UNKNOWN_ERROR,
      message: 'Failed to add network',
      details: error
    });
  }
};

// Get network configuration for wallet
const getNetworkConfig = (chainId: number) => {
  switch (chainId) {
    case 137: // Polygon
      return {
        chainId: '0x89',
        chainName: 'Polygon',
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        },
        rpcUrls: ['https://polygon-rpc.com'],
        blockExplorerUrls: ['https://polygonscan.com'],
      };
    case 80001: // Mumbai
      return {
        chainId: '0x13881',
        chainName: 'Polygon Mumbai',
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        },
        rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
        blockExplorerUrls: ['https://mumbai.polygonscan.com'],
      };
    default:
      return null;
  }
};

// Sign message
export const signMessage = async (
  message: string,
  address: WalletAddress
): Promise<string> => {
  const provider = createBrowserProvider();
  if (!provider) throw new Error('No wallet provider found');

  try {
    const signer = await provider.getSigner(address);
    return await signer.signMessage(message);
  } catch (error: any) {
    console.error('Error signing message:', error);
    
    if (error.code === 4001) {
      throw new WalletErrorInfo({
        code: WalletError.USER_REJECTED,
        message: 'User rejected message signing',
        details: error
      });
    }
    
    throw new WalletErrorInfo({
      code: WalletError.UNKNOWN_ERROR,
      message: 'Failed to sign message',
      details: error
    });
  }
};

// Get wallet balance (native token)
export const getWalletBalance = async (
  address: WalletAddress,
  chainId?: number
): Promise<string> => {
  const provider = createProvider(chainId);
  
  try {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    throw new Error('Failed to get wallet balance');
  }
};

// Get token balance (ERC-20)
export const getTokenBalance = async (
  tokenAddress: string,
  walletAddress: WalletAddress,
  chainId?: number
): Promise<TokenBalance> => {
  const provider = createProvider(chainId);
  
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    const [balance, decimals, symbol, name] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals(),
      contract.symbol(),
      contract.name(),
    ]);

    const formatted = ethers.formatUnits(balance, decimals);

    return {
      address: tokenAddress,
      symbol,
      name,
      decimals: Number(decimals),
      balance: balance.toString(),
      formatted,
    };
  } catch (error) {
    console.error('Error getting token balance:', error);
    throw new Error('Failed to get token balance');
  }
};

// Get USDC balance
export const getUSDCBalance = async (
  walletAddress: WalletAddress,
  chainId?: number
): Promise<TokenBalance> => {
  const targetChainId = chainId || config.blockchain.defaultChainId;
  const usdcContract = getUSDCContract(targetChainId);
  
  if (!usdcContract) {
    throw new Error(`USDC contract not found for chain ${targetChainId}`);
  }

  return getTokenBalance((usdcContract as any).address, walletAddress, targetChainId);
};

// Send USDC transfer
export const sendUSDCTransfer = async (
  transfer: USDCTransfer,
  chainId?: number
): Promise<TransactionHash> => {
  const provider = createBrowserProvider();
  if (!provider) throw new Error('No wallet provider found');

  const targetChainId = chainId || config.blockchain.defaultChainId;
  const usdcContract = getUSDCContract(targetChainId);
  
  if (!usdcContract) {
    throw new Error(`USDC contract not found for chain ${targetChainId}`);
  }

  try {
    const signer = await provider.getSigner();
    const contract = new ethers.Contract((usdcContract as any).address, ERC20_ABI, signer);
    
    // Parse amount to wei (USDC has 6 decimals)
    const amountWei = ethers.parseUnits(transfer.amount, (usdcContract as any).decimals);
    
    const transaction = await contract.transfer(transfer.to, amountWei);
    return transaction.hash as TransactionHash;
  } catch (error: any) {
    console.error('Error sending USDC transfer:', error);
    
    if (error.code === 4001) {
      throw new WalletErrorInfo({
        code: WalletError.USER_REJECTED,
        message: 'User rejected transaction',
        details: error
      });
    }
    
    if (error.reason === 'insufficient funds') {
      throw new WalletErrorInfo({
        code: WalletError.INSUFFICIENT_FUNDS,
        message: 'Insufficient USDC balance',
        details: error
      });
    }
    
    throw new WalletErrorInfo({
      code: WalletError.UNKNOWN_ERROR,
      message: 'Transaction failed',
      details: error
    });
  }
};

// Estimate gas for transaction
export const estimateGas = async (
  transaction: TransactionRequest,
  chainId?: number
): Promise<GasEstimate> => {
  const provider = createProvider(chainId);
  
  try {
    const [gasLimit, feeData] = await Promise.all([
      provider.estimateGas(transaction),
      provider.getFeeData(),
    ]);

    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    const maxFeePerGas = feeData.maxFeePerGas;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

    const totalCost = gasLimit * gasPrice;

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: gasPrice.toString(),
      maxFeePerGas: maxFeePerGas?.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
      totalCost: totalCost.toString(),
    };
  } catch (error) {
    console.error('Error estimating gas:', error);
    throw new Error('Failed to estimate gas');
  }
};

// Wait for transaction confirmation
export const waitForTransaction = async (
  txHash: TransactionHash,
  confirmations: number = 1,
  chainId?: number
): Promise<ethers.TransactionReceipt> => {
  const provider = createProvider(chainId);
  
  try {
    const receipt = await provider.waitForTransaction(txHash, confirmations);
    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }
    return receipt;
  } catch (error) {
    console.error('Error waiting for transaction:', error);
    throw new Error('Transaction confirmation failed');
  }
};

// Get transaction details
export const getTransaction = async (
  txHash: TransactionHash,
  chainId?: number
): Promise<ethers.TransactionResponse | null> => {
  const provider = createProvider(chainId);
  
  try {
    return await provider.getTransaction(txHash);
  } catch (error) {
    console.error('Error getting transaction:', error);
    return null;
  }
};

// Get transaction receipt
export const getTransactionReceipt = async (
  txHash: TransactionHash,
  chainId?: number
): Promise<ethers.TransactionReceipt | null> => {
  const provider = createProvider(chainId);
  
  try {
    return await provider.getTransactionReceipt(txHash);
  } catch (error) {
    console.error('Error getting transaction receipt:', error);
    return null;
  }
};

// Verify USDC transfer
export const verifyUSDCTransfer = async (
  txHash: TransactionHash,
  expectedAmount: string,
  expectedRecipient: WalletAddress,
  chainId?: number
): Promise<{
  isValid: boolean;
  actualAmount?: string;
  actualRecipient?: WalletAddress;
  confirmations: number;
}> => {
  const receipt = await getTransactionReceipt(txHash, chainId);
  
  if (!receipt) {
    return { isValid: false, confirmations: 0 };
  }

  const targetChainId = chainId || config.blockchain.defaultChainId;
  const usdcContract = getUSDCContract(targetChainId);
  
  if (!usdcContract) {
    throw new Error(`USDC contract not found for chain ${targetChainId}`);
  }

  // Parse transfer logs
  const iface = new ethers.Interface(ERC20_ABI);
  const transferTopic = iface.getEvent('Transfer')?.topicHash;
  
  if (!transferTopic) {
    return { isValid: false, confirmations: (receipt as any).confirmations || 0 };
  }

  const transferLog = receipt.logs.find(log => 
    log.address.toLowerCase() === (usdcContract as any).address.toLowerCase() &&
    log.topics[0] === transferTopic
  );

  if (!transferLog) {
    return { isValid: false, confirmations: (receipt as any).confirmations || 0 };
  }

  try {
    const parsedLog = iface.parseLog({
      topics: transferLog.topics,
      data: transferLog.data
    });

    if (!parsedLog) {
      return { isValid: false, confirmations: (receipt as any).confirmations || 0 };
    }

    const actualRecipient = parsedLog.args.to.toLowerCase() as WalletAddress;
    const actualAmount = ethers.formatUnits(parsedLog.args.value, (usdcContract as any).decimals);
    const expectedAmountFormatted = expectedAmount;

    const isValid = 
      actualRecipient === expectedRecipient.toLowerCase() &&
      parseFloat(actualAmount) >= parseFloat(expectedAmountFormatted);

    return {
      isValid,
      actualAmount,
      actualRecipient,
      confirmations: (receipt as any).confirmations || 0,
    };
  } catch (error) {
    console.error('Error parsing transfer log:', error);
    return { isValid: false, confirmations: (receipt as any).confirmations || 0 };
  }
};

// Block explorer URL helpers
export const getBlockExplorerUrl = (
  type: 'tx' | 'address' | 'block',
  value: string,
  chainId?: number
): string => {
  const targetChainId = chainId || config.blockchain.defaultChainId;
  
  let baseUrl: string;
  switch (targetChainId) {
    case 137:
      baseUrl = 'https://polygonscan.com';
      break;
    case 80001:
      baseUrl = 'https://mumbai.polygonscan.com';
      break;
    default:
      baseUrl = 'https://polygonscan.com';
  }

  switch (type) {
    case 'tx':
      return `${baseUrl}/tx/${value}`;
    case 'address':
      return `${baseUrl}/address/${value}`;
    case 'block':
      return `${baseUrl}/block/${value}`;
    default:
      return baseUrl;
  }
};