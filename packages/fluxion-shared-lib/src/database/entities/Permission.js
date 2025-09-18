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
exports.Permission = exports.PermissionCategory = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const RolePermission_1 = require("./RolePermission");
var PermissionCategory;
(function (PermissionCategory) {
    PermissionCategory["INVOICE"] = "invoice";
    PermissionCategory["PAYMENT"] = "payment";
    PermissionCategory["USER"] = "user";
    PermissionCategory["ORGANIZATION"] = "organization";
    PermissionCategory["REPORTS"] = "reports";
    PermissionCategory["SYSTEM"] = "system";
})(PermissionCategory || (exports.PermissionCategory = PermissionCategory = {}));
let Permission = class Permission {
    // Methods
    toJSON() {
        const { deletedAt, ...rest } = this;
        return rest;
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
    // Static methods for permission validation
    static parsePermissionKey(key) {
        const [resource, action] = key.split(':');
        return { resource, action };
    }
    static isWildcardPermission(key) {
        return key.endsWith(':*');
    }
    static matchesWildcard(permission, userPermission) {
        if (!this.isWildcardPermission(userPermission)) {
            return permission === userPermission;
        }
        const wildcardBase = userPermission.replace(':*', '');
        return permission.startsWith(wildcardBase + ':');
    }
    static getDefaultPermissions() {
        return [
            // Invoice permissions
            {
                key: 'invoice:create',
                name: 'Create Invoices',
                description: 'Create new invoices',
                category: PermissionCategory.INVOICE,
                isSystemPermission: false
            },
            {
                key: 'invoice:read',
                name: 'Read Own Invoices',
                description: 'View invoices created by user',
                category: PermissionCategory.INVOICE,
                isSystemPermission: false
            },
            {
                key: 'invoice:read_all',
                name: 'Read All Invoices',
                description: 'View all invoices in organization',
                category: PermissionCategory.INVOICE,
                isSystemPermission: false
            },
            {
                key: 'invoice:update',
                name: 'Update Invoices',
                description: 'Modify existing invoices',
                category: PermissionCategory.INVOICE,
                isSystemPermission: false
            },
            {
                key: 'invoice:delete',
                name: 'Delete Invoices',
                description: 'Remove invoices',
                category: PermissionCategory.INVOICE,
                isSystemPermission: false
            },
            {
                key: 'invoice:send',
                name: 'Send Invoices',
                description: 'Send invoices to clients',
                category: PermissionCategory.INVOICE,
                isSystemPermission: false
            },
            // Payment permissions
            {
                key: 'payment:initiate',
                name: 'Initiate Payments',
                description: 'Process invoice payments',
                category: PermissionCategory.PAYMENT,
                isSystemPermission: false
            },
            {
                key: 'payment:verify',
                name: 'Verify Payments',
                description: 'Verify blockchain transactions',
                category: PermissionCategory.PAYMENT,
                isSystemPermission: false
            },
            {
                key: 'payment:refund',
                name: 'Process Refunds',
                description: 'Initiate payment refunds',
                category: PermissionCategory.PAYMENT,
                isSystemPermission: false
            },
            // User management permissions
            {
                key: 'user:invite',
                name: 'Invite Users',
                description: 'Send user invitations',
                category: PermissionCategory.USER,
                isSystemPermission: false
            },
            {
                key: 'user:manage',
                name: 'Manage Users',
                description: 'Update user profiles and settings',
                category: PermissionCategory.USER,
                isSystemPermission: false
            },
            {
                key: 'user:remove',
                name: 'Remove Users',
                description: 'Remove users from organization',
                category: PermissionCategory.USER,
                isSystemPermission: false
            },
            {
                key: 'user:assign_roles',
                name: 'Assign Roles',
                description: 'Assign roles to users',
                category: PermissionCategory.USER,
                isSystemPermission: false
            },
            // Organization permissions
            {
                key: 'org:settings',
                name: 'Organization Settings',
                description: 'Manage organization settings',
                category: PermissionCategory.ORGANIZATION,
                isSystemPermission: false
            },
            {
                key: 'org:branding',
                name: 'Organization Branding',
                description: 'Customize organization branding',
                category: PermissionCategory.ORGANIZATION,
                isSystemPermission: false
            },
            {
                key: 'org:integrations',
                name: 'Organization Integrations',
                description: 'Manage third-party integrations',
                category: PermissionCategory.ORGANIZATION,
                isSystemPermission: false
            },
            {
                key: 'org:billing',
                name: 'Organization Billing',
                description: 'Manage billing and subscriptions',
                category: PermissionCategory.ORGANIZATION,
                isSystemPermission: false
            },
            // Reports permissions
            {
                key: 'reports:view',
                name: 'View Reports',
                description: 'Access analytics and reports',
                category: PermissionCategory.REPORTS,
                isSystemPermission: false
            },
            {
                key: 'reports:export',
                name: 'Export Reports',
                description: 'Export reports and data',
                category: PermissionCategory.REPORTS,
                isSystemPermission: false
            },
            {
                key: 'analytics:financial',
                name: 'Financial Analytics',
                description: 'Access financial analytics',
                category: PermissionCategory.REPORTS,
                isSystemPermission: false
            },
            // System permissions
            {
                key: 'system:networks',
                name: 'Manage Networks',
                description: 'Manage blockchain networks',
                category: PermissionCategory.SYSTEM,
                isSystemPermission: true
            },
            {
                key: 'system:tokens',
                name: 'Manage Tokens',
                description: 'Manage supported tokens',
                category: PermissionCategory.SYSTEM,
                isSystemPermission: true
            },
            {
                key: 'system:settings',
                name: 'System Settings',
                description: 'Manage system configuration',
                category: PermissionCategory.SYSTEM,
                isSystemPermission: true
            },
            {
                key: 'system:audit',
                name: 'System Audit',
                description: 'Access system audit logs',
                category: PermissionCategory.SYSTEM,
                isSystemPermission: true
            },
            {
                key: 'system:cross_tenant',
                name: 'Cross-Tenant Access',
                description: 'Access data across organizations',
                category: PermissionCategory.SYSTEM,
                isSystemPermission: true
            }
        ];
    }
};
exports.Permission = Permission;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], Permission.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, unique: true, nullable: false }),
    __metadata("design:type", String)
], Permission.prototype, "key", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], Permission.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Permission.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: PermissionCategory,
        nullable: false,
    }),
    __metadata("design:type", String)
], Permission.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_system_permission', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Permission.prototype, "isSystemPermission", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Permission.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Permission.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Permission.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', nullable: true }),
    __metadata("design:type", Date)
], Permission.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => RolePermission_1.RolePermission, rolePermission => rolePermission.permission),
    __metadata("design:type", Array)
], Permission.prototype, "rolePermissions", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Permission.prototype, "generateId", null);
exports.Permission = Permission = __decorate([
    (0, typeorm_1.Entity)('permissions'),
    (0, typeorm_1.Index)(['key'], { unique: true }),
    (0, typeorm_1.Index)(['category'])
], Permission);
//# sourceMappingURL=Permission.js.map