import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { ulid } from 'ulid';
import { User } from './User';
import { Role } from './Role';
import { Organization } from './Organization';

@Entity('user_roles')
@Index(['userId', 'roleId'], { unique: true })
@Index(['userId'])
@Index(['roleId'])
@Index(['organizationId'])
export class UserRole {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', nullable: false })
  userId!: string;

  @Column({ name: 'role_id', type: 'varchar', nullable: false })
  roleId!: string;

  @Column({ name: 'organization_id', type: 'varchar', nullable: true })
  organizationId?: string;

  @Column({ name: 'granted_by', type: 'varchar', nullable: true })
  grantedBy?: string;

  @Column({ name: 'granted_at', type: 'timestamptz', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  grantedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Relations
  @ManyToOne(() => User, user => user.userRoles, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Role, role => role.userRoles, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @ManyToOne(() => Organization, organization => organization.userRoles, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'granted_by' })
  grantedByUser?: User;

  // Computed properties
  get isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  get isValid(): boolean {
    return this.isActive && !this.isExpired && !this.deletedAt;
  }

  get isSystemRole(): boolean {
    return !this.organizationId;
  }

  // Methods
  toJSON() {
    const { deletedAt, ...rest } = this;
    return {
      ...rest,
      isExpired: this.isExpired,
      isValid: this.isValid,
      isSystemRole: this.isSystemRole,
    };
  }

  // Grant role with expiration
  grantRole(grantedByUserId: string, expirationDays?: number): void {
    this.grantedBy = grantedByUserId;
    this.grantedAt = new Date();
    this.isActive = true;
    
    if (expirationDays) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expirationDays);
      this.expiresAt = expirationDate;
    }
  }

  // Revoke role
  revokeRole(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  // Extend role expiration
  extendExpiration(days: number): void {
    if (this.expiresAt) {
      this.expiresAt = new Date(this.expiresAt.getTime() + days * 24 * 60 * 60 * 1000);
    } else {
      const newExpiration = new Date();
      newExpiration.setDate(newExpiration.getDate() + days);
      this.expiresAt = newExpiration;
    }
    this.updatedAt = new Date();
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }

  // Static methods
  static createSystemRole(userId: string, roleId: string, grantedBy: string): UserRole {
    const userRole = new UserRole();
    userRole.userId = userId;
    userRole.roleId = roleId;
    userRole.organizationId = undefined; // System roles are not org-scoped
    userRole.grantedBy = grantedBy;
    userRole.grantedAt = new Date();
    userRole.isActive = true;
    return userRole;
  }

  static createOrganizationRole(
    userId: string, 
    roleId: string, 
    organizationId: string, 
    grantedBy: string,
    expirationDays?: number
  ): UserRole {
    const userRole = new UserRole();
    userRole.userId = userId;
    userRole.roleId = roleId;
    userRole.organizationId = organizationId;
    userRole.grantedBy = grantedBy;
    userRole.grantedAt = new Date();
    userRole.isActive = true;
    
    if (expirationDays) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expirationDays);
      userRole.expiresAt = expirationDate;
    }
    
    return userRole;
  }
}