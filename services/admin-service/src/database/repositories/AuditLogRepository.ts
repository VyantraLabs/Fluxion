import { BaseRepository } from './BaseRepository';
import { AuditLog } from '../entities/AuditLog';

export class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor() {
    super(AuditLog, 'AuditLog');
  }
}