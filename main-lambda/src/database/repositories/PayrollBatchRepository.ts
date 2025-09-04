import { BaseRepository } from './BaseRepository';
import { PayrollBatch } from '../entities/PayrollBatch';

export class PayrollBatchRepository extends BaseRepository<PayrollBatch> {
  constructor() {
    super(PayrollBatch, 'PayrollBatch');
  }
}