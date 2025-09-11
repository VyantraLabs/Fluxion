import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { ulid } from 'ulid';
import { Organization } from './Organization';
import { User } from './User';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT';

@Entity('audit_logs')
@Index(['organizationId'])
@Index(['userId'])
@Index(['tableName'])
@Index(['recordId'])
@Index(['action'])
@Index(['createdAt'])
@Index(['ipAddress'])
export class AuditLog {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'organization_id', type: 'varchar', nullable: false })
  organizationId!: string;

  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId?: string;

  // Audit details
  @Column({ name: 'table_name', type: 'varchar', length: 100, nullable: false })
  tableName!: string;

  @Column({ name: 'record_id', type: 'varchar', nullable: false })
  recordId!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  action!: AuditAction;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues?: any;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues?: any;

  // Request metadata
  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  // Admin tracking fields
  @Column({ name: 'admin_action', type: 'boolean', default: false })
  adminAction!: boolean;

  @Column({ name: 'admin_user_id', type: 'varchar', length: 255, nullable: true })
  adminUserId?: string;

  @Column({ name: 'severity_level', type: 'varchar', length: 20, default: 'low' })
  severityLevel!: 'low' | 'medium' | 'high' | 'critical';

  @Column({ type: 'jsonb', default: {}, nullable: false })
  metadata!: {
    endpoint?: string;
    method?: string;
    statusCode?: number;
    responseTime?: number;
    requestId?: string;
    sessionId?: string;
    apiKey?: string;
    source?: 'web' | 'api' | 'mobile' | 'system';
    reason?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.auditLogs, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => User, user => user.auditLogs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // Computed properties
  get displayAction(): string {
    const actionMap: Record<AuditAction, string> = {
      'CREATE': 'Created',
      'UPDATE': 'Updated',
      'DELETE': 'Deleted',
      'LOGIN': 'Logged In',
      'LOGOUT': 'Logged Out',
      'EXPORT': 'Exported',
      'IMPORT': 'Imported',
    };
    return actionMap[this.action] || this.action;
  }

  get displayTableName(): string {
    return this.tableName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  get userDisplayName(): string {
    return this.user?.displayName || 'System';
  }

  get shortIpAddress(): string | null {
    if (!this.ipAddress) return null;
    // For IPv4, show as is. For IPv6, show compressed format
    return this.ipAddress.toString();
  }

  get isHighRisk(): boolean {
    const highRiskActions = ['DELETE', 'EXPORT'];
    const highRiskTables = ['users', 'organization_settings', 'audit_logs'];
    
    return (
      this.adminAction ||
      highRiskActions.includes(this.action) ||
      highRiskTables.includes(this.tableName) ||
      this.severityLevel === 'high' ||
      this.severityLevel === 'critical' ||
      this.metadata?.severity === 'high' ||
      this.metadata?.severity === 'critical'
    );
  }

  get age(): number {
    return Date.now() - this.createdAt.getTime();
  }

  get ageInHours(): number {
    return Math.floor(this.age / (1000 * 60 * 60));
  }

  get ageInDays(): number {
    return Math.floor(this.age / (1000 * 60 * 60 * 24));
  }

  // Methods
  toJSON() {
    return {
      ...this,
      displayAction: this.displayAction,
      displayTableName: this.displayTableName,
      userDisplayName: this.userDisplayName,
      shortIpAddress: this.shortIpAddress,
      isHighRisk: this.isHighRisk,
      age: this.age,
      ageInHours: this.ageInHours,
      ageInDays: this.ageInDays,
    };
  }

  getChanges(): Array<{ field: string; oldValue: any; newValue: any }> {
    if (!this.oldValues || !this.newValues) return [];

    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    
    // Find changed fields
    const allFields = new Set([
      ...Object.keys(this.oldValues || {}),
      ...Object.keys(this.newValues || {}),
    ]);

    allFields.forEach(field => {
      const oldValue = this.oldValues?.[field];
      const newValue = this.newValues?.[field];
      
      if (oldValue !== newValue) {
        changes.push({
          field,
          oldValue,
          newValue,
        });
      }
    });

    return changes;
  }

  getSummary(): string {
    const userName = this.userDisplayName;
    const action = this.displayAction.toLowerCase();
    const table = this.displayTableName.toLowerCase();
    
    switch (this.action) {
      case 'CREATE':
        return `${userName} created a new ${table}`;
      case 'UPDATE':
        return `${userName} updated ${table}`;
      case 'DELETE':
        return `${userName} deleted ${table}`;
      case 'LOGIN':
        return `${userName} logged in`;
      case 'LOGOUT':
        return `${userName} logged out`;
      case 'EXPORT':
        return `${userName} exported ${table} data`;
      case 'IMPORT':
        return `${userName} imported ${table} data`;
      default:
        return `${userName} performed ${action} on ${table}`;
    }
  }

  // Static methods
  static createForEntity<T extends { id: string }>(
    organizationId: string,
    userId: string | undefined,
    tableName: string,
    entity: T,
    action: AuditAction,
    oldValues?: any,
    metadata?: any
  ): Partial<AuditLog> {
    return {
      organizationId,
      userId,
      tableName,
      recordId: entity.id,
      action,
      oldValues,
      newValues: action !== 'DELETE' ? entity : undefined,
      metadata: metadata || {},
    };
  }

  static createForLogin(
    organizationId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: any
  ): Partial<AuditLog> {
    return {
      organizationId,
      userId,
      tableName: 'users',
      recordId: userId,
      action: 'LOGIN',
      ipAddress,
      userAgent,
      metadata: {
        ...metadata,
        source: 'web',
        severity: 'low',
      },
    };
  }

  static createForExport(
    organizationId: string,
    userId: string,
    tableName: string,
    recordCount: number,
    metadata?: any
  ): Partial<AuditLog> {
    return {
      organizationId,
      userId,
      tableName,
      recordId: organizationId, // Use organization ID as record ID for exports
      action: 'EXPORT',
      severityLevel: 'medium',
      metadata: {
        ...metadata,
        recordCount,
        severity: 'medium',
      },
    };
  }

  static createForAdminAction(
    organizationId: string,
    adminUserId: string,
    targetUserId: string | undefined,
    tableName: string,
    recordId: string,
    action: AuditAction,
    severityLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    oldValues?: any,
    newValues?: any,
    metadata?: any
  ): Partial<AuditLog> {
    return {
      organizationId,
      userId: targetUserId,
      tableName,
      recordId,
      action,
      adminAction: true,
      adminUserId,
      severityLevel,
      oldValues,
      newValues,
      metadata: {
        ...metadata,
        adminOperation: true,
        severity: severityLevel,
      },
    };
  }

  static createForSystemOperation(
    adminUserId: string,
    operation: string,
    details: any,
    severityLevel: 'low' | 'medium' | 'high' | 'critical' = 'high',
    metadata?: any
  ): Partial<AuditLog> {
    return {
      organizationId: 'system', // Special organization ID for system operations
      userId: adminUserId,
      tableName: 'system_operations',
      recordId: operation,
      action: 'UPDATE',
      adminAction: true,
      adminUserId,
      severityLevel,
      newValues: details,
      metadata: {
        ...metadata,
        systemOperation: true,
        operation,
        severity: severityLevel,
      },
    };
  }

  static validateAction(action: string): action is AuditAction {
    return ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT'].includes(action);
  }

  static validateTableName(tableName: string): boolean {
    const validTables = [
      'organizations',
      'users',
      'blockchain_networks',
      'tokens',
      'smart_contracts',
      'invoices',
      'payments',
      'payroll_batches',
      'payroll_recipients',
      'organization_settings',
    ];
    
    return validTables.includes(tableName);
  }

  // Query helpers for common audit log searches
  static getRecentActivityQuery(hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return { where: { createdAt: { $gte: cutoff } } }!;
  }

  static getHighRiskActivityQuery() {
    return {
      where: {
        $or: [
          { action: { $in: ['DELETE', 'EXPORT'] } },
          { 'metadata.severity': { $in: ['high', 'critical'] } },
        ],
      },
    };
  }

  static getUserActivityQuery(userId: string) {
    return { where: { userId } }!;
  }

  static getTableActivityQuery(tableName: string) {
    return { where: { tableName } }!;
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}