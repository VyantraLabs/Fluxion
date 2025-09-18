import { BaseRepository } from './BaseRepository';
import { SmartContract } from '../entities/SmartContract';

export class SmartContractRepository extends BaseRepository<SmartContract> {
  constructor() {
    super(SmartContract, 'SmartContract');
  }
}