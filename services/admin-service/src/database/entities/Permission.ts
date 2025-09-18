import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ulid } from 'ulid';
import { RolePermission } from './RolePermission';

export enum PermissionCategory {
  INVOICE = 'invoice',
  PAYMENT = 'payment',
  USER = 'user',
  ORGANIZATION = 'organization',
  REPORTS = 'reports',
  SYSTEM = 'system'
}

@Entity('permissions')
@Index(['key'], { unique: true })
@Index(['category'])
export class Permission {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: false })
  key!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: PermissionCategory,
    nullable: false,
  })
  category!: PermissionCategory;

  @Column({ name: 'is_system_permission', type: 'boolean', default: false })
  isSystemPermission!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Relations
  @OneToMany(() => RolePermission, rolePermission => rolePermission.permission)
  rolePermissions!: RolePermission[];

  // Methods
  toJSON() {
    const { deletedAt, ...rest } = this;
    return rest;
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }

  // Static methods for permission validation
  static parsePermissionKey(key: string): { resource: string; action: string } {
    const [resource, action] = key.split(':');
    return { resource, action };
  }

  static isWildcardPermission(key: string): boolean {
    return key.endsWith(':*');
  }

  static matchesWildcard(permission: string, userPermission: string): boolean {
    if (!this.isWildcardPermission(userPermission)) {
      return permission === userPermission;
    }
    
    const wildcardBase = userPermission.replace(':*', '');
    return permission.startsWith(wildcardBase + ':');
  }

  static getDefaultPermissions(): Array<{
    key: string;
    name: string;
    description: string;
    category: PermissionCategory;
    isSystemPermission: boolean;
  }> {
    return [
      // Invoice permissions
      {
        key: 'invoice:create',
        name: 'Create Invoices',
        description: 'Create new invoices',
        category: PermissionCategory.INVOICE,
        isSystemPermission: false
      },
      {
        key: 'invoice:read',
        name: 'Read Own Invoices',
        description: 'View invoices created by user',
        category: PermissionCategory.INVOICE,
        isSystemPermission: false
      },
      {
        key: 'invoice:read_all',
        name: 'Read All Invoices',
        description: 'View all invoices in organization',
        category: PermissionCategory.INVOICE,
        isSystemPermission: false
      },
      {
        key: 'invoice:update',
        name: 'Update Invoices',
        description: 'Modify existing invoices',
        category: PermissionCategory.INVOICE,
        isSystemPermission: false
      },
      {
        key: 'invoice:delete',
        name: 'Delete Invoices',
        description: 'Remove invoices',
        category: PermissionCategory.INVOICE,
        isSystemPermission: false
      },
      {
        key: 'invoice:send',
        name: 'Send Invoices',
        description: 'Send invoices to clients',
        category: PermissionCategory.INVOICE,
        isSystemPermission: false
      },
      
      // Payment permissions
      {
        key: 'payment:initiate',
        name: 'Initiate Payments',
        description: 'Process invoice payments',
        category: PermissionCategory.PAYMENT,
        isSystemPermission: false
      },
      {
        key: 'payment:verify',
        name: 'Verify Payments',
        description: 'Verify blockchain transactions',
        category: PermissionCategory.PAYMENT,
        isSystemPermission: false
      },
      {
        key: 'payment:refund',
        name: 'Process Refunds',
        description: 'Initiate payment refunds',
        category: PermissionCategory.PAYMENT,
        isSystemPermission: false
      },
      
      // User management permissions
      {
        key: 'user:invite',
        name: 'Invite Users',
        description: 'Send user invitations',
        category: PermissionCategory.USER,
        isSystemPermission: false
      },
      {
        key: 'user:manage',
        name: 'Manage Users',
        description: 'Update user profiles and settings',
        category: PermissionCategory.USER,
        isSystemPermission: false
      },
      {
        key: 'user:remove',
        name: 'Remove Users',
        description: 'Remove users from organization',
        category: PermissionCategory.USER,
        isSystemPermission: false
      },
      {
        key: 'user:assign_roles',
        name: 'Assign Roles',
        description: 'Assign roles to users',
        category: PermissionCategory.USER,
        isSystemPermission: false
      },
      
      // Organization permissions
      {
        key: 'org:settings',
        name: 'Organization Settings',
        description: 'Manage organization settings',
        category: PermissionCategory.ORGANIZATION,
        isSystemPermission: false
      },
      {
        key: 'org:branding',
        name: 'Organization Branding',
        description: 'Customize organization branding',
        category: PermissionCategory.ORGANIZATION,
        isSystemPermission: false
      },
      {
        key: 'org:integrations',
        name: 'Organization Integrations',
        description: 'Manage third-party integrations',
        category: PermissionCategory.ORGANIZATION,
        isSystemPermission: false
      },
      {
        key: 'org:billing',
        name: 'Organization Billing',
        description: 'Manage billing and subscriptions',
        category: PermissionCategory.ORGANIZATION,
        isSystemPermission: false
      },
      
      // Reports permissions
      {
        key: 'reports:view',
        name: 'View Reports',
        description: 'Access analytics and reports',
        category: PermissionCategory.REPORTS,
        isSystemPermission: false
      },
      {
        key: 'reports:export',
        name: 'Export Reports',
        description: 'Export reports and data',
        category: PermissionCategory.REPORTS,
        isSystemPermission: false
      },
      {
        key: 'analytics:financial',
        name: 'Financial Analytics',
        description: 'Access financial analytics',
        category: PermissionCategory.REPORTS,
        isSystemPermission: false
      },
      
      // System permissions
      {
        key: 'system:networks',
        name: 'Manage Networks',
        description: 'Manage blockchain networks',
        category: PermissionCategory.SYSTEM,
        isSystemPermission: true
      },
      {
        key: 'system:tokens',
        name: 'Manage Tokens',
        description: 'Manage supported tokens',
        category: PermissionCategory.SYSTEM,
        isSystemPermission: true
      },
      {
        key: 'system:settings',
        name: 'System Settings',
        description: 'Manage system configuration',
        category: PermissionCategory.SYSTEM,
        isSystemPermission: true
      },
      {
        key: 'system:audit',
        name: 'System Audit',
        description: 'Access system audit logs',
        category: PermissionCategory.SYSTEM,
        isSystemPermission: true
      },
      {
        key: 'system:cross_tenant',
        name: 'Cross-Tenant Access',
        description: 'Access data across organizations',
        category: PermissionCategory.SYSTEM,
        isSystemPermission: true
      }
    ];
  }
}