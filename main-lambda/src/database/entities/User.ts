import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  JoinColumn,
  Check,
  BeforeInsert,
} from 'typeorm';
import { ulid } from 'ulid';
import { Organization } from './Organization';
import { Invoice } from './Invoice';
import { PayrollBatch } from './PayrollBatch';
import { AuditLog } from './AuditLog';
import { Template } from './Template';
import { NotificationSettings } from './NotificationSettings';
import { UserRole } from './UserRole';


@Entity('users')
@Index(['email', 'organizationId'], { unique: true })
@Index(['walletAddress'])
@Index(['organizationId'])
@Check('wallet_format', "wallet_address ~* '^0x[a-fA-F0-9]{40}$' OR wallet_address IS NULL")
export class User {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'organization_id', type: 'varchar', nullable: false })
  organizationId!: string;

  @Column({ type: 'varchar', length: 320, nullable: false })
  email!: string;

  @Column({ name: 'wallet_address', type: 'varchar', length: 42, nullable: true })
  walletAddress?: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName?: string;


  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;


  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.users, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @OneToMany(() => Invoice, invoice => invoice.createdByUser)
  invoices!: Invoice[];

  @OneToMany(() => PayrollBatch, batch => batch.createdByUser)
  payrollBatches!: PayrollBatch[];

  @OneToMany(() => AuditLog, auditLog => auditLog.user)
  auditLogs!: AuditLog[];

  @OneToMany(() => Template, template => template.organization)
  templates!: Template[];

  @OneToMany(() => NotificationSettings, settings => settings.user, { cascade: true })
  notificationSettings!: NotificationSettings[];

  @OneToMany(() => UserRole, userRole => userRole.user, { cascade: true })
  userRoles!: UserRole[];

  // Computed properties
  get fullName(): string | null {
    if (!this.firstName && !this.lastName) return null;
    return [this.firstName, this.lastName].filter(Boolean).join(' ');
  }

  get displayName(): string {
    return this.fullName || this.email;
  }

  // RBAC-based permission methods (to be populated by RBAC service)
  // These will be computed based on user's roles and permissions
  // Use RBACService.hasPermission() or similar methods instead of these getters

  // Methods
  toJSON() {
    // SECURITY: Remove sensitive data from API responses
    // These should only be available via JWT tokens, not API responses
    const { 
      deletedAt, 
      organizationId, // Sensitive - use tenant context instead
      ...safeData 
    } = this;
    
    return {
      ...safeData,
      fullName: this.fullName,
      displayName: this.displayName,
      // Permissions are now computed via RBAC service and included in JWT tokens
    };
  }

  // Secure method for admin contexts only (never exposed in API responses)
  toAdminJSON() {
    const { deletedAt, ...rest } = this;
    return {
      ...rest,
      fullName: this.fullName,
      displayName: this.displayName,
      // Permissions are now computed via RBAC service
      // Use RBACService.getUserPermissions(userId) to get permissions
    };
  }

  // Update last login timestamp
  updateLastLogin(): void {
    this.lastLoginAt = new Date();
  }

  // RBAC-based access management is now handled via UserRole entities
  // Use RBACService.assignRole() and RBACService.removeRole() instead

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }

  // Static validation methods
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateWalletAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

}