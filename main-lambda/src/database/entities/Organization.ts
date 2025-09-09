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
import { User } from './User';
import { Invoice } from './Invoice';
import { Payment } from './Payment';
import { PayrollBatch } from './PayrollBatch';
import { OrganizationSetting } from './OrganizationSetting';
import { AuditLog } from './AuditLog';
import { Template } from './Template';
import { NotificationQueue } from './NotificationQueue';
import { NotificationSettings } from './NotificationSettings';
import { ReminderJob } from './ReminderJob';

export type OrganizationPlan = 'basic' | 'professional' | 'enterprise';

@Entity('organizations')
@Index(['slug'], { unique: true })
export class Organization {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: false })
  slug!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'basic',
    nullable: false,
  })
  plan!: OrganizationPlan;

  @Column({ type: 'jsonb', default: {}, nullable: false })
  settings!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Relations
  @OneToMany(() => User, user => user.organization, { cascade: true })
  users!: User[];

  @OneToMany(() => Invoice, invoice => invoice.organization, { cascade: true })
  invoices!: Invoice[];

  @OneToMany(() => Payment, payment => payment.organization, { cascade: true })
  payments!: Payment[];

  @OneToMany(() => PayrollBatch, batch => batch.organization, { cascade: true })
  payrollBatches!: PayrollBatch[];

  @OneToMany(() => OrganizationSetting, setting => setting.organization, { cascade: true })
  organizationSettings!: OrganizationSetting[];

  @OneToMany(() => AuditLog, auditLog => auditLog.organization, { cascade: true })
  auditLogs!: AuditLog[];

  @OneToMany(() => Template, template => template.organization, { cascade: true })
  templates!: Template[];

  @OneToMany(() => NotificationQueue, notification => notification.organization, { cascade: true })
  notifications!: NotificationQueue[];

  @OneToMany(() => NotificationSettings, settings => settings.organization, { cascade: true })
  notificationSettings!: NotificationSettings[];

  @OneToMany(() => ReminderJob, reminder => reminder.organization, { cascade: true })
  reminderJobs!: ReminderJob[];

  // Computed properties
  get isActive(): boolean {
    return !this.deletedAt;
  }

  get isPremium(): boolean {
    return this.plan === 'professional' || this.plan === 'enterprise';
  }

  // Methods
  toJSON() {
    const { deletedAt, ...rest } = this;
    return {
      ...rest,
      isActive: this.isActive,
      isPremium: this.isPremium,
    };
  }

  // Static methods for validation
  static validateSlug(slug: string): boolean {
    return /^[a-z0-9-]+$/.test(slug);
  }

  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}