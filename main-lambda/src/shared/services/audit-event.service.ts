import { EventEmitter } from 'events';
import { Logger } from '@/shared/utils/logger';

export interface AuditEvent {
  type: 'authentication' | 'role_management' | 'user_management' | 'organization_management' | 'resource_management' | 'system_operation';
  action: string;
  userId?: string;
  organizationId?: string;
  targetUserId?: string;
  targetResourceId?: string;
  targetResourceType?: string;
  oldValues?: any;
  newValues?: any;
  details: any;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  adminAction?: boolean;
  adminUserId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface AuditEventContext {
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  requestId?: string;
  sessionId?: string;
}

export interface EventConsumer {
  name: string;
  handle(event: AuditEvent): Promise<void>;
  isEnabled(): boolean;
}

export class AuditEventService {
  private static instance: AuditEventService;
  private eventEmitter: EventEmitter;
  private consumers: Map<string, EventConsumer> = new Map();
  private logger = new Logger('AuditEventService');

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(50); // Support multiple consumers
  }

  static getInstance(): AuditEventService {
    if (!AuditEventService.instance) {
      AuditEventService.instance = new AuditEventService();
    }
    return AuditEventService.instance;
  }

  /**
   * Register an event consumer
   */
  registerConsumer(consumer: EventConsumer): void {
    this.consumers.set(consumer.name, consumer);
    
    // Register event listener for all event types
    const eventTypes = [
      'authentication',
      'role_management', 
      'user_management',
      'organization_management',
      'resource_management',
      'system_operation'
    ];

    eventTypes.forEach(eventType => {
      this.eventEmitter.on(eventType, async (event: AuditEvent) => {
        if (consumer.isEnabled()) {
          try {
            await consumer.handle(event);
          } catch (error: any) {
            this.logger.error(`Consumer ${consumer.name} failed to handle event`, {
              error: error.message,
              eventType: event.type,
              eventAction: event.action,
              userId: event.userId
            });
          }
        }
      });
    });

    this.logger.info(`Registered audit event consumer: ${consumer.name}`);
  }

