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
import { TemplateCategory } from './TemplateCategory';
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

@Entity('templates')
@Index(['organizationId'])
@Index(['categoryId'])
@Index(['isActive'])
@Index(['organizationId', 'isActive'])
@Index(['templateType'])
@Index(['isPublic'])
@Index(['tags'], { where: 'tags IS NOT NULL' })
@Index(['name', 'organizationId'], { unique: true, where: 'organization_id IS NOT NULL' })
@Index(['name'], { unique: true, where: 'organization_id IS NULL' })
@Check('name_length', 'LENGTH(name) >= 1 AND LENGTH(name) <= 255')
@Check('content_not_empty', 'content IS NOT NULL')
@Check('template_type_valid', 'template_type IN (\'custom\', \'system\', \'s3_based\', \'generated\')')
@Check('s3_url_format', 's3_template_url IS NULL OR s3_template_url ~* \'^(https?://.*\\.(json|html|pdf)$|templates/.*\\.(json|html|pdf)$)$\'')
export class Template {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'organization_id', type: 'varchar', nullable: true, comment: 'NULL for system templates, set for organization-specific templates' })
  organizationId?: string;

  @Column({ name: 'category_id', type: 'varchar', nullable: false })
  categoryId!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: false, comment: 'Template content and configuration' })
  content!: Record<string, any>;

  @Column({ name: 'template_type', type: 'varchar', length: 50, default: 'custom', nullable: false })
  templateType!: string;

  @Column({ name: 's3_template_url', type: 'varchar', length: 500, nullable: true, comment: 'Relative S3 path to HTML template file' })
  s3TemplateUrl?: string;

  @Column({ name: 'preview_image_url', type: 'varchar', length: 500, nullable: true, comment: 'Relative S3 path to preview image' })
  previewImageUrl?: string;

  @Column({ name: 'is_public', type: 'boolean', default: false, nullable: false })
  isPublic!: boolean;

  @Column({ name: 'tags', type: 'varchar', array: true, nullable: true, comment: 'Array of tags for categorization' })
  tags?: string[];

  @Column({ name: 'variables', type: 'jsonb', default: '{}', nullable: false, comment: 'Template variables configuration' })
  variables!: Record<string, any>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.templates, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @ManyToOne(() => TemplateCategory, category => category.templates, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category!: TemplateCategory;

  @OneToMany(() => Invoice, invoice => invoice.template)
  invoices!: Invoice[];

  // Computed properties
  get isSystemTemplate(): boolean {
    return this.organizationId === null || this.organizationId === undefined;
  }

  get isOrganizationTemplate(): boolean {
    return !this.isSystemTemplate;
  }

  get hasCustomFields(): boolean {
    const config = this.content?.configuration as TemplateConfiguration;
    return !!(config?.customFields?.length);
  }

  get hasBranding(): boolean {
    const config = this.content?.configuration as TemplateConfiguration;
    return !!(config?.branding);
  }

  get categoryName(): string | undefined {
    return this.category?.name;
  }

  get fullS3Url(): string | undefined {
    if (!this.s3TemplateUrl) return undefined;
    const bucketUrl = process.env.S3_BUCKET_URL || process.env.AWS_S3_BUCKET_URL;
    if (!bucketUrl) return this.s3TemplateUrl;
    return this.s3TemplateUrl.startsWith('http') ? this.s3TemplateUrl : `${bucketUrl}/${this.s3TemplateUrl}`;
  }

  get fullPreviewImageUrl(): string | undefined {
    if (!this.previewImageUrl) return undefined;
    const bucketUrl = process.env.S3_BUCKET_URL || process.env.AWS_S3_BUCKET_URL;
    if (!bucketUrl) return this.previewImageUrl;
    return this.previewImageUrl.startsWith('http') ? this.previewImageUrl : `${bucketUrl}/${this.previewImageUrl}`;
  }

  // Methods
  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }

  updateContent(content: Partial<Record<string, any>>): void {
    this.content = { ...this.content, ...content };
  }

  setConfiguration(config: TemplateConfiguration): void {
    this.content = {
      ...this.content,
      configuration: { ...this.content.configuration, ...config }
    };
  }

  getConfiguration(): TemplateConfiguration {
    return this.content?.configuration as TemplateConfiguration || {};
  }

  addCustomField(field: CustomField): void {
    const config = this.getConfiguration();
    if (!config.customFields) {
      config.customFields = [];
    }
    config.customFields.push(field);
    this.setConfiguration(config);
  }

  removeCustomField(fieldName: string): void {
    const config = this.getConfiguration();
    if (config.customFields) {
      config.customFields = config.customFields.filter(
        field => field.name !== fieldName
      );
      this.setConfiguration(config);
    }
  }

  setBranding(branding: BrandingConfig): void {
    const config = this.getConfiguration();
    config.branding = { ...config.branding, ...branding };
    this.setConfiguration(config);
  }

  // Static validation methods
  static validateName(name: string): boolean {
    return name.trim().length >= 1 && name.length <= 255;
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
      // Computed properties
      isSystemTemplate: this.isSystemTemplate,
      isOrganizationTemplate: this.isOrganizationTemplate,
      hasCustomFields: this.hasCustomFields,
      hasBranding: this.hasBranding,
      categoryName: this.categoryName,
      // S3 URLs - explicitly include both raw and full URLs
      s3TemplateUrl: this.s3TemplateUrl,
      previewImageUrl: this.previewImageUrl,
      fullS3Url: this.fullS3Url,
      fullPreviewImageUrl: this.fullPreviewImageUrl,
      // Include category if loaded
      category: this.category?.toJSON(),
    };
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}
