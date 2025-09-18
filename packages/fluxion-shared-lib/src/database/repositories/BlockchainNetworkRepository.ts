import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { BlockchainNetwork } from '../entities/BlockchainNetwork';
import { Logger } from '../../utils/logger';

export class BlockchainNetworkRepository {
  private repository: Repository<BlockchainNetwork>;
  private logger: Logger;

  constructor() {
    this.repository = AppDataSource.getRepository(BlockchainNetwork);
    this.logger = new Logger('BlockchainNetworkRepository');
  }

  async findAll(): Promise<BlockchainNetwork[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { name: 'ASC' }
    });
  }

  async findByChainId(chainId: number): Promise<BlockchainNetwork | null> {
    return this.repository.findOne({
      where: { chainId, isActive: true }
    });
  }

  async findActive(): Promise<BlockchainNetwork[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { name: 'ASC' }
    });
  }

  async createNetwork(data: Partial<BlockchainNetwork>): Promise<BlockchainNetwork> {
    const network = this.repository.create(data);
    return this.repository.save(network);
  }

  async updateNetwork(chainId: number, data: Partial<BlockchainNetwork>): Promise<BlockchainNetwork | null> {
    await this.repository.update({ chainId }, data);
    return this.findByChainId(chainId);
  }

  async deleteNetwork(chainId: number): Promise<void> {
    await this.repository.update({ chainId }, { isActive: false });
  }

  /**
   * Health check for blockchain network repository
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.repository.query('SELECT 1');
      
      const latency = Date.now() - startTime;
      
      this.logger.debug('BlockchainNetwork repository health check passed', { latency });
      return { status: 'healthy', latency };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('BlockchainNetwork repository health check failed', { 
        error: error.message, 
        latency,
      });
      return { 
        status: 'unhealthy', 
        latency,
        error: error.message 
      };
    }
  }
}