  /**
   * Emit an audit event
   */
  async emit(event: AuditEvent): Promise<void> {
    // Add timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    this.logger.debug('Emitting audit event', {
      type: event.type,
      action: event.action,
      userId: event.userId,
      organizationId: event.organizationId,
      severity: event.severity
    });

    // Emit to all consumers
    this.eventEmitter.emit(event.type, event);
  }

  // ============================================================================
  // Authentication Events
  // ============================================================================

  async emitLogin(context: AuditEventContext, success: boolean, details?: any): Promise<void> {
    await this.emit({
      type: 'authentication',
      action: success ? 'login_success' : 'login_failed',
      userId: context.userId,
      organizationId: context.organizationId,
      details: {
        success,
        method: 'wallet_signature',
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      endpoint: context.endpoint,
      method: context.method,
      timestamp: new Date(),
      severity: success ? 'low' : 'medium'
    });
  }

  async emitLogout(context: AuditEventContext, details?: any): Promise<void> {
    await this.emit({
      type: 'authentication',
      action: 'logout',
      userId: context.userId,
      organizationId: context.organizationId,
      details: {
        method: 'jwt_invalidation',
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'low'
    });
  }

  async emitTokenRefresh(context: AuditEventContext, details?: any): Promise<void> {
    await this.emit({
      type: 'authentication',
      action: 'token_refresh',
      userId: context.userId,
      organizationId: context.organizationId,
      details: details || {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'low'
    });
  }

  // ============================================================================
  // Role Management Events
  // ============================================================================

  async emitRoleAssigned(
    context: AuditEventContext,
    targetUserId: string,
    roleKey: string,
    organizationId?: string,
    adminUserId?: string,
    details?: any
  ): Promise<void> {
    await this.emit({
      type: 'role_management',
      action: 'role_assigned',
      userId: context.userId,
      organizationId: organizationId || context.organizationId,
      targetUserId,
      adminUserId: adminUserId || context.userId,
      adminAction: !!adminUserId,
      details: {
        roleKey,
        organizationId,
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'medium'
    });
  }

  async emitRoleRevoked(
    context: AuditEventContext,
    targetUserId: string,
    roleKey: string,
    organizationId?: string,
    adminUserId?: string,
    details?: any
  ): Promise<void> {
    await this.emit({
      type: 'role_management',
      action: 'role_revoked',
      userId: context.userId,
      organizationId: organizationId || context.organizationId,
      targetUserId,
      adminUserId: adminUserId || context.userId,
      adminAction: !!adminUserId,
      details: {
        roleKey,
        organizationId,
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'medium'
    });
  }

  async emitRoleChanged(
    context: AuditEventContext,
    targetUserId: string,
    oldRole: string,
    newRole: string,
    organizationId?: string,
    adminUserId?: string,
    details?: any
  ): Promise<void> {
    await this.emit({
      type: 'role_management',
      action: 'role_changed',
      userId: context.userId,
      organizationId: organizationId || context.organizationId,
      targetUserId,
      adminUserId: adminUserId || context.userId,
      adminAction: !!adminUserId,
      oldValues: { role: oldRole },
      newValues: { role: newRole },
      details: {
        oldRole,
        newRole,
        organizationId,
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'high'
    });
  }

  // ============================================================================
  // User Management Events  
  // ============================================================================

  async emitUserCreated(context: AuditEventContext, targetUserId: string, details?: any): Promise<void> {
    await this.emit({
      type: 'user_management',
      action: 'user_created',
      userId: context.userId,
      organizationId: context.organizationId,
      targetUserId,
      details: details || {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'medium'
    });
  }

  async emitUserUpdated(
    context: AuditEventContext,
    targetUserId: string,
    oldValues?: any,
    newValues?: any,
    details?: any
  ): Promise<void> {
    await this.emit({
      type: 'user_management',
      action: 'user_updated',
      userId: context.userId,
      organizationId: context.organizationId,
      targetUserId,
      oldValues,
      newValues,
      details: details || {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'medium'
    });
  }

  async emitUserDeleted(context: AuditEventContext, targetUserId: string, details?: any): Promise<void> {
    await this.emit({
      type: 'user_management',
      action: 'user_deleted',
      userId: context.userId,
      organizationId: context.organizationId,
      targetUserId,
      adminAction: true,
      adminUserId: context.userId,
      details: details || {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'high'
    });
  }

  async emitUserInvited(
    context: AuditEventContext,
    email: string,
    organizationId: string,
    details?: any
  ): Promise<void> {
    await this.emit({
      type: 'user_management',
      action: 'user_invited',
      userId: context.userId,
      organizationId,
      details: {
        email,
        organizationId,
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'low'
    });
  }

  async emitUserRemovedFromOrganization(
    context: AuditEventContext,
    targetUserId: string,
    organizationId: string,
    details?: any
  ): Promise<void> {
    await this.emit({
      type: 'user_management',
      action: 'user_removed_from_organization',
      userId: context.userId,
      organizationId,
      targetUserId,
      adminAction: true,
      adminUserId: context.userId,
      details: {
        organizationId,
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'high'
    });
  }

  // ============================================================================
  // Organization Management Events
  // ============================================================================

  async emitOrganizationCreated(context: AuditEventContext, organizationId: string, details?: any): Promise<void> {
    await this.emit({
      type: 'organization_management',
      action: 'organization_created',
      userId: context.userId,
      organizationId,
      targetResourceId: organizationId,
      targetResourceType: 'organization',
      details: details || {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'medium'
    });
  }

  async emitOrganizationUpdated(
    context: AuditEventContext,
    organizationId: string,
    oldValues?: any,
    newValues?: any,
    details?: any
  ): Promise<void> {
    await this.emit({
      type: 'organization_management',
      action: 'organization_updated',
      userId: context.userId,
      organizationId,
      targetResourceId: organizationId,
      targetResourceType: 'organization',
      oldValues,
      newValues,
      details: details || {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'medium'
    });
  }

  async emitOrganizationDeleted(context: AuditEventContext, organizationId: string, details?: any): Promise<void> {
    await this.emit({
      type: 'organization_management',
      action: 'organization_deleted',
      userId: context.userId,
      organizationId,
      targetResourceId: organizationId,
      targetResourceType: 'organization',
      adminAction: true,
      adminUserId: context.userId,
      details: details || {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'critical'
    });
  }

  // ============================================================================
  // Resource Management Events
  // ============================================================================

  async emitResourceCreated(
    context: AuditEventContext,
    resourceType: string,
    resourceId: string,
    details?: any
  ): Promise<void> {
    await this.emit({
      type: 'resource_management',
      action: 'resource_created',
      userId: context.userId,
      organizationId: context.organizationId,
      targetResourceId: resourceId,
      targetResourceType: resourceType,
      details: {
        resourceType,
        resourceId,
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'low'
    });
  }

  async emitResourceUpdated(
    context: AuditEventContext,
    resourceType: string,
    resourceId: string,
    oldValues?: any,
    newValues?: any,
    details?: any
  ): Promise<void> {
    await this.emit({
      type: 'resource_management',
      action: 'resource_updated',
      userId: context.userId,
      organizationId: context.organizationId,
      targetResourceId: resourceId,
      targetResourceType: resourceType,
      oldValues,
      newValues,
      details: {
        resourceType,
        resourceId,
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'low'
    });
  }

  async emitResourceDeleted(
    context: AuditEventContext,
    resourceType: string,
    resourceId: string,
    details?: any
  ): Promise<void> {
    await this.emit({
      type: 'resource_management',
      action: 'resource_deleted',
      userId: context.userId,
      organizationId: context.organizationId,
      targetResourceId: resourceId,
      targetResourceType: resourceType,
      details: {
        resourceType,
        resourceId,
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'medium'
    });
  }

  async emitResourceExported(
    context: AuditEventContext,
    resourceType: string,
    recordCount: number,
    details?: any
  ): Promise<void> {
    await this.emit({
      type: 'resource_management',
      action: 'resource_exported',
      userId: context.userId,
      organizationId: context.organizationId,
      targetResourceType: resourceType,
      details: {
        resourceType,
        recordCount,
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity: 'medium'
    });
  }

  // ============================================================================
  // System Operation Events
  // ============================================================================

  async emitSystemOperation(
    context: AuditEventContext,
    operation: string,
    details: any,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    await this.emit({
      type: 'system_operation',
      action: operation,
      userId: context.userId,
      organizationId: 'system', // Special system organization
      adminAction: true,
      adminUserId: context.userId,
      details: {
        operation,
        ...details
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
      severity
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Create context from Express request
   */
  createContextFromRequest(req: any): AuditEventContext {
    const user = req.user;
    const tenant = req.tenant;
    
    return {
      userId: user?.id,
      organizationId: tenant?.organizationId,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method,
      requestId: req.id,
      sessionId: req.sessionId
    };
  }

  /**
   * Get consumer statistics
   */
  getConsumerStats(): Array<{ name: string; enabled: boolean }> {
    return Array.from(this.consumers.values()).map(consumer => ({
      name: consumer.name,
      enabled: consumer.isEnabled()
    }));
  }

  /**
   * Disable all consumers (for testing)
   */
  disableAllConsumers(): void {
    this.consumers.clear();
    this.eventEmitter.removeAllListeners();
  }
}

// Export singleton instance
export const auditEventService = AuditEventService.getInstance();