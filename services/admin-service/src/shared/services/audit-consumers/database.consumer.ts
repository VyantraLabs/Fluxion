import { Repository } from 'typeorm';
import { Logger } from '../../utils/logger';
import { AuditLog, AuditAction } from '../../../database/entities/AuditLog';
import { AppDataSource } from '../../../database/data-source';
import { AuditEvent, EventConsumer } from '../audit-event.service';

export class DatabaseAuditConsumer implements EventConsumer {
  name = 'database';
  private logger = new Logger('DatabaseAuditConsumer');
  private auditLogRepo: Repository<AuditLog>;

  constructor() {
    this.auditLogRepo = AppDataSource.getRepository(AuditLog);
  }

  isEnabled(): boolean {
    return AppDataSource.isInitialized;
  }

  async handle(event: AuditEvent): Promise<void> {
    try {
      const auditAction = this.mapEventActionToAuditAction(event.action);
      const tableName = this.mapEventTypeToTableName(event.type, event.targetResourceType);
      
      // Create audit log entry
      const auditLog = this.auditLogRepo.create({
        organizationId: event.organizationId || 'system',
        userId: event.userId,
        tableName,
        recordId: event.targetResourceId || event.targetUserId || event.userId || 'system',
        action: auditAction,
        oldValues: event.oldValues,
        newValues: event.newValues,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        adminAction: event.adminAction || false,
        adminUserId: event.adminUserId,
        severityLevel: event.severity,
        metadata: {
          eventType: event.type,
          eventAction: event.action,
          endpoint: event.endpoint,
          method: event.method,
          statusCode: event.statusCode,
          requestId: event.requestId,
          sessionId: event.sessionId,
          source: 'web',
          ...event.details
        },
        createdAt: event.timestamp
      });

      await this.auditLogRepo.save(auditLog);

      this.logger.debug('Audit event stored to database', {
        eventType: event.type,
        eventAction: event.action,
        userId: event.userId,
        organizationId: event.organizationId,
        auditLogId: auditLog.id
      });

    } catch (error: any) {
      this.logger.error('Failed to store audit event to database', {
        error: error.message,
        eventType: event.type,
        eventAction: event.action,
        userId: event.userId,
        organizationId: event.organizationId
      });
      throw error;
    }
  }

  private mapEventActionToAuditAction(eventAction: string): AuditAction {
    // Map specific event actions to generic audit actions
    const actionMap: Record<string, AuditAction> = {
      // Authentication
      'login_success': 'LOGIN',
      'login_failed': 'LOGIN',
      'logout': 'LOGOUT',
      'token_refresh': 'LOGIN',
      
      // Management operations
      'user_created': 'CREATE',
      'user_updated': 'UPDATE',
      'user_deleted': 'DELETE',
      'user_invited': 'CREATE',
      'user_removed_from_organization': 'DELETE',
      
      'role_assigned': 'UPDATE',
      'role_revoked': 'UPDATE',
      'role_changed': 'UPDATE',
      
      'organization_created': 'CREATE',
      'organization_updated': 'UPDATE',
      'organization_deleted': 'DELETE',
      
      'resource_created': 'CREATE',
      'resource_updated': 'UPDATE',
      'resource_deleted': 'DELETE',
      'resource_exported': 'EXPORT',
      
      // System operations
      'system_backup': 'EXPORT',
      'system_restore': 'IMPORT',
      'system_maintenance': 'UPDATE'
    };

    return actionMap[eventAction] || 'UPDATE';
  }

  private mapEventTypeToTableName(eventType: string, resourceType?: string): string {
    // Map event types to database table names
    const typeMap: Record<string, string> = {
      'authentication': 'users',
      'role_management': 'user_roles',
      'user_management': 'users',
      'organization_management': 'organizations',
      'system_operation': 'system_operations'
    };

    if (eventType === 'resource_management' && resourceType) {
      // Map resource types to table names
      const resourceMap: Record<string, string> = {
        'invoice': 'invoices',
        'payment': 'payments',
        'template': 'templates',
        'notification': 'notification_settings',
        'blockchain_network': 'blockchain_networks',
        'token': 'tokens'
      };
      return resourceMap[resourceType] || resourceType;
    }

    return typeMap[eventType] || 'system_operations';
  }

  // Helper method to create batch audit logs
  async handleBatch(events: AuditEvent[]): Promise<void> {
    if (!events.length) return;

    try {
      const auditLogs = events.map(event => {
        const auditAction = this.mapEventActionToAuditAction(event.action);
        const tableName = this.mapEventTypeToTableName(event.type, event.targetResourceType);
        
        return this.auditLogRepo.create({
          organizationId: event.organizationId || 'system',
          userId: event.userId,
          tableName,
          recordId: event.targetResourceId || event.targetUserId || event.userId || 'system',
          action: auditAction,
          oldValues: event.oldValues,
          newValues: event.newValues,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          adminAction: event.adminAction || false,
          adminUserId: event.adminUserId,
          severityLevel: event.severity,
          metadata: {
            eventType: event.type,
            eventAction: event.action,
            endpoint: event.endpoint,
            method: event.method,
            statusCode: event.statusCode,
            requestId: event.requestId,
            sessionId: event.sessionId,
            source: 'web',
            ...event.details
          },
          createdAt: event.timestamp
        });
      });

      await this.auditLogRepo.save(auditLogs);

      this.logger.info('Batch audit events stored to database', {
        eventCount: events.length
      });

    } catch (error: any) {
      this.logger.error('Failed to store batch audit events to database', {
        error: error.message,
        eventCount: events.length
      });
      throw error;
    }
  }
}