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
import { UserRole } from './UserRole';
import { RolePermission } from './RolePermission';

export enum RoleType {
  SYSTEM = 'system',      // System-wide roles (cross-tenant)
  ORGANIZATION = 'organization'  // Organization-scoped roles
}

export enum SystemRoleKey {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin', 
  SUPPORT = 'support'
}

export enum OrganizationRoleKey {
  OWNER = 'owner',
  ORG_ADMIN = 'org_admin',
  MANAGER = 'manager', 
  MEMBER = 'member',
  VIEWER = 'viewer',
  CLIENT = 'client'
}

@Entity('roles')
@Index(['key', 'type'], { unique: true })
@Index(['type'])
export class Role {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  key!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: RoleType,
    nullable: false,
  })
  type!: RoleType;

  @Column({ name: 'is_system_role', type: 'boolean', default: false })
  isSystemRole!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'integer', default: 0 })
  priority!: number; // Higher number = higher priority

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Relations
  @OneToMany(() => UserRole, userRole => userRole.role)
  userRoles!: UserRole[];

  @OneToMany(() => RolePermission, rolePermission => rolePermission.role, { cascade: true })
  permissions!: RolePermission[];

  // Computed properties
  get isSystemAdmin(): boolean {
    return this.key === SystemRoleKey.SUPER_ADMIN || this.key === SystemRoleKey.ADMIN;
  }

  get canCrossOrganizations(): boolean {
    return this.type === RoleType.SYSTEM;
  }

  // Methods
  toJSON() {
    const { deletedAt, ...rest } = this;
    return {
      ...rest,
      isSystemAdmin: this.isSystemAdmin,
      canCrossOrganizations: this.canCrossOrganizations,
    };
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }

  // Static methods
  static isValidSystemRole(key: string): key is SystemRoleKey {
    return Object.values(SystemRoleKey).includes(key as SystemRoleKey);
  }

  static isValidOrganizationRole(key: string): key is OrganizationRoleKey {
    return Object.values(OrganizationRoleKey).includes(key as OrganizationRoleKey);
  }

  static getDefaultPermissionsForRole(key: string): string[] {
    const permissionMap: Record<string, string[]> = {
      // System roles
      [SystemRoleKey.SUPER_ADMIN]: [
        'system:*',
        'org:*', 
        'invoice:*',
        'payment:*',
        'user:*',
        'reports:*'
      ],
      [SystemRoleKey.ADMIN]: [
        'system:networks',
        'system:tokens',
        'system:settings',
        'system:audit',
        'system:cross_tenant'
      ],
      [SystemRoleKey.SUPPORT]: [
        'invoice:read_all',
        'payment:read',
        'user:read',
        'reports:view',
        'system:cross_tenant'
      ],
      
      // Organization roles
      [OrganizationRoleKey.OWNER]: [
        'org:*',
        'user:*', 
        'invoice:*',
        'payment:*',
        'reports:*'
      ],
      [OrganizationRoleKey.ORG_ADMIN]: [
        'org:settings',
        'org:branding',
        'user:invite',
        'user:manage',
        'invoice:*',
        'payment:*',
        'reports:view'
      ],
      [OrganizationRoleKey.MANAGER]: [
        'invoice:create',
        'invoice:read_all',
        'invoice:update',
        'invoice:send',
        'payment:initiate',
        'payment:verify',
        'reports:view'
      ],
      [OrganizationRoleKey.MEMBER]: [
        'invoice:create',
        'invoice:read',
        'invoice:update',
        'invoice:send',
        'payment:initiate'
      ],
      [OrganizationRoleKey.VIEWER]: [
        'invoice:read',
        'payment:read'
      ],
      [OrganizationRoleKey.CLIENT]: [
        'invoice:read',
        'payment:initiate'
      ]
    };
    
    return permissionMap[key] || [];
  }
}