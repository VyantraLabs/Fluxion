import { BaseRepository } from './BaseRepository';
import { BlockchainNetwork } from '../entities/BlockchainNetwork';

export class BlockchainNetworkRepository extends BaseRepository<BlockchainNetwork> {
  constructor() {
    super(BlockchainNetwork, 'BlockchainNetwork');
  }
}