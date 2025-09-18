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
import { Role } from './Role';
import { Permission } from './Permission';

@Entity('role_permissions')
@Index(['roleId', 'permissionId'], { unique: true })
@Index(['roleId'])
@Index(['permissionId'])
export class RolePermission {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'role_id', type: 'varchar', nullable: false })
  roleId!: string;

  @Column({ name: 'permission_id', type: 'varchar', nullable: false })
  permissionId!: string;

  @Column({ name: 'granted_by', type: 'varchar', nullable: true })
  grantedBy?: string;

  @Column({ name: 'granted_at', type: 'timestamptz', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  grantedAt!: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Relations
  @ManyToOne(() => Role, role => role.permissions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @ManyToOne(() => Permission, permission => permission.rolePermissions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permission_id' })
  permission!: Permission;

  // Computed properties
  get isValid(): boolean {
    return this.isActive && !this.deletedAt;
  }

  // Methods
  toJSON() {
    const { deletedAt, ...rest } = this;
    return {
      ...rest,
      isValid: this.isValid,
    };
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }

  // Static methods
  static create(roleId: string, permissionId: string, grantedBy?: string): RolePermission {
    const rolePermission = new RolePermission();
    rolePermission.roleId = roleId;
    rolePermission.permissionId = permissionId;
    rolePermission.grantedBy = grantedBy;
    rolePermission.grantedAt = new Date();
    rolePermission.isActive = true;
    return rolePermission;
  }
}