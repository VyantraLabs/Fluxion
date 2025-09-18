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
exports.User = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const Organization_1 = require("./Organization");
const Invoice_1 = require("./Invoice");
const PayrollBatch_1 = require("./PayrollBatch");
const AuditLog_1 = require("./AuditLog");
const Template_1 = require("./Template");
const NotificationSettings_1 = require("./NotificationSettings");
const UserRole_1 = require("./UserRole");
let User = class User {
    // Computed properties
    get fullName() {
        if (!this.firstName && !this.lastName)
            return null;
        return [this.firstName, this.lastName].filter(Boolean).join(' ');
    }
    get displayName() {
        return this.fullName || this.email;
    }
    // RBAC-based permission methods (to be populated by RBAC service)
    // These will be computed based on user's roles and permissions
    // Use RBACService.hasPermission() or similar methods instead of these getters
    // Methods
    toJSON() {
        // SECURITY: Remove sensitive data from API responses
        // These should only be available via JWT tokens, not API responses
        const { deletedAt, organizationId, // Sensitive - use tenant context instead
        ...safeData } = this;
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
    updateLastLogin() {
        this.lastLoginAt = new Date();
    }
    // RBAC-based access management is now handled via UserRole entities
    // Use RBACService.assignRole() and RBACService.removeRole() instead
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
    // Static validation methods
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    static validateWalletAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], User.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 320, nullable: false }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'wallet_address', type: 'varchar', length: 42, nullable: true }),
    __metadata("design:type", String)
], User.prototype, "walletAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'first_name', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], User.prototype, "firstName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_name', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], User.prototype, "lastName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_verified', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "emailVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_login_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "lastLoginAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, organization => organization.users, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Organization_1.Organization)
], User.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Invoice_1.Invoice, invoice => invoice.createdByUser),
    __metadata("design:type", Array)
], User.prototype, "invoices", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PayrollBatch_1.PayrollBatch, batch => batch.createdByUser),
    __metadata("design:type", Array)
], User.prototype, "payrollBatches", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => AuditLog_1.AuditLog, auditLog => auditLog.user),
    __metadata("design:type", Array)
], User.prototype, "auditLogs", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Template_1.Template, template => template.organization),
    __metadata("design:type", Array)
], User.prototype, "templates", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => NotificationSettings_1.NotificationSettings, settings => settings.user, { cascade: true }),
    __metadata("design:type", Array)
], User.prototype, "notificationSettings", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UserRole_1.UserRole, userRole => userRole.user, { cascade: true }),
    __metadata("design:type", Array)
], User.prototype, "userRoles", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], User.prototype, "generateId", null);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('users'),
    (0, typeorm_1.Index)(['email', 'organizationId'], { unique: true }),
    (0, typeorm_1.Index)(['walletAddress']),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Check)('wallet_format', "wallet_address ~* '^0x[a-fA-F0-9]{40}$' OR wallet_address IS NULL")
], User);
//# sourceMappingURL=User.js.map