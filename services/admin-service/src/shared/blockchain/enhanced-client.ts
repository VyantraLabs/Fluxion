import { ethers } from 'ethers';
import { Logger } from '../utils/logger';
import { createBlockchainError } from '../errors';
import { BlockchainTransaction, USDCTransferEvent } from '../../types/payment';
import { ConfigService } from '../../modules/config/service';
import { NetworkConfig, TokenConfig } from '../../types/config';

// Enhanced blockchain service that uses dynamic configuration
export class EnhancedBlockchainService {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private tokenContracts: Map<string, ethers.Contract> = new Map();
  private networks: Map<number, NetworkConfig> = new Map();
  private tokens: Map<string, TokenConfig> = new Map();
  private logger: Logger;
  private configService: ConfigService;
  private initialized: boolean = false;

  // Standard ERC20 ABI for tokens
  private readonly ERC20_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)',
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function totalSupply() view returns (uint256)',
  ];

  constructor() {
    this.logger = new Logger('EnhancedBlockchainService');
    this.configService = new ConfigService();
  }

  /**
   * Initialize the service with network and token configurations from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.info('Initializing EnhancedBlockchainService with database configuration');

      // Load all active networks and tokens
      const [networksResponse, tokensResponse] = await Promise.all([
        this.configService.getNetworks({ isActive: true }),
        this.configService.getTokens({ isActive: true }),
      ]);

      // Setup providers for each network
      for (const network of networksResponse.networks) {
        try {
          // Skip networks that aren't EVM-compatible or don't have valid RPC URLs
          if (!this.isEVMCompatible(network)) {
            this.logger.info('Skipping non-EVM network', { network: network.name, chainId: network.chainId });
            continue;
          }

          // Replace placeholder API keys with actual ones from environment
          const rpcUrl = this.processRpcUrl(network.rpcUrl, network.chainId);
          
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          this.providers.set(network.chainId, provider);
          this.networks.set(network.chainId, network);

          this.logger.info('Network provider initialized', { 
            network: network.name, 
            chainId: network.chainId,
            hasRpcKey: rpcUrl !== network.rpcUrl
          });
        } catch (error: any) {
          this.logger.warn('Failed to initialize network provider', { 
            network: network.name, 
            chainId: network.chainId, 
            error: error.message 
          });
        }
      }

      // Setup token contracts for each token
      for (const token of tokensResponse.tokens) {
        try {
          // Skip native tokens (they don't have contracts)
          if (token.isNative) {
            this.tokens.set(this.getTokenKey(token), token);
            continue;
          }

          const network = this.networks.get(this.findChainIdByNetworkId(token.networkId, networksResponse.networks));
          const provider = network ? this.providers.get(network.chainId) : null;

          if (provider && token.contractAddress) {
            const contract = new ethers.Contract(token.contractAddress, this.ERC20_ABI, provider);
            const contractKey = `${network!.chainId}-${token.contractAddress.toLowerCase()}`;
            
            this.tokenContracts.set(contractKey, contract);
            this.tokens.set(this.getTokenKey(token), token);

            this.logger.debug('Token contract initialized', { 
              token: token.symbol,
              network: network!.name,
              contractAddress: token.contractAddress
            });
          }
        } catch (error: any) {
          this.logger.warn('Failed to initialize token contract', { 
            token: token.symbol, 
            error: error.message 
          });
        }
      }

      this.initialized = true;
      this.logger.info('EnhancedBlockchainService initialized successfully', {
        networksCount: this.providers.size,
        tokensCount: this.tokens.size,
        contractsCount: this.tokenContracts.size,
      });

    } catch (error: any) {
      this.logger.error('Failed to initialize EnhancedBlockchainService', { error: error.message });
      throw createBlockchainError(`Failed to initialize blockchain service: ${error.message}`);
    }
  }

  /**
   * Get transaction details for any supported network
   */
  async getTransaction(chainId: number, txHash: string): Promise<BlockchainTransaction | null> {
    await this.ensureInitialized();
    
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw createBlockchainError(`Network with chain ID ${chainId} not supported`);
    }

    this.logger.info('Getting transaction', { chainId, txHash });

    try {
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(txHash),
        provider.getTransactionReceipt(txHash)
      ]);

      if (!tx || !receipt) {
        this.logger.warn('Transaction not found', { chainId, txHash });
        return null;
      }

      const latestBlock = await provider.getBlockNumber();
      const confirmations = latestBlock - receipt.blockNumber;

      const transaction: BlockchainTransaction = {
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        from: tx.from,
        to: tx.to || '',
        value: tx.value.toString(),
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: tx.gasPrice?.toString() || '0',
        status: receipt.status || 0,
        confirmations: Math.max(0, confirmations)
      };

      this.logger.info('Transaction retrieved', { 
        chainId,
        txHash, 
        blockNumber: transaction.blockNumber,
        confirmations: transaction.confirmations,
        status: transaction.status
      });

      return transaction;
    } catch (error: any) {
      this.logger.error('Failed to get transaction', { error: error.message, chainId, txHash });
      throw createBlockchainError(`Failed to get transaction: ${error.message}`);
    }
  }

  /**
   * Get token transfer events for any supported token
   */
  async getTokenTransferEvents(
    chainId: number, 
    tokenAddress: string, 
    txHash: string
  ): Promise<USDCTransferEvent[]> {
    await this.ensureInitialized();

    const contractKey = `${chainId}-${tokenAddress.toLowerCase()}`;
    const contract = this.tokenContracts.get(contractKey);
    const provider = this.providers.get(chainId);

    if (!contract || !provider) {
      throw createBlockchainError(`Token contract ${tokenAddress} on chain ${chainId} not supported`);
    }

    this.logger.info('Getting token transfer events', { chainId, tokenAddress, txHash });

    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        this.logger.warn('Transaction receipt not found', { chainId, txHash });
        return [];
      }

      const events: USDCTransferEvent[] = [];

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) {
          continue;
        }

        try {
          const parsedLog = contract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });

          if (parsedLog && parsedLog.name === 'Transfer') {
            events.push({
              from: parsedLog.args.from,
              to: parsedLog.args.to,
              value: parsedLog.args.value.toString(),
              transactionHash: txHash,
              blockNumber: receipt.blockNumber
            });
          }
        } catch (parseError) {
          this.logger.debug('Failed to parse log', { parseError, logIndex: log.index });
          continue;
        }
      }

      this.logger.info('Token transfer events found', { 
        chainId,
        tokenAddress,
        txHash, 
        eventCount: events.length 
      });

      return events;
    } catch (error: any) {
      this.logger.error('Failed to get token transfer events', { error: error.message, chainId, tokenAddress, txHash });
      throw createBlockchainError(`Failed to get token transfer events: ${error.message}`);
    }
  }

  /**
   * Verify a token payment with dynamic token support
   */
  async verifyTokenPayment(
    chainId: number,
    tokenSymbol: string,
    txHash: string,
    expectedRecipient: string,
    expectedAmount: string,
    senderAddress?: string
  ): Promise<{
    isValid: boolean;
    actualAmount: string;
    actualSender: string;
    actualRecipient: string;
    confirmations: number;
    tokenInfo: TokenConfig;
  }> {
    await this.ensureInitialized();

    // Find the token configuration
    const token = Array.from(this.tokens.values()).find(t => 
      t.symbol === tokenSymbol && 
      this.networks.get(chainId)?.id === t.networkId
    );

    if (!token) {
      throw createBlockchainError(`Token ${tokenSymbol} not supported on chain ${chainId}`);
    }

    if (token.isNative) {
      return this.verifyNativeTokenPayment(chainId, txHash, expectedRecipient, expectedAmount, senderAddress, token);
    } else {
      return this.verifyERC20Payment(chainId, token, txHash, expectedRecipient, expectedAmount, senderAddress);
    }
  }

  /**
   * Get token balance for any supported token
   */
  async getTokenBalance(chainId: number, tokenSymbol: string, address: string): Promise<string> {
    await this.ensureInitialized();

    const token = Array.from(this.tokens.values()).find(t => 
      t.symbol === tokenSymbol && 
      this.networks.get(chainId)?.id === t.networkId
    );

    if (!token) {
      throw createBlockchainError(`Token ${tokenSymbol} not supported on chain ${chainId}`);
    }

    this.logger.info('Getting token balance', { chainId, tokenSymbol, address });

    try {
      if (token.isNative) {
        // Native token balance
        const provider = this.providers.get(chainId);
        if (!provider) {
          throw createBlockchainError(`Network with chain ID ${chainId} not supported`);
        }

        const balance = await provider.getBalance(address);
        const formattedBalance = ethers.formatUnits(balance, token.decimals);
        
        this.logger.info('Native token balance retrieved', { chainId, tokenSymbol, address, balance: formattedBalance });
        return formattedBalance;
      } else {
        // ERC20 token balance
        const contractKey = `${chainId}-${token.contractAddress!.toLowerCase()}`;
        const contract = this.tokenContracts.get(contractKey);

        if (!contract) {
          throw createBlockchainError(`Token contract ${token.contractAddress} on chain ${chainId} not available`);
        }

        const balance = await contract.balanceOf(address);
        const formattedBalance = ethers.formatUnits(balance, token.decimals);
        
        this.logger.info('ERC20 token balance retrieved', { chainId, tokenSymbol, address, balance: formattedBalance });
        return formattedBalance;
      }
    } catch (error: any) {
      this.logger.error('Failed to get token balance', { error: error.message, chainId, tokenSymbol, address });
      throw createBlockchainError(`Failed to get token balance: ${error.message}`);
    }
  }

  /**
   * Get current block number for any supported network
   */
  async getCurrentBlockNumber(chainId: number): Promise<number> {
    await this.ensureInitialized();

    const provider = this.providers.get(chainId);
    if (!provider) {
      throw createBlockchainError(`Network with chain ID ${chainId} not supported`);
    }

    try {
      const blockNumber = await provider.getBlockNumber();
      this.logger.debug('Current block number retrieved', { chainId, blockNumber });
      return blockNumber;
    } catch (error: any) {
      this.logger.error('Failed to get current block number', { error: error.message, chainId });
      throw createBlockchainError(`Failed to get current block number: ${error.message}`);
    }
  }

  /**
   * Get list of supported networks
   */
  getSupportedNetworks(): NetworkConfig[] {
    return Array.from(this.networks.values());
  }

  /**
   * Get list of supported tokens for a network
   */
  getSupportedTokens(chainId: number): TokenConfig[] {
    const networkId = this.networks.get(chainId)?.id;
    if (!networkId) {
      return [];
    }

    return Array.from(this.tokens.values()).filter(token => token.networkId === networkId);
  }

  /**
   * Validate if a network is supported
   */
  isNetworkSupported(chainId: number): boolean {
    return this.networks.has(chainId);
  }

  /**
   * Validate if a token is supported on a network
   */
  isTokenSupported(chainId: number, tokenSymbol: string): boolean {
    const networkId = this.networks.get(chainId)?.id;
    if (!networkId) {
      return false;
    }

    return Array.from(this.tokens.values()).some(token => 
      token.networkId === networkId && token.symbol === tokenSymbol
    );
  }

  /**
   * Health check for blockchain connectivity across all networks
   */
  async healthCheck(): Promise<{ 
    status: 'healthy' | 'unhealthy'; 
    latency: number; 
    error?: string;
    networkStatus: { [chainId: number]: 'healthy' | 'unhealthy' }
  }> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();

      const networkPromises = Array.from(this.providers.entries()).map(async ([chainId, provider]) => {
        try {
          await provider.getBlockNumber();
          return { chainId, status: 'healthy' as const };
        } catch {
          return { chainId, status: 'unhealthy' as const };
        }
      });

      const networkResults = await Promise.allSettled(networkPromises);
      const networkStatus: { [chainId: number]: 'healthy' | 'unhealthy' } = {};
      
      let healthyCount = 0;
      for (const result of networkResults) {
        if (result.status === 'fulfilled') {
          networkStatus[result.value.chainId] = result.value.status;
          if (result.value.status === 'healthy') {
            healthyCount++;
          }
        }
      }

      const latency = Date.now() - startTime;
      const overallStatus = healthyCount > 0 ? 'healthy' : 'unhealthy';

      this.logger.debug('Enhanced blockchain health check completed', { 
        overallStatus, 
        healthyNetworks: healthyCount, 
        totalNetworks: this.providers.size,
        latency 
      });

      return { 
        status: overallStatus, 
        latency,
        networkStatus
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('Enhanced blockchain health check failed', { error: error.message, latency });
      return { 
        status: 'unhealthy', 
        latency,
        error: error.message,
        networkStatus: {}
      };
    }
  }

  // Private helper methods
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private isEVMCompatible(network: NetworkConfig): boolean {
    // Bitcoin and Solana are not EVM-compatible
    const nonEVMNetworks = [0, 1, 101, 103]; // Bitcoin mainnet, testnet, Solana mainnet, devnet
    return !nonEVMNetworks.includes(network.chainId);
  }

  private processRpcUrl(rpcUrl: string, chainId: number): string {
    // Replace placeholder API keys with actual ones from environment
    if (rpcUrl.includes('YOUR_API_KEY')) {
      switch (chainId) {
        case 1: // Ethereum
        case 11155111: // Sepolia
          return rpcUrl.replace('YOUR_API_KEY', process.env.INFURA_API_KEY || 'demo');
        case 137: // Polygon
        case 80001: // Mumbai
          return rpcUrl.replace('YOUR_API_KEY', process.env.ALCHEMY_API_KEY || 'demo');
        default:
          return rpcUrl.replace('YOUR_API_KEY', 'demo');
      }
    }
    return rpcUrl;
  }

  private getTokenKey(token: TokenConfig): string {
    return `${token.networkId}-${token.symbol}`;
  }

  private findChainIdByNetworkId(networkId: string, networks: NetworkConfig[]): number {
    const network = networks.find(n => n.id === networkId);
    return network ? network.chainId : 0;
  }

  private async verifyNativeTokenPayment(
    chainId: number,
    txHash: string,
    expectedRecipient: string,
    expectedAmount: string,
    senderAddress: string | undefined,
    token: TokenConfig
  ) {
    const transaction = await this.getTransaction(chainId, txHash);
    if (!transaction || transaction.status !== 1) {
      return {
        isValid: false,
        actualAmount: '0',
        actualSender: '',
        actualRecipient: '',
        confirmations: 0,
        tokenInfo: token
      };
    }

    const senderValid = !senderAddress || 
      transaction.from.toLowerCase() === senderAddress.toLowerCase();
    
    const recipientValid = transaction.to.toLowerCase() === expectedRecipient.toLowerCase();
    
    const expectedAmountWei = ethers.parseUnits(expectedAmount, token.decimals);
    const actualAmountWei = BigInt(transaction.value);
    const amountValid = actualAmountWei >= expectedAmountWei;
    
    const isValid = senderValid && recipientValid && amountValid && transaction.confirmations >= 1;

    return {
      isValid,
      actualAmount: ethers.formatUnits(actualAmountWei, token.decimals),
      actualSender: transaction.from,
      actualRecipient: transaction.to,
      confirmations: transaction.confirmations,
      tokenInfo: token
    };
  }

  private async verifyERC20Payment(
    chainId: number,
    token: TokenConfig,
    txHash: string,
    expectedRecipient: string,
    expectedAmount: string,
    senderAddress: string | undefined
  ) {
    const transaction = await this.getTransaction(chainId, txHash);
    if (!transaction || transaction.status !== 1) {
      return {
        isValid: false,
        actualAmount: '0',
        actualSender: '',
        actualRecipient: '',
        confirmations: 0,
        tokenInfo: token
      };
    }

    const transferEvents = await this.getTokenTransferEvents(chainId, token.contractAddress!, txHash);
    
    const relevantTransfer = transferEvents.find(event => 
      event.to.toLowerCase() === expectedRecipient.toLowerCase()
    );

    if (!relevantTransfer) {
      return {
        isValid: false,
        actualAmount: '0',
        actualSender: '',
        actualRecipient: '',
        confirmations: transaction.confirmations,
        tokenInfo: token
      };
    }

    const senderValid = !senderAddress || 
      relevantTransfer.from.toLowerCase() === senderAddress.toLowerCase();

    const expectedAmountWei = ethers.parseUnits(expectedAmount, token.decimals);
    const actualAmountWei = BigInt(relevantTransfer.value);
    const amountValid = actualAmountWei >= expectedAmountWei;

    const isValid = senderValid && amountValid && transaction.confirmations >= 1;

    return {
      isValid,
      actualAmount: ethers.formatUnits(actualAmountWei, token.decimals),
      actualSender: relevantTransfer.from,
      actualRecipient: relevantTransfer.to,
      confirmations: transaction.confirmations,
      tokenInfo: token
    };
  }

  // Static utility methods that don't require initialization
  static isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  static isValidTransactionHash(hash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }

  static verifyWalletSignature(message: string, signature: string, expectedAddress: string): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch {
      return false;
    }
  }

  static generateAuthMessage(walletAddress: string, nonce: string): string {
    const timestamp = Date.now();
    return [
      'Welcome to Fluxion!',
      '',
      'Please sign this message to authenticate your wallet.',
      '',
      `Wallet: ${walletAddress}`,
      `Nonce: ${nonce}`,
      `Timestamp: ${timestamp}`
    ].join('\n');
  }
}

// Singleton instance
let enhancedBlockchainInstance: EnhancedBlockchainService | null = null;

export const getEnhancedBlockchainService = (): EnhancedBlockchainService => {
  if (!enhancedBlockchainInstance) {
    enhancedBlockchainInstance = new EnhancedBlockchainService();
  }
  return enhancedBlockchainInstance;
};

export default EnhancedBlockchainService;