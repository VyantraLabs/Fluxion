import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  Check,
} from 'typeorm';
import { ulid } from 'ulid';
import { Template } from './Template';

@Entity('template_categories')
@Index(['slug'], { unique: true })
@Index(['sortOrder'])
@Index(['isSystem'])
@Check('name_length', 'LENGTH(name) >= 1 AND LENGTH(name) <= 100')
@Check('slug_format', 'slug ~* \'^[a-z0-9-]+$\'')
@Check('color_format', 'color IS NULL OR color ~* \'^#[0-9A-Fa-f]{6}$\'')
export class TemplateCategory {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 100, nullable: false, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string;

  @Column({ type: 'varchar', length: 7, nullable: true, comment: 'Hex color code for category theming' })
  color?: string;

  @Column({ name: 'sort_order', type: 'integer', default: 0, nullable: false })
  sortOrder!: number;

  @Column({ name: 'is_system', type: 'boolean', default: false, nullable: false, comment: 'Whether this is a system-defined category' })
  isSystem!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true, nullable: false })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => Template, template => template.category)
  templates!: Template[];

  // Computed properties
  get templateCount(): number {
    return this.templates?.length ?? 0;
  }

  get isCustom(): boolean {
    return !this.isSystem;
  }

  // Methods
  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }

  updateSortOrder(order: number): void {
    this.sortOrder = Math.max(0, Math.floor(order));
  }

  // Static validation methods
  static validateSlug(slug: string): boolean {
    return /^[a-z0-9-]+$/.test(slug) && slug.length >= 1 && slug.length <= 100;
  }

  static validateColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  static validateName(name: string): boolean {
    return name.trim().length >= 1 && name.length <= 100;
  }

  // Predefined system categories
  static readonly SYSTEM_CATEGORIES = {
    INVOICES: {
      id: '01HZ0000000000000000000001',
      name: 'Invoices',
      slug: 'invoices',
      description: 'Standard business invoices for services and products',
      icon: 'FileText',
      color: '#3B82F6',
    },
    PAYSLIPS: {
      id: '01HZ0000000000000000000002',
      name: 'Payslips',
      slug: 'payslips',
      description: 'Employee salary and payment slips',
      icon: 'CreditCard',
      color: '#10B981',
    },
    REMINDERS: {
      id: '01HZ0000000000000000000003',
      name: 'Reminders',
      slug: 'reminders',
      description: 'Payment reminder and follow-up templates',
      icon: 'Bell',
      color: '#F59E0B',
    },
    RECEIPTS: {
      id: '01HZ0000000000000000000004',
      name: 'Receipts',
      slug: 'receipts',
      description: 'Payment confirmation and receipt templates',
      icon: 'CheckCircle',
      color: '#8B5CF6',
    },
    ESTIMATES: {
      id: '01HZ0000000000000000000005',
      name: 'Estimates',
      slug: 'estimates',
      description: 'Project estimates and quotes',
      icon: 'Calculator',
      color: '#EF4444',
    },
    CONTRACTS: {
      id: '01HZ0000000000000000000006',
      name: 'Contracts',
      slug: 'contracts',
      description: 'Service agreements and contract templates',
      icon: 'FileSignature',
      color: '#6B7280',
    },
  } as const;

  // JSON serialization
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      slug: this.slug,
      icon: this.icon,
      color: this.color,
      sortOrder: this.sortOrder,
      isSystem: this.isSystem,
      isActive: this.isActive,
      templateCount: this.templateCount,
      isCustom: this.isCustom,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}