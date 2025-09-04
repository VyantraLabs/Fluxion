import { ethers } from 'ethers';
import { Logger } from '@/shared/utils/logger';
import { createBlockchainError } from '@/shared/errors';
import { config } from '@/config';
import { BlockchainTransaction, USDCTransferEvent } from '@/types/payment';

// USDC Contract ABI - minimal interface for transfer events
const USDC_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

// Default configuration for development - will be replaced by database config
const DEFAULT_CONFIG = {
  POLYGON_RPC_URL: 'https://polygon-mainnet.g.alchemy.com/v2/demo',
  USDC_CONTRACT: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC on Polygon
};

export class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private usdcContract: ethers.Contract | null = null;
  private logger: Logger;
  private initialized: boolean = false;

  constructor() {
    this.logger = new Logger('BlockchainService');
    
    // Initialize with default config for now
    // This will be replaced by database-driven configuration
    this.initializeWithDefaults();
  }

  private initializeWithDefaults() {
    try {
      // Use environment variables if available, otherwise use defaults
      const rpcUrl = process.env.POLYGON_RPC_URL || DEFAULT_CONFIG.POLYGON_RPC_URL;
      const usdcAddress = process.env.USDC_CONTRACT_ADDRESS || DEFAULT_CONFIG.USDC_CONTRACT;

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.usdcContract = new ethers.Contract(usdcAddress, USDC_ABI, this.provider);
      this.initialized = true;

      this.logger.info('BlockchainService initialized with defaults', { 
        network: 'polygon',
        usdcContract: usdcAddress,
        rpcConfigured: !!process.env.POLYGON_RPC_URL
      });
    } catch (error) {
      this.logger.error('Failed to initialize BlockchainService', { error });
      this.initialized = false;
    }
  }

  /**
   * Verify a transaction exists and get its details
   */
  async getTransaction(txHash: string): Promise<BlockchainTransaction | null> {
    this.logger.info('Getting transaction', { txHash });

    if (!this.initialized || !this.provider) {
      throw createBlockchainError('Blockchain service not initialized');
    }

    try {
      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(txHash),
        this.provider.getTransactionReceipt(txHash)
      ]);

      if (!tx || !receipt) {
        this.logger.warn('Transaction not found', { txHash });
        return null;
      }

      const latestBlock = await this.provider.getBlockNumber();
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
        txHash, 
        blockNumber: transaction.blockNumber,
        confirmations: transaction.confirmations,
        status: transaction.status
      });

      return transaction;
    } catch (error) {
      this.logger.error('Failed to get transaction', { error, txHash });
      throw createBlockchainError(`Failed to get transaction: ${error}`);
    }
  }

  /**
   * Get USDC transfer events from a transaction
   */
  async getUSDCTransferEvents(txHash: string): Promise<USDCTransferEvent[]> {
    this.logger.info('Getting USDC transfer events', { txHash });

    if (!this.initialized || !this.provider || !this.usdcContract) {
      throw createBlockchainError('Blockchain service not initialized');
    }

    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        this.logger.warn('Transaction receipt not found', { txHash });
        return [];
      }

      const events: USDCTransferEvent[] = [];

      for (const log of receipt.logs) {
        // Check if log is from USDC contract
        const usdcAddress = process.env.USDC_CONTRACT_ADDRESS || DEFAULT_CONFIG.USDC_CONTRACT;
        if (log.address.toLowerCase() !== usdcAddress.toLowerCase()) {
          continue;
        }

        try {
          // Parse the transfer event
          const parsedLog = this.usdcContract.interface.parseLog({
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
          // Skip logs that can't be parsed
          this.logger.debug('Failed to parse log', { parseError, logIndex: log.index });
          continue;
        }
      }

      this.logger.info('USDC transfer events found', { 
        txHash, 
        eventCount: events.length 
      });

      return events;
    } catch (error) {
      this.logger.error('Failed to get USDC transfer events', { error, txHash });
      throw createBlockchainError(`Failed to get USDC transfer events: ${error}`);
    }
  }

  /**
   * Verify a USDC payment to a specific address
   */
  async verifyUSDCPayment(
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
  }> {
    this.logger.info('Verifying USDC payment', { 
      txHash, 
      expectedRecipient, 
      expectedAmount,
      senderAddress 
    });

    try {
      // Get transaction details
      const transaction = await this.getTransaction(txHash);
      if (!transaction || transaction.status !== 1) {
        return {
          isValid: false,
          actualAmount: '0',
          actualSender: '',
          actualRecipient: '',
          confirmations: 0
        };
      }

      // Get USDC transfer events
      const transferEvents = await this.getUSDCTransferEvents(txHash);
      
      // Find the relevant transfer event
      const relevantTransfer = transferEvents.find(event => 
        event.to.toLowerCase() === expectedRecipient.toLowerCase()
      );

      if (!relevantTransfer) {
        this.logger.warn('No relevant USDC transfer found', { 
          txHash, 
          expectedRecipient, 
          transferCount: transferEvents.length 
        });
        
        return {
          isValid: false,
          actualAmount: '0',
          actualSender: '',
          actualRecipient: '',
          confirmations: transaction.confirmations
        };
      }

      // Check sender if specified
      const senderValid = !senderAddress || 
        relevantTransfer.from.toLowerCase() === senderAddress.toLowerCase();

      // Convert amounts to comparable format (remove decimals)
      const expectedAmountWei = ethers.parseUnits(expectedAmount, 6); // USDC has 6 decimals
      const actualAmountWei = BigInt(relevantTransfer.value);
      const amountValid = actualAmountWei >= expectedAmountWei;

      const isValid = senderValid && amountValid && transaction.confirmations >= 1;

      this.logger.info('Payment verification result', {
        txHash,
        isValid,
        senderValid,
        amountValid,
        expectedAmount,
        actualAmount: ethers.formatUnits(actualAmountWei, 6),
        confirmations: transaction.confirmations
      });

      return {
        isValid,
        actualAmount: ethers.formatUnits(actualAmountWei, 6),
        actualSender: relevantTransfer.from,
        actualRecipient: relevantTransfer.to,
        confirmations: transaction.confirmations
      };
    } catch (error) {
      this.logger.error('Failed to verify USDC payment', { error, txHash });
      throw createBlockchainError(`Failed to verify USDC payment: ${error}`);
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlockNumber(): Promise<number> {
    if (!this.initialized || !this.provider) {
      throw createBlockchainError('Blockchain service not initialized');
    }

    try {
      const blockNumber = await this.provider.getBlockNumber();
      this.logger.debug('Current block number retrieved', { blockNumber });
      return blockNumber;
    } catch (error) {
      this.logger.error('Failed to get current block number', { error });
      throw createBlockchainError(`Failed to get current block number: ${error}`);
    }
  }

  /**
   * Get USDC balance of an address
   */
  async getUSDCBalance(address: string): Promise<string> {
    this.logger.info('Getting USDC balance', { address });

    if (!this.initialized || !this.usdcContract) {
      throw createBlockchainError('Blockchain service not initialized');
    }

    try {
      const balance = await this.usdcContract.balanceOf(address);
      const formattedBalance = ethers.formatUnits(balance, 6);
      
      this.logger.info('USDC balance retrieved', { address, balance: formattedBalance });
      return formattedBalance;
    } catch (error) {
      this.logger.error('Failed to get USDC balance', { error, address });
      throw createBlockchainError(`Failed to get USDC balance: ${error}`);
    }
  }

  /**
   * Validate wallet address format
   */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Validate transaction hash format
   */
  isValidTransactionHash(hash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }

  /**
   * Verify wallet signature for authentication
   */
  verifyWalletSignature(message: string, signature: string, expectedAddress: string): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const isValid = recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
      
      this.logger.info('Wallet signature verification', {
        expectedAddress,
        recoveredAddress,
        isValid
      });
      
      return isValid;
    } catch (error) {
      this.logger.error('Failed to verify wallet signature', { 
        error, 
        expectedAddress,
        signature: signature.substring(0, 10) + '...'
      });
      return false;
    }
  }

  /**
   * Generate authentication message for wallet signing
   */
  generateAuthMessage(walletAddress: string, nonce: string): string {
    const timestamp = Date.now();
    const message = [
      'Welcome to Fluxion!',
      '',
      'Please sign this message to authenticate your wallet.',
      '',
      `Wallet: ${walletAddress}`,
      `Nonce: ${nonce}`,
      `Timestamp: ${timestamp}`
    ].join('\n');

    this.logger.info('Generated auth message', { walletAddress, nonce, timestamp });
    return message;
  }

  /**
   * Health check for blockchain connectivity
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Try to get latest block number
      await this.getCurrentBlockNumber();
      
      const latency = Date.now() - startTime;
      
      this.logger.debug('Blockchain health check passed', { latency });
      return { status: 'healthy', latency };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('Blockchain health check failed', { error: error.message, latency });
      return { 
        status: 'unhealthy', 
        latency,
        error: error.message 
      };
    }
  }
}

// Singleton instance
let blockchainInstance: BlockchainService | null = null;

export const getBlockchainService = (): BlockchainService => {
  if (!blockchainInstance) {
    blockchainInstance = new BlockchainService();
  }
  return blockchainInstance;
};

// Enhanced service export for new features
export { getEnhancedBlockchainService, EnhancedBlockchainService } from './enhanced-client';

export default BlockchainService;