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
exports.TemplateCategory = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const Template_1 = require("./Template");
let TemplateCategory = class TemplateCategory {
    // Computed properties
    get templateCount() {
        return this.templates?.length ?? 0;
    }
    get isCustom() {
        return !this.isSystem;
    }
    // Methods
    activate() {
        this.isActive = true;
    }
    deactivate() {
        this.isActive = false;
    }
    updateSortOrder(order) {
        this.sortOrder = Math.max(0, Math.floor(order));
    }
    // Static validation methods
    static validateSlug(slug) {
        return /^[a-z0-9-]+$/.test(slug) && slug.length >= 1 && slug.length <= 100;
    }
    static validateColor(color) {
        return /^#[0-9A-Fa-f]{6}$/.test(color);
    }
    static validateName(name) {
        return name.trim().length >= 1 && name.length <= 100;
    }
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
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.TemplateCategory = TemplateCategory;
// Predefined system categories
TemplateCategory.SYSTEM_CATEGORIES = {
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
};
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], TemplateCategory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], TemplateCategory.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], TemplateCategory.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false, unique: true }),
    __metadata("design:type", String)
], TemplateCategory.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], TemplateCategory.prototype, "icon", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 7, nullable: true, comment: 'Hex color code for category theming' }),
    __metadata("design:type", String)
], TemplateCategory.prototype, "color", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sort_order', type: 'integer', default: 0, nullable: false }),
    __metadata("design:type", Number)
], TemplateCategory.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_system', type: 'boolean', default: false, nullable: false, comment: 'Whether this is a system-defined category' }),
    __metadata("design:type", Boolean)
], TemplateCategory.prototype, "isSystem", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true, nullable: false }),
    __metadata("design:type", Boolean)
], TemplateCategory.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], TemplateCategory.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], TemplateCategory.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Template_1.Template, template => template.category),
    __metadata("design:type", Array)
], TemplateCategory.prototype, "templates", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TemplateCategory.prototype, "generateId", null);
exports.TemplateCategory = TemplateCategory = __decorate([
    (0, typeorm_1.Entity)('template_categories'),
    (0, typeorm_1.Index)(['slug'], { unique: true }),
    (0, typeorm_1.Index)(['sortOrder']),
    (0, typeorm_1.Index)(['isSystem']),
    (0, typeorm_1.Check)('name_length', 'LENGTH(name) >= 1 AND LENGTH(name) <= 100'),
    (0, typeorm_1.Check)('slug_format', 'slug ~* \'^[a-z0-9-]+$\''),
    (0, typeorm_1.Check)('color_format', 'color IS NULL OR color ~* \'^#[0-9A-Fa-f]{6}$\'')
], TemplateCategory);
//# sourceMappingURL=TemplateCategory.js.map