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
exports.Organization = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const User_1 = require("./User");
const Invoice_1 = require("./Invoice");
const Payment_1 = require("./Payment");
const PayrollBatch_1 = require("./PayrollBatch");
const OrganizationSetting_1 = require("./OrganizationSetting");
const AuditLog_1 = require("./AuditLog");
const Template_1 = require("./Template");
const NotificationQueue_1 = require("./NotificationQueue");
const NotificationSettings_1 = require("./NotificationSettings");
const ReminderJob_1 = require("./ReminderJob");
const UserRole_1 = require("./UserRole");
let Organization = class Organization {
    // Computed properties
    get isActive() {
        return !this.deletedAt;
    }
    get isPremium() {
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
    static validateSlug(slug) {
        return /^[a-z0-9-]+$/.test(slug);
    }
    static generateSlug(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.Organization = Organization;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], Organization.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: false }),
    __metadata("design:type", String)
], Organization.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, unique: true, nullable: false }),
    __metadata("design:type", String)
], Organization.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        default: 'basic',
        nullable: false,
    }),
    __metadata("design:type", String)
], Organization.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], Organization.prototype, "settings", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Organization.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Organization.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', nullable: true }),
    __metadata("design:type", Date)
], Organization.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => User_1.User, user => user.organization, { cascade: true }),
    __metadata("design:type", Array)
], Organization.prototype, "users", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Invoice_1.Invoice, invoice => invoice.organization, { cascade: true }),
    __metadata("design:type", Array)
], Organization.prototype, "invoices", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Payment_1.Payment, payment => payment.organization, { cascade: true }),
    __metadata("design:type", Array)
], Organization.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PayrollBatch_1.PayrollBatch, batch => batch.organization, { cascade: true }),
    __metadata("design:type", Array)
], Organization.prototype, "payrollBatches", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => OrganizationSetting_1.OrganizationSetting, setting => setting.organization, { cascade: true }),
    __metadata("design:type", Array)
], Organization.prototype, "organizationSettings", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => AuditLog_1.AuditLog, auditLog => auditLog.organization, { cascade: true }),
    __metadata("design:type", Array)
], Organization.prototype, "auditLogs", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Template_1.Template, template => template.organization, { cascade: true }),
    __metadata("design:type", Array)
], Organization.prototype, "templates", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => NotificationQueue_1.NotificationQueue, notification => notification.organization, { cascade: true }),
    __metadata("design:type", Array)
], Organization.prototype, "notifications", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => NotificationSettings_1.NotificationSettings, settings => settings.organization, { cascade: true }),
    __metadata("design:type", Array)
], Organization.prototype, "notificationSettings", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => ReminderJob_1.ReminderJob, reminder => reminder.organization, { cascade: true }),
    __metadata("design:type", Array)
], Organization.prototype, "reminderJobs", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UserRole_1.UserRole, userRole => userRole.organization, { cascade: true }),
    __metadata("design:type", Array)
], Organization.prototype, "userRoles", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Organization.prototype, "generateId", null);
exports.Organization = Organization = __decorate([
    (0, typeorm_1.Entity)('organizations'),
    (0, typeorm_1.Index)(['slug'], { unique: true })
], Organization);
//# sourceMappingURL=Organization.js.map