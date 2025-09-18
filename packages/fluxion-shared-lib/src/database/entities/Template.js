"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Template = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const Organization_1 = require("./Organization");
const TemplateCategory_1 = require("./TemplateCategory");
const Invoice_1 = require("./Invoice");
let Template = class Template {
    // Computed properties
    get isSystemTemplate() {
        return this.organizationId === null || this.organizationId === undefined;
    }
    get isOrganizationTemplate() {
        return !this.isSystemTemplate;
    }
    get hasCustomFields() {
        const config = this.content?.configuration;
        return !!(config?.customFields?.length);
    }
    get hasBranding() {
        const config = this.content?.configuration;
        return !!(config?.branding);
    }
    get categoryName() {
        return this.category?.name;
    }
    get fullS3Url() {
        if (!this.s3TemplateUrl)
            return undefined;
        const bucketUrl = process.env.S3_BUCKET_URL || process.env.AWS_S3_BUCKET_URL;
        if (!bucketUrl)
            return this.s3TemplateUrl;
        return this.s3TemplateUrl.startsWith('http') ? this.s3TemplateUrl : `${bucketUrl}/${this.s3TemplateUrl}`;
    }
    get fullPreviewImageUrl() {
        if (!this.previewImageUrl)
            return undefined;
        const bucketUrl = process.env.S3_BUCKET_URL || process.env.AWS_S3_BUCKET_URL;
        if (!bucketUrl)
            return this.previewImageUrl;
        return this.previewImageUrl.startsWith('http') ? this.previewImageUrl : `${bucketUrl}/${this.previewImageUrl}`;
    }
    // Methods
    activate() {
        this.isActive = true;
    }
    deactivate() {
        this.isActive = false;
    }
    updateContent(content) {
        this.content = { ...this.content, ...content };
    }
    setConfiguration(config) {
        this.content = {
            ...this.content,
            configuration: { ...this.content.configuration, ...config }
        };
    }
    getConfiguration() {
        return this.content?.configuration || {};
    }
    addCustomField(field) {
        const config = this.getConfiguration();
        if (!config.customFields) {
            config.customFields = [];
        }
        config.customFields.push(field);
        this.setConfiguration(config);
    }
    removeCustomField(fieldName) {
        const config = this.getConfiguration();
        if (config.customFields) {
            config.customFields = config.customFields.filter(field => field.name !== fieldName);
            this.setConfiguration(config);
        }
    }
    setBranding(branding) {
        const config = this.getConfiguration();
        config.branding = { ...config.branding, ...branding };
        this.setConfiguration(config);
    }
    // Static validation methods
    static validateName(name) {
        return name.trim().length >= 1 && name.length <= 255;
    }
    static validateCustomFields(fields) {
        const errors = [];
        const names = new Set();
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
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.Template = Template;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], Template.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'varchar', nullable: true, comment: 'NULL for system templates, set for organization-specific templates' }),
    __metadata("design:type", String)
], Template.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], Template.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: false }),
    __metadata("design:type", String)
], Template.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Template.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: false, comment: 'Template content and configuration' }),
    __metadata("design:type", Object)
], Template.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'template_type', type: 'varchar', length: 50, default: 'custom', nullable: false }),
    __metadata("design:type", String)
], Template.prototype, "templateType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 's3_template_url', type: 'varchar', length: 500, nullable: true, comment: 'Relative S3 path to HTML template file' }),
    __metadata("design:type", String)
], Template.prototype, "s3TemplateUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'preview_image_url', type: 'varchar', length: 500, nullable: true, comment: 'Relative S3 path to preview image' }),
    __metadata("design:type", String)
], Template.prototype, "previewImageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_public', type: 'boolean', default: false, nullable: false }),
    __metadata("design:type", Boolean)
], Template.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tags', type: 'varchar', array: true, nullable: true, comment: 'Array of tags for categorization' }),
    __metadata("design:type", Array)
], Template.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'variables', type: 'jsonb', default: '{}', nullable: false, comment: 'Template variables configuration' }),
    __metadata("design:type", Object)
], Template.prototype, "variables", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Template.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Template.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Template.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', nullable: true }),
    __metadata("design:type", Date)
], Template.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, organization => organization.templates, {
        nullable: true,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Organization_1.Organization)
], Template.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => TemplateCategory_1.TemplateCategory, category => category.templates, {
        nullable: false,
        onDelete: 'RESTRICT',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'category_id' }),
    __metadata("design:type", TemplateCategory_1.TemplateCategory)
], Template.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Invoice_1.Invoice, invoice => invoice.template),
    __metadata("design:type", Array)
], Template.prototype, "invoices", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Template.prototype, "generateId", null);
exports.Template = Template = __decorate([
    (0, typeorm_1.Entity)('templates'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['categoryId']),
    (0, typeorm_1.Index)(['isActive']),
    (0, typeorm_1.Index)(['organizationId', 'isActive']),
    (0, typeorm_1.Index)(['templateType']),
    (0, typeorm_1.Index)(['isPublic']),
    (0, typeorm_1.Index)(['tags'], { where: 'tags IS NOT NULL' }),
    (0, typeorm_1.Index)(['name', 'organizationId'], { unique: true, where: 'organization_id IS NOT NULL' }),
    (0, typeorm_1.Index)(['name'], { unique: true, where: 'organization_id IS NULL' }),
    (0, typeorm_1.Check)('name_length', 'LENGTH(name) >= 1 AND LENGTH(name) <= 255'),
    (0, typeorm_1.Check)('content_not_empty', 'content IS NOT NULL'),
    (0, typeorm_1.Check)('template_type_valid', 'template_type IN (\'custom\', \'system\', \'s3_based\', \'generated\')'),
    (0, typeorm_1.Check)('s3_url_format', 's3_template_url IS NULL OR s3_template_url ~* \'^(https?://.*\\.(json|html|pdf)$|templates/.*\\.(json|html|pdf)$)$\'')
], Template);
//# sourceMappingURL=Template.js.map