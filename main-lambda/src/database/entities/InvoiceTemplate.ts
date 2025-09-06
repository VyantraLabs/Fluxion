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
import { User } from './User';
import { BlockchainNetwork } from './BlockchainNetwork';
import { Token } from './Token';
import { Invoice } from './Invoice';

export interface CustomField {
  name: string;
  type: 'text' | 'number' | 'date' | 'select';
  required: boolean;
  options?: string[];
  defaultValue?: any;
  placeholder?: string;
}

export interface BrandingConfig {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  website?: string;
}

export interface TemplateConfiguration {
  customFields?: CustomField[];
  branding?: BrandingConfig;
  paymentInstructions?: string;
  terms?: string;
  footer?: string;
  autoReminders?: boolean;
  reminderIntervals?: number[]; // Days before due date
  requireClientEmail?: boolean;
  allowPartialPayments?: boolean;
  showPaymentProgress?: boolean;
}

@Entity('invoice_templates')
@Index(['organizationId'])
@Index(['createdBy'])
@Index(['organizationId', 'isActive'])
@Index(['name', 'organizationId'], { unique: true })
@Check('name_length', 'LENGTH(name) >= 1')
export class InvoiceTemplate {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'organization_id', type: 'varchar', nullable: false })
  organizationId!: string;

  @Column({ name: 'created_by', type: 'varchar', nullable: false })
  createdBy!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Template defaults
  @Column({ name: 'default_title', type: 'varchar', length: 255, nullable: true })
  defaultTitle?: string;

  @Column({ name: 'default_description', type: 'text', nullable: true })
  defaultDescription?: string;

  @Column({ name: 'default_due_days', type: 'integer', default: 30 })
  defaultDueDays!: number;

  @Column({ name: 'default_chain_id', type: 'integer', nullable: true })
  defaultChainId?: number;

  @Column({ name: 'default_token_id', type: 'varchar', nullable: true })
  defaultTokenId?: string;

  // Template configuration
  @Column({ type: 'jsonb', default: {}, nullable: false })
  configuration!: TemplateConfiguration;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'usage_count', type: 'integer', default: 0 })
  usageCount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.invoiceTemplates, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => User, user => user.invoiceTemplates, {
    nullable: false,
  })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @ManyToOne(() => BlockchainNetwork, { nullable: true })
  @JoinColumn({ name: 'default_chain_id' })
  defaultNetwork?: BlockchainNetwork;

  @ManyToOne(() => Token, { nullable: true })
  @JoinColumn({ name: 'default_token_id' })
  defaultToken?: Token;

  @OneToMany(() => Invoice, invoice => invoice.template)
  invoices!: Invoice[];

  // Computed properties
  get hasCustomFields(): boolean {
    return !!(this.configuration?.customFields?.length);
  }

  get hasBranding(): boolean {
    return !!(this.configuration?.branding);
  }

  get requiresClientEmail(): boolean {
    return this.configuration?.requireClientEmail ?? false;
  }

  get allowsPartialPayments(): boolean {
    return this.configuration?.allowPartialPayments ?? true;
  }

  get autoRemindersEnabled(): boolean {
    return this.configuration?.autoReminders ?? false;
  }

  // Methods
  incrementUsage(): void {
    this.usageCount += 1;
  }

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }

  updateConfiguration(config: Partial<TemplateConfiguration>): void {
    this.configuration = { ...this.configuration, ...config };
  }

  addCustomField(field: CustomField): void {
    if (!this.configuration.customFields) {
      this.configuration.customFields = [];
    }
    this.configuration.customFields.push(field);
  }

  removeCustomField(fieldName: string): void {
    if (this.configuration.customFields) {
      this.configuration.customFields = this.configuration.customFields.filter(
        field => field.name !== fieldName
      );
    }
  }

  setBranding(branding: BrandingConfig): void {
    this.configuration = {
      ...this.configuration,
      branding: { ...this.configuration.branding, ...branding }
    };
  }

  // Static validation methods
  static validateName(name: string): boolean {
    return name.trim().length >= 1 && name.length <= 255;
  }

  static validateDueDays(days: number): boolean {
    return Number.isInteger(days) && days >= 0 && days <= 365;
  }

  static validateCustomFields(fields: CustomField[]): string[] {
    const errors: string[] = [];
    const names = new Set<string>();

    fields.forEach((field, index) => {
      if (!field.name || field.name.trim().length === 0) {
        errors.push(`Custom field at index ${index} must have a name`);
      }

      if (names.has(field.name)) {
        errors.push(`Duplicate custom field name: ${field.name}`);
      }
      names.add(field.name);

      if (!['text', 'number', 'date', 'select'].includes(field.type)) {
        errors.push(`Invalid field type for ${field.name}: ${field.type}`);
      }

      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        errors.push(`Select field ${field.name} must have options`);
      }
    });

    return errors;
  }

  // JSON serialization
  toJSON() {
    const { deletedAt, ...rest } = this;
    return {
      ...rest,
      hasCustomFields: this.hasCustomFields,
      hasBranding: this.hasBranding,
      requiresClientEmail: this.requiresClientEmail,
      allowsPartialPayments: this.allowsPartialPayments,
      autoRemindersEnabled: this.autoRemindersEnabled,
    };
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}