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
var UserRole_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRole = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const User_1 = require("./User");
const Role_1 = require("./Role");
const Organization_1 = require("./Organization");
let UserRole = UserRole_1 = class UserRole {
    // Computed properties
    get isExpired() {
        return this.expiresAt ? new Date() > this.expiresAt : false;
    }
    get isValid() {
        return this.isActive && !this.isExpired && !this.deletedAt;
    }
    get isSystemRole() {
        return !this.organizationId;
    }
    // Methods
    toJSON() {
        const { deletedAt, ...rest } = this;
        return {
            ...rest,
            isExpired: this.isExpired,
            isValid: this.isValid,
            isSystemRole: this.isSystemRole,
        };
    }
    // Grant role with expiration
    grantRole(grantedByUserId, expirationDays) {
        this.grantedBy = grantedByUserId;
        this.grantedAt = new Date();
        this.isActive = true;
        if (expirationDays) {
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + expirationDays);
            this.expiresAt = expirationDate;
        }
    }
    // Revoke role
    revokeRole() {
        this.isActive = false;
        this.updatedAt = new Date();
    }
    // Extend role expiration
    extendExpiration(days) {
        if (this.expiresAt) {
            this.expiresAt = new Date(this.expiresAt.getTime() + days * 24 * 60 * 60 * 1000);
        }
        else {
            const newExpiration = new Date();
            newExpiration.setDate(newExpiration.getDate() + days);
            this.expiresAt = newExpiration;
        }
        this.updatedAt = new Date();
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
    // Static methods
    static createSystemRole(userId, roleId, grantedBy) {
        const userRole = new UserRole_1();
        userRole.userId = userId;
        userRole.roleId = roleId;
        userRole.organizationId = undefined; // System roles are not org-scoped
        userRole.grantedBy = grantedBy;
        userRole.grantedAt = new Date();
        userRole.isActive = true;
        return userRole;
    }
    static createOrganizationRole(userId, roleId, organizationId, grantedBy, expirationDays) {
        const userRole = new UserRole_1();
        userRole.userId = userId;
        userRole.roleId = roleId;
        userRole.organizationId = organizationId;
        userRole.grantedBy = grantedBy;
        userRole.grantedAt = new Date();
        userRole.isActive = true;
        if (expirationDays) {
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + expirationDays);
            userRole.expiresAt = expirationDate;
        }
        return userRole;
    }
};
exports.UserRole = UserRole;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], UserRole.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], UserRole.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'role_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], UserRole.prototype, "roleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], UserRole.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'granted_by', type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], UserRole.prototype, "grantedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'granted_at', type: 'timestamptz', nullable: false, default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], UserRole.prototype, "grantedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], UserRole.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], UserRole.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserRole.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UserRole.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', nullable: true }),
    __metadata("design:type", Date)
], UserRole.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, user => user.userRoles, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", User_1.User)
], UserRole.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Role_1.Role, role => role.userRoles, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'role_id' }),
    __metadata("design:type", Role_1.Role)
], UserRole.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, organization => organization.userRoles, {
        nullable: true,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Organization_1.Organization)
], UserRole.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'granted_by' }),
    __metadata("design:type", User_1.User)
], UserRole.prototype, "grantedByUser", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UserRole.prototype, "generateId", null);
exports.UserRole = UserRole = UserRole_1 = __decorate([
    (0, typeorm_1.Entity)('user_roles'),
    (0, typeorm_1.Index)(['userId', 'roleId'], { unique: true }),
    (0, typeorm_1.Index)(['userId']),
    (0, typeorm_1.Index)(['roleId']),
    (0, typeorm_1.Index)(['organizationId'])
], UserRole);
//# sourceMappingURL=UserRole.js.map